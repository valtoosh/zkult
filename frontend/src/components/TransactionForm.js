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
    recipientId: '',
    assetId: '1998',
    maxAmount: '12000'
  });
  
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
    
    try {
      const response = await axios.post('http://localhost:5001/api/proof/generate', {
        senderBalance: parseInt(formData.senderBalance),
        transferAmount: parseInt(formData.transferAmount),
        recipientId: parseInt(formData.recipientId),
        assetId: parseInt(formData.assetId),
        maxAmount: parseInt(formData.maxAmount)
      });

      console.log('✅ Proof generated:', response.data);
      
      if (!response.data.valid) {
        throw new Error('Circuit rejected transfer (check balance/amount constraints)');
      }

      setProofData(response.data);
      setStatus(`✅ Proof generated in ${response.data.generationTime}ms`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Proof generation error:', error);
      throw new Error(`Proof generation failed: ${error.response?.data?.message || error.message}`);
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

      // Format proof for Solidity
      const proofBytes = ethers.hexlify(
        ethers.toUtf8Bytes(JSON.stringify(proofData.proof))
      );
      
      console.log('🔐 Proof formatted for contract');
      console.log('   Public Signals:', proofData.publicSignals);

      setStatus('⏳ Sending transaction...');

      // Call privateTransfer function
      const tx = await contract.privateTransfer(
        proofBytes,
        proofData.publicSignals
      );

      console.log('📤 Transaction sent:', tx.hash);
      setStatus(`⏳ Mining transaction: ${tx.hash.slice(0, 10)}...`);
      
      const receipt = await tx.wait();

      console.log('✅ Transaction mined:', receipt);
      setStatus('✅ Transaction confirmed!');
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };

    } catch (error) {
      console.error('❌ Contract submission error:', error);
      
      // Parse error message
      let errorMessage = error.message;
      if (error.reason) {
        errorMessage = error.reason;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
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
      const proof = await generateProof();
      
      // Step 2: Submit to contract
      const result = await submitToContract(proof);
      
      setStatus('');
      onSuccess?.({
        message: 'Private transfer completed successfully! 🎉',
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        proofTime: proof.generationTime,
        newBalance: proof.newBalance,
        etherscanUrl: `https://sepolia.etherscan.io/tx/${result.transactionHash}`
      });

      // Reset form
      setFormData({
        senderBalance: '',
        transferAmount: '',
        recipientId: '',
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
          <span className="input-hint">Your current balance (hidden on-chain)</span>
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
          <label htmlFor="recipientId">
            Recipient ID
            <span className="label-hint">(Private)</span>
          </label>
          <input
            type="number"
            id="recipientId"
            name="recipientId"
            value={formData.recipientId}
            onChange={handleChange}
            placeholder="e.g., 123456"
            required
            disabled={loading}
            min="1"
          />
          <span className="input-hint">Recipient identifier (hidden on-chain)</span>
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