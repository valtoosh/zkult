// frontend/src/components/TransactionForm.js
import React, { useState } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';
import axios from 'axios';
import './TransactionForm.css';

// Import contract ABIs and config
import PrivateTransferV3Artifact from '../contracts/plonk/PrivateTransferV3.json';
import contractConfig from '../contracts/plonk/config.json';

const TransactionForm = ({ onSuccess, onError }) => {
  const { account, signer, isConnected, chainId } = useWeb3();
  
  const [formData, setFormData] = useState({
  senderBalance: '',
  transferAmount: '',
  recipientAddress: '', // Changed from recipientId
  assetId: '1998',
  maxAmount: '12000'
});
const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [proofData, setProofData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generateProof = async () => {
  setStatus('🔵 Generating PLONK proof...');
  
  // Prepare payload
  const payload = {
    senderBalance: parseInt(formData.senderBalance),
    transferAmount: parseInt(formData.transferAmount),
    recipientAddress: formData.recipientAddress,
    assetId: parseInt(formData.assetId),
    maxAmount: parseInt(formData.maxAmount)
  };
  
  console.log('📤 Sending to backend:', payload);
  
  try {
    const response = await axios.post('http://localhost:5001/api/proof/generate', payload);
    
    setProofData(response.data);
    setStatus('✅ Proof generated successfully!');
    return response.data;
    
  } catch (error) {
    console.error('❌ Full error object:', error);
    console.error('❌ Error response:', error.response);
    console.error('❌ Error data:', error.response?.data);
    
    // Show backend error message if available
    const backendError = error.response?.data?.message || error.response?.data?.error || error.message;
    
    setStatus(`❌ Proof generation failed: ${backendError}`);
    throw new Error(`Proof generation failed: ${backendError}`);
  }
};
  const submitToContract = async (proofData) => {
  setStatus('📝 Submitting to blockchain...');

  try {
    // Check network
    const expectedChainId = parseInt(contractConfig.chainId);
    const currentChainId = parseInt(chainId);
    
    if (currentChainId !== expectedChainId) {
      throw new Error(`Wrong network! Please switch to Sepolia (Chain ID: ${expectedChainId})`);
    }

    // Initialize contract
    const contract = new ethers.Contract(
      contractConfig.transferAddress,
      PrivateTransferV3Artifact.abi,
      signer
    );

    console.log('📝 Contract initialized:', contractConfig.transferAddress);

    // STEP 1: Format proof using backend
    setStatus('🔐 Formatting proof for contract...');
    
    const formatResponse = await axios.post('http://localhost:5001/api/proof/format-for-contract', {
      proof: proofData.proof,
      publicSignals: proofData.publicSignals
    });

    const { proofBytes, publicSignals } = formatResponse.data;

    console.log('🔐 Proof formatted by backend');
    console.log('   Proof array length:', Array.isArray(proofBytes) ? proofBytes.length : 'not array');
    console.log('   Proof:', proofBytes);
    console.log('   Public Signals:', publicSignals);

    setStatus('⏳ Estimating gas...');
    
    // STEP 2: Estimate gas
    try {
      const gasEstimate = await contract.privateTransfer.estimateGas(
        proofBytes,
        publicSignals
      );
      console.log('⛽ Gas estimate:', gasEstimate.toString());
    } catch (gasError) {
      console.error('❌ Gas estimation failed:', gasError);
      throw new Error(`Contract would revert. Check proof and public signals.`);
    }

    setStatus('⏳ Sending transaction...');

    // STEP 3: Send transaction
    const tx = await contract.privateTransfer(
      proofBytes,
      publicSignals,
      {
        gasLimit: 500000
      }
    );

    console.log('📤 Transaction sent:', tx.hash);
    setStatus(`⏳ Mining: ${tx.hash.slice(0, 10)}...`);
    
    const receipt = await tx.wait();

    console.log('✅ Transaction mined:', receipt);
    console.log('✅ tx.hash:', tx.hash);
    console.log('✅ receipt.blockNumber:', receipt.blockNumber);
    console.log('✅ receipt.gasUsed:', receipt.gasUsed);

    setStatus('✅ Transaction confirmed!');

    try {
      const result = {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
      console.log('✅ Result object created:', result);
      return result;
    } catch (err) {
      console.error('❌ Error creating result object:', err);
      throw err;
    }

  } catch (error) {
    console.error('❌ Contract submission error:', error);
    
    let errorMessage = error.message;
    if (error.reason) {
      errorMessage = error.reason;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    throw new Error(`Transaction failed: ${errorMessage}`);
  }
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      onError?.('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setStatus('🚀 Starting transfer process...');

    try {
      // Step 1: Generate proof
      console.log('📝 Step 1: Generating proof...');
      const proof = await generateProof();
      console.log('✅ Step 1 complete: Proof generated');

      // Step 2: Submit to contract
      console.log('📝 Step 2: Submitting to contract...');
      const result = await submitToContract(proof);
      console.log('✅ Step 2 complete: Contract submission successful');
      console.log('📊 Result:', result);

      setStatus('');
      console.log('📝 Step 3: Calling onSuccess callback...');

      const successData = {
        success: true,
        proofValid: true,
        onChain: true,
        amount: formData.transferAmount,
        recipient: formData.recipientAddress,
        recipientHash: proof.recipientHash, // NEW: For Phase 3 claiming
        assetId: formData.assetId,
        time: `${proof.generationTime}ms`,
        privacy: true,
        txHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        etherscanUrl: `https://sepolia.etherscan.io/tx/${result.transactionHash}`
      };

      console.log('📊 Success data:', successData);

      onSuccess?.(successData);
      console.log('✅ Step 3 complete: onSuccess called');

      // Reset form
      setFormData({
        senderBalance: '',
        transferAmount: '',
        recipientAddress: '',
        assetId: '1998',
        maxAmount: '12000'
      });
      setProofData(null);

    } catch (error) {
      console.error('❌ Transfer error:', error);
      setStatus('');
      onError?.(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transaction-form">
      <div className="form-header">
        <div>
          <h2>🔐 Private Transfer</h2>
          <p className="form-subtitle">Zero-Knowledge Asset Transfer</p>
        </div>
        <span className="proof-badge plonk">⚡ PLONK</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="senderBalance">
            Sender Balance
            <span className="label-hint">(Private)</span>
          </label>
          <input
            type="number"
            id="senderBalance"
            name="senderBalance"
            value={formData.senderBalance}
            onChange={handleChange}
            placeholder="e.g., 6000"
            required
            disabled={loading}
            min="1"
          />
          <span className="input-hint">
            ⚠️ Must match your deposited balance on the contract. Check the "Manage Balance" section above if unsure.
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="transferAmount">
            Transfer Amount
            <span className="label-hint">(Private)</span>
          </label>
          <input
            type="number"
            id="transferAmount"
            name="transferAmount"
            value={formData.transferAmount}
            onChange={handleChange}
            placeholder="e.g., 95"
            required
            disabled={loading}
            min="1"
          />
          <span className="input-hint">Amount to transfer (hidden on-chain)</span>
        </div>

        <div className="form-group">
          <label htmlFor="recipientAddress">
              Recipient Address
            <span className="label-hint">(Private - Ethereum Address)</span>
            </label>
  <input
    type="text"
    id="recipientAddress"
    name="recipientAddress"
    value={formData.recipientAddress}
    onChange={handleChange}
    placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    required
    pattern="^0x[a-fA-F0-9]{40}$"
    title="Must be a valid Ethereum address (0x followed by 40 hex characters)"
  />
  <span className="input-hint">
    Ethereum address of recipient (hidden in zero-knowledge proof)
  </span>
  {formData.recipientAddress && !isValidAddress(formData.recipientAddress) && (
    <span className="error-hint">⚠️ Invalid Ethereum address format</span>
  )}
</div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assetId">
              Asset ID
              <span className="label-hint">(Public)</span>
            </label>
            <select
              id="assetId"
              name="assetId"
              value={formData.assetId}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="1998">Asset 1998</option>
              <option value="2000">Asset 2000</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="maxAmount">
              Max Amount
              <span className="label-hint">(Public)</span>
            </label>
            <input
              type="number"
              id="maxAmount"
              name="maxAmount"
              value={formData.maxAmount}
              onChange={handleChange}
              placeholder="12000"
              required
              disabled={loading}
              min="1"
            />
          </div>
        </div>

        {status && (
          <div className="status-message">
            <div className="status-icon">
              {status.includes('✅') ? '✅' : status.includes('❌') ? '❌' : '⏳'}
            </div>
            <div className="status-text">{status}</div>
          </div>
        )}

        {proofData && (
          <div className="proof-info">
            <h4>✅ Proof Generated Successfully</h4>
            <div className="proof-stats">
              <div className="proof-stat">
                <span className="stat-label">Generation Time:</span>
                <span className="stat-value">{proofData.generationTime}ms</span>
              </div>
              <div className="proof-stat">
                <span className="stat-label">New Balance:</span>
                <span className="stat-value">{proofData.newBalance}</span>
              </div>
              <div className="proof-stat">
                <span className="stat-label">Circuit Valid:</span>
                <span className="stat-value">{proofData.valid ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div className="proof-stat">
                <span className="stat-label">Recipient Hash:</span>
                <span className="stat-value hash-display">{proofData.recipientHash?.slice(0, 20)}...</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={loading || !isConnected}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Processing...
            </>
          ) : (
            <>
              <span>🔐</span>
              Submit Private Transfer
            </>
          )}
        </button>

        {!isConnected && (
          <p className="warning-message">
            ⚠️ Please connect your wallet to continue
          </p>
        )}
      </form>

      <div className="form-footer">
        <div className="privacy-note">
          <div className="privacy-icon">🔒</div>
          <div className="privacy-text">
            <strong>Privacy Guaranteed:</strong> Your balance, transfer amount, and recipient 
            are cryptographically hidden using PLONK zero-knowledge proofs. Only proof validity 
            is verified on-chain.
          </div>
        </div>
        
        <div className="contract-info">
          <h4>📋 Contract Information</h4>
          <div className="contract-details">
            <div className="contract-detail">
              <span className="detail-label">Network:</span>
              <span className="detail-value">Sepolia Testnet</span>
            </div>
            <div className="contract-detail">
              <span className="detail-label">Contract:</span>
              <a 
                href={`https://sepolia.etherscan.io/address/${contractConfig.transferAddress}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="detail-link"
              >
                {contractConfig.transferAddress.slice(0, 6)}...{contractConfig.transferAddress.slice(-4)}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;