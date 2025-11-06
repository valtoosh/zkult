# zkUlt - Zero-Knowledge Private Transfer System

Privacy-preserving blockchain transfer system using PLONK proofs with Ethereum address support.

## 🌟 Features

- ✅ **Enhanced PLONK Circuit** with Poseidon commitments (847 constraints)
- ✅ **Ethereum Address Support** - Recipients as 160-bit hashed addresses
- ✅ **Privacy-Preserving** - Transfer amounts and balances remain private
- ✅ **Fast Proof Generation** - ~700ms per proof
- ✅ **Off-chain Verification** - Backend validates proofs before blockchain submission

## 🏗️ Architecture
```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Frontend  │─────▶│   Backend    │─────▶│  Smart Contract │
│   (React)   │      │  (Express)   │      │   (Solidity)    │
└─────────────┘      └──────────────┘      └─────────────────┘
      │                     │                       │
      │                     ▼                       │
      │            ┌──────────────┐                 │
      │            │ PLONK Prover │                 │
      │            │  (snarkjs)   │                 │
      │            └──────────────┘                 │
      │                     │                       │
      └─────────────────────┴───────────────────────┘
                         Circom Circuit
                    (transfer.circom - 847 constraints)
```

## 🚀 Quick Start

### Prerequisites
- Node.js v20.x
- npm or yarn
- Git

### Installation
```bash
# Clone repository
git clone https://github.com/valtoosh/zkult.git
cd zkult

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Running the Application

**Backend:**
```bash
cd backend
npm start
# Server runs on http://localhost:5001
```

**Frontend:**
```bash
cd frontend
npm start
# App runs on http://localhost:3000
```

### Testing
```bash
# Test proof generation with Ethereum address
cd backend
node test-prover-new.js
```

## 🔧 Technology Stack

- **Zero-Knowledge Proofs:** PLONK (via snarkjs)
- **Circuit Language:** Circom 2.1.8
- **Backend:** Node.js + Express
- **Frontend:** React 18
- **Smart Contracts:** Solidity + Hardhat
- **Blockchain:** Ethereum (Sepolia Testnet)
- **Hash Function:** Poseidon (circomlibjs)

## 📊 Current Status

**Phase 1: ✅ COMPLETE**
- Enhanced PLONK circuit with commitments
- Backend proof generation with Ethereum addresses
- API endpoints
- Test suite

**Phase 2: 🔄 IN PROGRESS**
- Frontend integration
- Contract deployment to Sepolia
- End-to-end testing

**Phase 3: 📅 PLANNED**
- Security enhancements (nullifiers, Merkle trees)
- Multi-asset support
- Production hardening

## 📁 Project Structure
```
zkult/
├── circuits/
│   └── plonk/
│       └── transfer.circom          # Enhanced PLONK circuit
├── backend/
│   ├── src/
│   │   ├── services/
│   │   │   └── plonkProver.js      # Proof generation service
│   │   ├── routes/
│   │   │   └── proof.routes.js     # API endpoints
│   │   └── server.js               # Express server
│   └── keys/plonk/                 # PLONK keys (gitignored)
├── contracts/
│   └── plonk/
│       ├── PlonkVerifier.sol       # Auto-generated verifier
│       └── PrivateTransferV3.sol   # Transfer contract
├── frontend/
│   └── src/
│       ├── components/
│       │   └── TransactionForm.js  # Main UI component
│       └── App.js
├── project-plan.xml                # Detailed roadmap
└── README.md
```

## 🧪 Example Usage
```javascript
// Test input
const input = {
  senderBalance: 6000,
  transferAmount: 95,
  recipientAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  assetId: 1998,
  maxAmount: 12000
};

// Expected output
{
  valid: true,
  newBalance: 5905,  // 6000 - 95
  proof: { ... },
  generationTime: 728  // ms
}
```

## 🔐 Security Features

- **Private Balances:** Balance commitments using Poseidon hash
- **Private Recipients:** Ethereum addresses hashed to 160-bit values
- **Private Amounts:** Transfer amounts hidden in zero-knowledge proof
- **Public Verification:** Anyone can verify proof validity without seeing private data

## 📈 Performance

| Metric | Value | Status |
|--------|-------|--------|
| Proof Generation | ~728ms | ✅ Good |
| Circuit Constraints | 847 | ✅ Reasonable |
| Proving Key Size | ~3MB | ✅ Acceptable |
| Address Validation | Regex (fast) | ✅ Efficient |

## 🛣️ Roadmap

See [project-plan.xml](./project-plan.xml) for detailed roadmap.

**Immediate:**
- [ ] Frontend Ethereum address input
- [ ] Deploy contracts to Sepolia
- [ ] End-to-end testing

**Short-term:**
- [ ] Random salt generation
- [ ] Enhanced error handling
- [ ] Loading states

**Long-term:**
- [ ] Nullifier system (prevent double-spending)
- [ ] Merkle tree integration
- [ ] Multi-asset support (ERC20, ERC721)
- [ ] Security audit
- [ ] Mainnet deployment

## 🤝 Contributing

Contributions welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

**valtoosh**
- GitHub: [@valtoosh](https://github.com/valtoosh)

## 🙏 Acknowledgments

- [Circom](https://docs.circom.io/) - Circuit language
- [snarkjs](https://github.com/iden3/snarkjs) - PLONK prover
- [circomlibjs](https://github.com/iden3/circomlibjs) - Poseidon hash
- [Hardhat](https://hardhat.org/) - Smart contract development

## 📞 Support

For issues or questions:
- Open an issue on GitHub
- Check [project-plan.xml](./project-plan.xml) for troubleshooting

---

**Status:** Phase 1 Complete (Backend Working) | Phase 2 In Progress (Frontend Integration)
