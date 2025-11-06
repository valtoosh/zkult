pragma circom 2.1.8;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";

/*
 * zkUlt PLONK Enhanced Transfer Circuit
 * Includes commitment scheme for future anonymity
 * 
 * This version adds:
 * - Balance commitment for privacy
 * - Nullifier concept (prepared for Phase 2)
 * - Poseidon hash for efficiency
 */

template PlonkTransferCheckEnhanced() {
    // ============================================
    // PRIVATE INPUTS
    // ============================================
    signal input senderBalance;        
    signal input transferAmount;       
    signal input recipientAddressHash;       
    signal input salt;                 // NEW: For commitment randomness
    
    // ============================================
    // PUBLIC INPUTS
    // ============================================
    signal input assetId;              
    signal input maxAmount;            
    signal input balanceCommitment;    // NEW: Commitment to sender's balance
    
    // ============================================
    // OUTPUTS
    // ============================================
    signal output valid;               
    signal output newBalance;          
    signal output newBalanceCommitment; // NEW: Commitment to new balance
    
    // ============================================
    // COMMITMENT VERIFICATION
    // Verify that sender knows the preimage of balanceCommitment
    // ============================================
    component commitmentCheck = Poseidon(2);
    commitmentCheck.inputs[0] <== senderBalance;
    commitmentCheck.inputs[1] <== salt;
    
    // Ensure provided commitment matches computed commitment
    commitmentCheck.out === balanceCommitment;
    
    // ============================================
    // TRANSFER VALIDATION (Same as basic version)
    // ============================================
    
    component ltMax = LessThan(64);
    ltMax.in[0] <== transferAmount;
    ltMax.in[1] <== maxAmount + 1;
    
    component gtZero = GreaterThan(32);
    gtZero.in[0] <== transferAmount;
    gtZero.in[1] <== 0;
    
    component balanceCheck = LessEqThan(64);
    balanceCheck.in[0] <== transferAmount;
    balanceCheck.in[1] <== senderBalance;
    
    component assetValidation = GreaterThan(32);
    assetValidation.in[0] <== assetId;
    assetValidation.in[1] <== 0;
    
    component recipientValidation = GreaterThan(160);
    recipientValidation.in[0] <== recipientAddressHash;
    recipientValidation.in[1] <== 0;
    
    // ============================================
    // OUTPUT CALCULATIONS
    // ============================================
    
    newBalance <== senderBalance - transferAmount;
    
    // Create commitment to new balance
    component newCommitment = Poseidon(2);
    newCommitment.inputs[0] <== newBalance;
    newCommitment.inputs[1] <== salt; // Same salt for simplicity
    newBalanceCommitment <== newCommitment.out;
    
    // Combine all checks
    signal intermediate1;
    signal intermediate2;
    signal intermediate3;
    signal intermediate4;

    intermediate1 <== ltMax.out * gtZero.out;
    intermediate2 <== intermediate1 * balanceCheck.out;
    intermediate3 <== intermediate2 * assetValidation.out;
    intermediate4 <== intermediate3 * recipientValidation.out;
    
    valid <== intermediate4;
}

component main {public [maxAmount, assetId, balanceCommitment]} = PlonkTransferCheckEnhanced();