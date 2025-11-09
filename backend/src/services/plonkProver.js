// backend/src/services/plonkProver.js
const ethers = require('ethers');
const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // PHASE 4: For secure salt generation
const { buildPoseidon } = require('circomlibjs');

class PlonkProverService {
  constructor() {
    this.wasmPath = path.join(__dirname, '../../keys/plonk/transfer_js/transfer.wasm');
    this.zkeyPath = path.join(__dirname, '../../keys/plonk/transfer_final.zkey');
    this.vKeyPath = path.join(__dirname, '../../keys/plonk/verification_key.json');
    
    this.initialized = false;
    this.poseidon = null;
    this.stats = {
      totalProofs: 0,
      successfulProofs: 0,
      failedProofs: 0,
      avgTime: 0,
      totalTime: 0,
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(this.wasmPath)) {
        throw new Error(`WASM file not found at ${this.wasmPath}`);
      }
      if (!fs.existsSync(this.zkeyPath)) {
        throw new Error(`Proving key not found at ${this.zkeyPath}`);
      }
      if (!fs.existsSync(this.vKeyPath)) {
        throw new Error(`Verification key not found at ${this.vKeyPath}`);
      }

      this.vKey = JSON.parse(fs.readFileSync(this.vKeyPath, 'utf8'));

      // Initialize Poseidon for commitment calculations
      this.poseidon = await buildPoseidon();

      this.initialized = true;
      console.log('✅ PLONK Prover Service initialized');
      console.log(`   WASM: ${this.wasmPath}`);
      console.log(`   Proving Key: ${this.zkeyPath}`);
    } catch (error) {
      console.error('❌ Failed to initialize PLONK Prover:', error.message);
      throw error;
    }
  }

  /**
   * PHASE 4: Generate cryptographically secure random salt
   * @returns {string} Random salt as decimal string
   */
  generateSecureSalt() {
    // Generate 32 random bytes and convert to BigInt
    const randomBytes = crypto.randomBytes(32);
    const randomBigInt = BigInt('0x' + randomBytes.toString('hex'));
    // Ensure it fits within the field size (less than ~2^254)
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    return (randomBigInt % fieldModulus).toString();
  }

  async generateProof(input) {
    await this.initialize();

    console.log('\n🔵 Generating PLONK proof with Enhanced Circuit...');
    console.log('═══════════════════════════════════════');
    console.log('Sender Balance:', input.senderBalance);
    console.log('Transfer Amount:', input.transferAmount);
    console.log('Recipient Address:', input.recipientAddress);
    console.log('Asset ID:', input.assetId);
    console.log('Max Amount:', input.maxAmount);
    console.log('═══════════════════════════════════════');

    const startTime = Date.now();
    this.stats.totalProofs++;

    try {
      this.validateInput(input);

      const recipientAddressHash = this.addressToHash(input.recipientAddress);

      // PHASE 4: Generate secure random salt if not provided
      const salt = input.salt || this.generateSecureSalt();

      console.log('\n🔐 Privacy Layer:');
      console.log('   Recipient Address Hash:', recipientAddressHash.slice(0, 20) + '...');
      console.log('   Salt (first 20 chars):', salt.slice(0, 20) + '...');

      const circuitInput = {
        senderBalance: input.senderBalance,
        transferAmount: input.transferAmount,
        recipientAddressHash: recipientAddressHash,
        salt: salt,
        assetId: input.assetId,
        maxAmount: input.maxAmount,
        balanceCommitment: input.balanceCommitment || await this.calculateCommitment(input.senderBalance, salt)
      };

      console.log('\n⚙️  Generating proof...');

      const { proof, publicSignals } = await snarkjs.plonk.fullProve(
        circuitInput,
        this.wasmPath,
        this.zkeyPath
      );

      const duration = Date.now() - startTime;

      this.stats.successfulProofs++;
      this.stats.totalTime += duration;
      this.stats.avgTime = this.stats.totalTime / this.stats.successfulProofs;

      console.log(`\n✅ PLONK proof generated in ${duration}ms`);
      console.log('═══════════════════════════════════════');
      console.log('Public Signals (8 total - Phase 4):');
      console.log('  Outputs (0-4):');
      console.log('    [0] valid:', publicSignals[0]);
      console.log('    [1] newBalance:', publicSignals[1]);
      console.log('    [2] newBalanceCommitment:', publicSignals[2]);
      console.log('    [3] recipientHash:', publicSignals[3]);
      console.log('    [4] nullifier (PHASE 4):', publicSignals[4]);
      console.log('  Public Inputs (5-7):');
      console.log('    [5] assetId:', publicSignals[5]);
      console.log('    [6] maxAmount:', publicSignals[6]);
      console.log('    [7] balanceCommitment:', publicSignals[7]);
      console.log('═══════════════════════════════════════\n');

      const valid = publicSignals[0];
      const newBalance = publicSignals[1];
      const recipientHash = publicSignals[3];
      const nullifier = publicSignals[4]; // PHASE 4: Nullifier for replay protection

      return {
        proof,
        publicSignals,
        proofSystem: 'plonk',
        generationTime: duration,
        valid: valid === '1',
        newBalance: newBalance,
        recipientHash: recipientHash,
        nullifier: nullifier, // PHASE 4: Include nullifier
        salt: salt, // PHASE 4: Return salt for frontend storage
        recipientAddress: input.recipientAddress,
        stats: { ...this.stats }
      };
    } catch (error) {
      this.stats.failedProofs++;
      console.error('❌ PLONK proof generation failed:', error.message);
      throw new Error(`Proof generation failed: ${error.message}`);
    }
  }

  addressToHash(address) {
    if (!address || typeof address !== 'string') {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }
    
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }
    
    const normalizedAddress = address.toLowerCase();
    const addressNumber = BigInt(normalizedAddress);
    
    return addressNumber.toString();
  }

  async calculateCommitment(balance, salt) {
    if (!this.poseidon) {
      await this.initialize();
    }
    
    try {
      const hash = this.poseidon([BigInt(balance), BigInt(salt)]);
      return this.poseidon.F.toString(hash);
    } catch (error) {
      console.error('❌ Failed to calculate Poseidon commitment:', error.message);
      throw error;
    }
  }

  async verifyProof(proof, publicSignals) {
    await this.initialize();

    try {
      console.log('🔍 Verifying PLONK proof off-chain...');
      const isValid = await snarkjs.plonk.verify(this.vKey, publicSignals, proof);
      
      console.log(`   Result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      return isValid;
    } catch (error) {
      console.error('❌ Proof verification failed:', error.message);
      return false;
    }
  }

  formatProofForContract(proof, publicSignals) {
    return snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  }

  validateInput(input) {
    const required = ['senderBalance', 'transferAmount', 'recipientAddress', 'assetId', 'maxAmount'];
    
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof input.recipientAddress !== 'string' || 
        !/^0x[0-9a-fA-F]{40}$/.test(input.recipientAddress)) {
      throw new Error('recipientAddress must be a valid Ethereum address (0x...)');
    }

    if (typeof input.senderBalance !== 'number' || input.senderBalance < 0) {
      throw new Error('senderBalance must be a non-negative number');
    }

    if (typeof input.transferAmount !== 'number' || input.transferAmount <= 0) {
      throw new Error('transferAmount must be a positive number');
    }

    if (typeof input.assetId !== 'number' || input.assetId <= 0) {
      throw new Error('assetId must be a positive number');
    }

    if (typeof input.maxAmount !== 'number' || input.maxAmount <= 0) {
      throw new Error('maxAmount must be a positive number');
    }

    if (input.transferAmount > input.senderBalance) {
      console.warn('⚠️  Transfer amount exceeds balance (will be rejected by circuit)');
    }

    if (input.transferAmount > input.maxAmount) {
      console.warn('⚠️  Transfer amount exceeds max allowed (will be rejected by circuit)');
    }
  }

  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalProofs > 0 
        ? ((this.stats.successfulProofs / this.stats.totalProofs) * 100).toFixed(2) + '%'
        : 'N/A',
      avgTimeFormatted: this.stats.avgTime.toFixed(2) + 'ms'
    };
  }

  resetStats() {
    this.stats = {
      totalProofs: 0,
      successfulProofs: 0,
      failedProofs: 0,
      avgTime: 0,
      totalTime: 0,
    };
  }
}

module.exports = new PlonkProverService();