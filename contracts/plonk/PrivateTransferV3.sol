// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPlonkVerifier {
    function verifyProof(uint256[24] calldata proof, uint256[8] calldata pubSignals) external view returns (bool);
}

/**
 * @title PrivateTransferV3
 * @notice Privacy-preserving asset transfer using PLONK zero-knowledge proofs with hash-based claiming
 * @dev Integrates with auto-generated PlonkVerifier contract (Enhanced Circuit)
 * Phase 3: Recipient privacy via hash-based claiming
 * Phase 4: Nullifier system for replay attack prevention
 */
contract PrivateTransferV3 {
    // ============================================
    // STRUCTS
    // ============================================

    struct PendingTransfer {
        uint256 amount;
        uint256 assetId;
        uint256 timestamp;
        bool claimed;
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    IPlonkVerifier public verifier;

    mapping(address => uint256) public balances;
    mapping(uint256 => bool) public whitelistedAssets;
    mapping(uint256 => PendingTransfer) public pendingTransfers; // recipientHash => transfer details
    mapping(uint256 => bool) public nullifiers; // PHASE 4: Track used nullifiers to prevent double-spending

    uint256 public totalDeposited;
    uint256 public totalTransfers;
    uint256 public totalPending;

    address public owner;
    bool public paused;
    
    // ============================================
    // EVENTS
    // ============================================

    event Deposit(address indexed sender, uint256 amount, uint256 timestamp);

    event PrivateTransfer(
        address indexed sender,
        uint256 indexed recipientHash,
        uint256 indexed assetId,
        uint256 timestamp,
        bool valid,
        uint256 newBalance
    );

    event NullifierUsed(
        uint256 indexed nullifier,
        address indexed sender,
        uint256 timestamp
    );

    event TransferClaimed(
        uint256 indexed recipientHash,
        address indexed claimer,
        uint256 amount,
        uint256 timestamp
    );

    event Withdrawal(address indexed recipient, uint256 amount, uint256 timestamp);

    event AssetWhitelisted(uint256 indexed assetId, bool status);

    event Paused(bool status);
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address _verifierAddress) {
        verifier = IPlonkVerifier(_verifierAddress);
        owner = msg.sender;
        paused = false;
        
        // Whitelist default assets (1998, 2000)
        whitelistedAssets[1998] = true;
        whitelistedAssets[2000] = true;
        
        emit AssetWhitelisted(1998, true);
        emit AssetWhitelisted(2000, true);
    }
    
    // ============================================
    // DEPOSIT FUNCTION
    // ============================================
    
    /**
     * @notice Deposit ETH to the contract
     * @dev Funds can be used for private transfers
     */
    function deposit() external payable whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;
        
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
    
    // ============================================
    // PRIVATE TRANSFER WITH PLONK PROOF
    // ============================================
    
    /**
     * @notice Execute a private transfer with PLONK zero-knowledge proof
     * @param proof PLONK proof bytes
     * @param publicSignals Public signals from Enhanced Circuit (8 signals - Phase 4)
     * @dev Proof verifies transfer validity without revealing private details
     * Creates a pending transfer that recipient must claim
     *
     * Enhanced Circuit Public Signals (8 total):
     * Outputs (0-4):
     * [0] valid (output)
     * [1] newBalance (output)
     * [2] newBalanceCommitment (output)
     * [3] recipientHash (output) - hash for claiming
     * [4] nullifier (output) - prevents double-spending (Phase 4)
     * Public Inputs (5-7):
     * [5] assetId (public input)
     * [6] maxAmount (public input)
     * [7] balanceCommitment (public input)
     */
    function privateTransfer(
        uint256[24] calldata proof,
        uint256[8] calldata publicSignals
    ) external whenNotPaused {
        // Parse public signals (CORRECTED Circuit order)
        uint256 valid = publicSignals[0];                // Circuit output
        uint256 newBalance = publicSignals[1];           // Circuit output
        uint256 newBalanceCommitment = publicSignals[2]; // Circuit output
        uint256 recipientHash = publicSignals[3];        // Circuit output
        uint256 nullifier = publicSignals[4];            // Circuit output (PHASE 4)
        uint256 assetId = publicSignals[5];              // Public input
        uint256 maxAmount = publicSignals[6];            // Public input
        uint256 balanceCommitment = publicSignals[7];    // Public input

        // Validate asset is whitelisted
        require(whitelistedAssets[assetId], "Asset not whitelisted");

        // PHASE 4: Check nullifier hasn't been used (prevents double-spending)
        require(!nullifiers[nullifier], "Double spend: nullifier already used");

        // Verify the PLONK proof
        bool proofValid = verifier.verifyProof(proof, publicSignals);
        require(proofValid, "Invalid proof");

        // Check that circuit validated the transfer
        require(valid == 1, "Circuit rejected transfer");

        // Calculate transfer amount from balance difference
        uint256 oldBalance = balances[msg.sender];
        require(newBalance < oldBalance, "Invalid balance update");
        uint256 transferAmount = oldBalance - newBalance;

        // Update sender's balance
        balances[msg.sender] = newBalance;

        // PHASE 4: Mark nullifier as used to prevent replay attacks
        nullifiers[nullifier] = true;

        // Create pending transfer for recipient to claim
        require(pendingTransfers[recipientHash].amount == 0, "Hash collision");
        pendingTransfers[recipientHash] = PendingTransfer({
            amount: transferAmount,
            assetId: assetId,
            timestamp: block.timestamp,
            claimed: false
        });

        totalTransfers++;
        totalPending++;

        emit PrivateTransfer(
            msg.sender,
            recipientHash,
            assetId,
            block.timestamp,
            valid == 1,
            newBalance
        );

        emit NullifierUsed(nullifier, msg.sender, block.timestamp);
    }

    // ============================================
    // CLAIM TRANSFER FUNCTION
    // ============================================

    /**
     * @notice Claim a pending transfer using recipientHash
     * @param recipientHash The hash used to identify the transfer
     * @dev Recipient must know the preimage (their address + transfer amount)
     */
    function claimTransfer(uint256 recipientHash) external whenNotPaused {
        PendingTransfer storage transfer = pendingTransfers[recipientHash];

        // Verify transfer exists and hasn't been claimed
        require(transfer.amount > 0, "No pending transfer found");
        require(!transfer.claimed, "Transfer already claimed");

        // Mark as claimed
        transfer.claimed = true;
        totalPending--;

        // Credit recipient's balance
        balances[msg.sender] += transfer.amount;

        emit TransferClaimed(
            recipientHash,
            msg.sender,
            transfer.amount,
            block.timestamp
        );
    }

    // ============================================
    // WITHDRAWAL FUNCTION
    // ============================================
    
    /**
     * @notice Withdraw ETH from contract balance
     * @param amount Amount to withdraw
     * @param recipient Address to receive funds
     */
    function withdraw(uint256 amount, address payable recipient) external whenNotPaused {
        require(amount > 0, "Withdrawal amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(recipient != address(0), "Invalid recipient");
        
        balances[msg.sender] -= amount;
        
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(recipient, amount, block.timestamp);
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Add or remove asset from whitelist
     * @param assetId Asset identifier
     * @param status True to whitelist, false to remove
     */
    function setAssetWhitelist(uint256 assetId, bool status) external onlyOwner {
        whitelistedAssets[assetId] = status;
        emit AssetWhitelisted(assetId, status);
    }
    
    /**
     * @notice Pause or unpause contract
     * @param _paused True to pause, false to unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    
    /**
     * @notice Update verifier contract (for upgrades)
     * @param _verifierAddress New verifier address
     */
    function updateVerifier(address _verifierAddress) external onlyOwner {
        require(_verifierAddress != address(0), "Invalid verifier address");
        verifier = IPlonkVerifier(_verifierAddress);
    }
    
    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function getBalance(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function isAssetWhitelisted(uint256 assetId) external view returns (bool) {
        return whitelistedAssets[assetId];
    }
    
    function getContractStats() external view returns (
        uint256 _totalDeposited,
        uint256 _totalTransfers,
        uint256 _totalPending,
        uint256 _contractBalance
    ) {
        return (totalDeposited, totalTransfers, totalPending, address(this).balance);
    }

    function getPendingTransfer(uint256 recipientHash) external view returns (
        uint256 amount,
        uint256 assetId,
        uint256 timestamp,
        bool claimed
    ) {
        PendingTransfer memory transfer = pendingTransfers[recipientHash];
        return (transfer.amount, transfer.assetId, transfer.timestamp, transfer.claimed);
    }
    
    // ============================================
    // FALLBACK
    // ============================================
    
    receive() external payable {
        balances[msg.sender] += msg.value;
        totalDeposited += msg.value;
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
}