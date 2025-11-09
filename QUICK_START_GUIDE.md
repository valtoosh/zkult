# zkUlt Phase 3 - Quick Start Guide

## Understanding the Error

The error you saw ("Invalid balance update") happened because **you haven't deposited any funds to the contract yet**. Here's why:

1. The contract stores balances on-chain: `balances[msg.sender]`
2. When you create a proof, you claim to have a certain balance (e.g., 6000)
3. The contract verifies that your new balance (5905) is less than your current on-chain balance
4. **If your on-chain balance is 0, but you claim 6000, the contract rejects it**

This is a **critical security feature** - it prevents people from creating fake proofs with non-existent funds!

## How the System Works (Phase 3)

### Step 1: Deposit Funds
**You must deposit funds to the contract first!**

```
Your Wallet → Contract Deposit → Contract Balance (stored on-chain)
```

### Step 2: Create Private Transfer
Once you have a balance, you can create a zero-knowledge proof that:
- You know your current balance (private)
- You want to transfer X amount (private)
- The recipient's address (private - only hash visible!)

```
Sender creates proof → Contract verifies proof → Creates pending transfer
```

### Step 3: Recipient Claims
The recipient uses the hash to claim their funds:

```
Recipient provides hash → Contract releases funds → Recipient's balance updated
```

## Getting Started - Correct Flow

### Backend
Backend should already be running on port 5001. If not:
```bash
cd backend
npm start
```

### Frontend
Start the frontend:
```bash
cd frontend
npm start
```

### Test the Full Flow

**1. Connect Wallet**
- Make sure you're on Sepolia testnet
- Connect your wallet

**2. Deposit Funds (NEW!)**
On the "Send Transfer" tab, you'll now see a "Manage Balance" section at the top:
- Enter an amount (e.g., 0.001 ETH)
- Click "💸 Deposit ETH"
- Wait for confirmation
- Your balance will update automatically

**3. Create a Private Transfer**
Now that you have a balance:
- **Sender Balance**: Enter the EXACT amount you deposited in Wei (e.g., if you deposited 0.001 ETH, enter 1000000000000000)
- **Transfer Amount**: Amount to send (e.g., 95)
- **Recipient Address**: Their Ethereum address
- Click "Submit Private Transfer"

**4. Share the Recipient Hash**
After successful transfer:
- Copy the recipient hash from the success screen
- Send it to the recipient (via secure channel)

**5. Claim the Transfer**
Recipient:
- Switches to "Claim Transfer" tab
- Enters the recipient hash
- Clicks "Check Transfer" to see details
- Clicks "Claim Transfer" to receive funds

## Important Notes

### Balance Format
The contract stores balances in **Wei** (smallest ETH unit):
- 1 ETH = 1,000,000,000,000,000,000 Wei
- 0.001 ETH = 1,000,000,000,000,000 Wei

**For testing**, you can use simple numbers:
- Deposit: Use the UI (it handles Wei conversion)
- Sender Balance field: Enter the same value for simplicity (e.g., 6000)
- Just make sure it matches what's actually deposited!

### Privacy Features

✅ **What's Hidden**:
- Sender's balance (private input to proof)
- Transfer amount (private input to proof)
- Recipient's address (only hash visible on-chain)
- Connection between sender and recipient (no on-chain link)

✅ **What's Public**:
- Sender's address (who called the contract)
- Recipient hash (random-looking number)
- Asset ID
- Proof validity

## Deployed Contracts (Sepolia)

- **PlonkVerifier**: `0x63324aAF9233F5AeAC5347ee290389389B7A59ec`
- **PrivateTransferV3**: `0x9Db2dd50b657CBa2dccE86F6834b5277f576cBFD`

Both verified on Etherscan!

## Troubleshooting

### "Invalid balance update"
- You need to deposit funds first!
- Your "Sender Balance" must match your on-chain balance
- Check the balance display in "Manage Balance" section

### "Proof generation failed"
- Make sure all inputs are valid
- Transfer amount must be less than sender balance
- Recipient address must be a valid Ethereum address

### "Transaction would revert"
- Proof might be invalid
- Balance mismatch between proof and on-chain balance
- Try depositing funds first

## Example Flow with Numbers

1. **Deposit**: 0.001 ETH
   - On-chain balance: `1000000000000000` Wei

2. **Create Transfer**:
   - Sender Balance: `1000000000000000`
   - Transfer Amount: `100000000000000`
   - Recipient: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

3. **Result**:
   - Sender's new balance: `900000000000000`
   - Pending transfer: `100000000000000` (waiting to be claimed)
   - Recipient hash: `8576507998588140227214208401018491487166362041359357504905750115483213502579`

4. **Claim**:
   - Recipient enters hash
   - Claims `100000000000000` Wei
   - Balance added to recipient's on-chain balance

## Next Steps

1. Start the frontend
2. Connect wallet (Sepolia)
3. **DEPOSIT FUNDS FIRST** using the "Manage Balance" section
4. Create a transfer with the correct balance
5. Test the claiming flow

Enjoy your privacy! 🔐
