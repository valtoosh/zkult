// frontend/src/App.js
import React, { useState } from 'react';
import { Web3Provider, useWeb3 } from './contexts/Web3Context';
import WalletConnect from './components/WalletConnect';
import TransactionForm from './components/TransactionForm';
import ClaimTransfer from './components/ClaimTransfer';
import DepositPanel from './components/Transfer/DepositPanel';
import WithdrawalPanel from './components/Transfer/WithdrawalPanel';
import StatusPanel from './components/StatusPanel';
import TransactionResult from './components/Common/TransactionResult';
import './App.css';

function AppContent() {
  const [txResult, setTxResult] = useState(null);
  const [proofSystem] = useState('plonk'); // PLONK-only for now
  const [activeTab, setActiveTab] = useState('send'); // 'send' or 'claim'
  const { account, signer } = useWeb3();

  return (
    <div className="App">
        {/* Header */}
        <header className="app-header">
          <div className="logo-section">
            <h1>🔐 zkUlt</h1>
            <span className="subtitle">Privacy-Preserving Asset Transfer</span>
          </div>
          <div className="proof-badge">
            <span className="badge plonk">⚡ PLONK</span>
          </div>
          <WalletConnect />
        </header>

        {/* Main Content */}
        <main className="app-main">
          <div className="container">
            {/* Info Banner */}
            <div className="info-banner">
              <div className="banner-icon">ℹ️</div>
              <div className="banner-content">
                <h3>Universal Setup: No Trusted Setup Required</h3>
                <p>
                  zkUlt uses PLONK, a universal zero-knowledge proof system that eliminates 
                  per-circuit trusted setups. Enjoy quantum-resistant privacy with transparent security.
                </p>
              </div>
            </div>

            {/* Status Panel */}
            <StatusPanel proofSystem={proofSystem} />

            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button
                className={`tab-button ${activeTab === 'send' ? 'active' : ''}`}
                onClick={() => setActiveTab('send')}
              >
                📤 Send Transfer
              </button>
              <button
                className={`tab-button ${activeTab === 'claim' ? 'active' : ''}`}
                onClick={() => setActiveTab('claim')}
              >
                🎁 Claim Transfer
              </button>
              <button
                className={`tab-button ${activeTab === 'withdraw' ? 'active' : ''}`}
                onClick={() => setActiveTab('withdraw')}
              >
                💰 Withdraw
              </button>
            </div>

            {/* Deposit Panel (only on Send tab) */}
            {activeTab === 'send' && (
              <DepositPanel
                account={account}
                signer={signer}
                onDepositSuccess={() => console.log('Deposit successful')}
              />
            )}

            {/* Transaction Form, Claim Form, or Withdraw Panel */}
            <div className="transfer-section">
              {activeTab === 'send' ? (
                <TransactionForm
                  proofSystem={proofSystem}
                  onSuccess={setTxResult}
                  onError={(err) => setTxResult({ error: err })}
                />
              ) : activeTab === 'claim' ? (
                <ClaimTransfer
                  onSuccess={setTxResult}
                  onError={(err) => setTxResult({ error: err })}
                />
              ) : (
                <WithdrawalPanel
                  account={account}
                  signer={signer}
                  onWithdrawSuccess={(result) => setTxResult({ success: true, ...result })}
                />
              )}
            </div>

            {/* Transaction Result */}
            {txResult && (
              <TransactionResult
                result={txResult}
                onReset={() => setTxResult(null)}
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-links">
            <a href="https://github.com/valtoosh/zkult" target="_blank" rel="noopener noreferrer">
              📚 GitHub
            </a>
            <a href="https://docs.zkult.dev" target="_blank" rel="noopener noreferrer">
              📖 Docs
            </a>
            <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer">
              🔍 Explorer
            </a>
          </div>
          <p className="footer-text">
            Built with ❤️ using PLONK • No Trusted Setup • Universal Composability
          </p>
        </footer>
      </div>
  );
}

function App() {
  return (
    <Web3Provider>
      <AppContent />
    </Web3Provider>
  );
}

export default App;