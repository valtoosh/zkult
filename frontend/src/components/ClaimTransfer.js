// frontend/src/components/ClaimTransfer.js
import React, { useState } from 'react';
import { useWeb3 } from '../contexts/Web3Context';
import { ethers } from 'ethers';
import './ClaimTransfer.css';

// Import contract ABIs and config
import PrivateTransferV3Artifact from '../contracts/plonk/PrivateTransferV3.json';
import contractConfig from '../contracts/plonk/config.json';

const ClaimTransfer = ({ onSuccess, onError }) => {
  const { account, signer, isConnected, chainId } = useWeb3();

  const [recipientHash, setRecipientHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingTransferInfo, setPendingTransferInfo] = useState(null);

  const handleChange = (e) => {
    setRecipientHash(e.target.value);
  };

  const checkPendingTransfer = async () => {
    if (!recipientHash) {
      onError?.('Please enter a recipient hash');
      return;
    }

    setStatus('🔍 Checking for pending transfer...');

    try {
      // Initialize contract
      const contract = new ethers.Contract(
        contractConfig.transferAddress,
        PrivateTransferV3Artifact.abi,
        signer
      );

      // Query pending transfer
      const transfer = await contract.getPendingTransfer(recipientHash);
      const [amount, assetId, timestamp, claimed] = transfer;

      console.log('Pending transfer:', { amount: amount.toString(), assetId: assetId.toString(), timestamp: timestamp.toString(), claimed });

      if (amount.toString() === '0') {
        setStatus('❌ No pending transfer found for this hash');
        setPendingTransferInfo(null);
        return;
      }

      if (claimed) {
        setStatus('⚠️ Transfer already claimed');
        setPendingTransferInfo(null);
        return;
      }

      // Store transfer info
      const transferInfo = {
        amount: amount.toString(),
        assetId: assetId.toString(),
        timestamp: new Date(Number(timestamp) * 1000).toLocaleString(),
        claimed
      };

      setPendingTransferInfo(transferInfo);
      setStatus('✅ Pending transfer found! You can claim it below.');

    } catch (error) {
      console.error('❌ Error checking pending transfer:', error);
      setStatus('❌ Error checking transfer');
      onError?.(error.message);
    }
  };

  const claimTransfer = async () => {
    if (!isConnected) {
      onError?.('Please connect your wallet first');
      return;
    }

    if (!pendingTransferInfo) {
      onError?.('Please check for a pending transfer first');
      return;
    }

    setLoading(true);
    setStatus('📝 Claiming transfer...');

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

      setStatus('⏳ Estimating gas...');

      // Estimate gas
      try {
        const gasEstimate = await contract.claimTransfer.estimateGas(recipientHash);
        console.log('⛽ Gas estimate:', gasEstimate.toString());
      } catch (gasError) {
        console.error('❌ Gas estimation failed:', gasError);
        throw new Error('Transaction would revert. Transfer may already be claimed or hash is invalid.');
      }

      setStatus('⏳ Sending transaction...');

      // Send transaction
      const tx = await contract.claimTransfer(recipientHash, {
        gasLimit: 300000
      });

      console.log('📤 Transaction sent:', tx.hash);
      setStatus(`⏳ Mining: ${tx.hash.slice(0, 10)}...`);

      const receipt = await tx.wait();

      console.log('✅ Transaction mined:', receipt);
      setStatus('✅ Transfer claimed successfully!');

      // Call success callback
      const result = {
        success: true,
        proofValid: true,
        amount: pendingTransferInfo.amount,
        assetId: pendingTransferInfo.assetId,
        recipient: account,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`,
        onChain: true,
        time: 'N/A',
        privacy: true,
        claimed: true
      };

      onSuccess?.(result);

      // Reset form
      setRecipientHash('');
      setPendingTransferInfo(null);
      setStatus('');

    } catch (error) {
      console.error('❌ Claim error:', error);
      setStatus('');

      let errorMessage = error.message;
      if (error.reason) {
        errorMessage = error.reason;
      }

      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="claim-transfer">
      <div className="form-header">
        <div>
          <h2>🎁 Claim Transfer</h2>
          <p className="form-subtitle">Retrieve your private transfer</p>
        </div>
        <span className="proof-badge plonk">⚡ PLONK</span>
      </div>

      <div className="claim-content">
        <div className="form-group">
          <label htmlFor="recipientHash">
            Recipient Hash
            <span className="label-hint">(Provided by sender)</span>
          </label>
          <input
            type="text"
            id="recipientHash"
            name="recipientHash"
            value={recipientHash}
            onChange={handleChange}
            placeholder="Enter the recipient hash from the sender..."
            required
            disabled={loading}
          />
          <span className="input-hint">
            The sender should have shared this hash with you after completing the transfer
          </span>
        </div>

        <button
          type="button"
          className="check-button"
          onClick={checkPendingTransfer}
          disabled={loading || !recipientHash}
        >
          🔍 Check Transfer
        </button>

        {status && (
          <div className="status-message">
            <div className="status-icon">
              {status.includes('✅') ? '✅' : status.includes('❌') ? '❌' : '⏳'}
            </div>
            <div className="status-text">{status}</div>
          </div>
        )}

        {pendingTransferInfo && (
          <div className="transfer-info">
            <h4>📦 Pending Transfer Details</h4>
            <div className="transfer-stats">
              <div className="transfer-stat">
                <span className="stat-label">Amount:</span>
                <span className="stat-value">{pendingTransferInfo.amount} units</span>
              </div>
              <div className="transfer-stat">
                <span className="stat-label">Asset ID:</span>
                <span className="stat-value">{pendingTransferInfo.assetId}</span>
              </div>
              <div className="transfer-stat">
                <span className="stat-label">Created:</span>
                <span className="stat-value">{pendingTransferInfo.timestamp}</span>
              </div>
            </div>

            <button
              type="button"
              className="claim-button"
              onClick={claimTransfer}
              disabled={loading || !isConnected}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                <>
                  <span>🎁</span>
                  Claim Transfer
                </>
              )}
            </button>
          </div>
        )}

        {!isConnected && (
          <p className="warning-message">
            ⚠️ Please connect your wallet to continue
          </p>
        )}
      </div>

      <div className="form-footer">
        <div className="privacy-note">
          <div className="privacy-icon">🔒</div>
          <div className="privacy-text">
            <strong>Privacy Guaranteed:</strong> The claiming process maintains complete privacy.
            The sender's identity and your connection to them remain hidden on-chain.
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

export default ClaimTransfer;
