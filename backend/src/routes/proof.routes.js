// backend/src/routes/proof.routes.js
const snarkjs = require('snarkjs');
const express = require('express');
const router = express.Router();
const plonkProver = require('../services/plonkProver');

/**
 * POST /api/proof/generate
 * Generate a PLONK proof for transfer
 */
router.post('/generate', async (req, res) => {
  try {
    const { senderBalance, transferAmount, recipientAddress, assetId, maxAmount, salt } = req.body;

    // Validate request body
    if (!senderBalance || !transferAmount || !recipientAddress || !assetId || !maxAmount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['senderBalance', 'transferAmount', 'recipientAddress', 'assetId', 'maxAmount']
      });
    }

    // Convert to proper types
    const input = {
      senderBalance: Number(senderBalance),
      transferAmount: Number(transferAmount),
      recipientAddress: String(recipientAddress), // FIXED: Changed from recipientId
      assetId: Number(assetId),
      maxAmount: Number(maxAmount),
      salt: salt || '12345' // Optional salt
    };

    console.log('\n📥 Received proof generation request');
    console.log('   Sender Balance:', input.senderBalance);
    console.log('   Transfer Amount:', input.transferAmount);
    console.log('   Recipient:', input.recipientAddress);
    console.log('   Asset ID:', input.assetId);

    // Generate proof
    const result = await plonkProver.generateProof(input);

    // Verify proof off-chain before returning
    const isValid = await plonkProver.verifyProof(result.proof, result.publicSignals);

    if (!isValid) {
      return res.status(500).json({
        error: 'Generated proof failed verification',
        details: 'This should not happen. Please check circuit constraints.'
      });
    }

    console.log('📤 Sending proof to frontend\n');

    res.json({
      success: true,
      proof: result.proof,
      publicSignals: result.publicSignals,
      proofSystem: 'plonk',
      generationTime: result.generationTime,
      valid: result.valid,
      newBalance: result.newBalance,
      recipientAddress: result.recipientAddress, // Include recipient in response
      stats: result.stats
    });

  } catch (error) {
    console.error('❌ Proof generation error:', error);
    res.status(500).json({
      error: 'Proof generation failed',
      message: error.message
    });
  }
});

/**
 * POST /api/proof/format-for-contract
 * Format proof for Solidity contract submission
 */
router.post('/format-for-contract', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing proof or publicSignals'
      });
    }

    console.log('\n📝 Formatting proof for contract...');
    console.log('📊 Input proof keys:', Object.keys(proof));
    console.log('📊 Input publicSignals length:', publicSignals.length);

    // Use snarkjs to export proper Solidity calldata
    const calldata = await snarkjs.plonk.exportSolidityCallData(
      proof,
      publicSignals
    );

    console.log('\n📦 Raw calldata type:', typeof calldata);
    console.log('📦 Raw calldata length:', calldata.length);
    console.log('📦 First 200 chars:', calldata.substring(0, 200));
    console.log('📦 Last 200 chars:', calldata.substring(calldata.length - 200));

    // Convert to string if it's not already
    const calldataStr = calldata.toString();

    // Try multiple parsing strategies
    let proofBytes, publicSignalsArray;

    // Strategy 1: Check if it's already JSON array format
    if (calldataStr.startsWith('[')) {
      console.log('🔍 Detected array format');
      const parsed = JSON.parse(calldataStr);
      if (Array.isArray(parsed) && parsed.length === 2) {
        proofBytes = parsed[0];
        publicSignalsArray = parsed[1];
        console.log('✅ Parsed as array with 2 elements');
      }
    }

    // Strategy 2: Try comma separation
    if (!proofBytes) {
      console.log('🔍 Trying comma separation');
      const parts = calldataStr.split(/,(?![^[\]]*\])/); // Split by comma not inside brackets
      console.log('📊 Found', parts.length, 'parts');

      if (parts.length >= 2) {
        proofBytes = parts[0].trim();
        publicSignalsArray = JSON.parse(parts[parts.length - 1].trim());
        console.log('✅ Parsed using comma separation');
      }
    }

    if (!proofBytes || !publicSignalsArray) {
      // Return the raw calldata for inspection
      return res.status(500).json({
        error: 'Could not parse calldata',
        debug: {
          calldataType: typeof calldata,
          calldataLength: calldata.length,
          first200: calldata.substring(0, 200),
          last200: calldata.substring(calldata.length - 200)
        }
      });
    }

    console.log('✅ Proof bytes type:', typeof proofBytes);
    console.log('✅ Public signals count:', publicSignalsArray.length);
    console.log('✅ Public signals:', publicSignalsArray);
    console.log('📤 Sending formatted proof to frontend\n');

    res.json({
      success: true,
      proofBytes: proofBytes,
      publicSignals: publicSignalsArray
    });

  } catch (error) {
    console.error('❌ Proof formatting error:', error);
    res.status(500).json({
      error: 'Proof formatting failed',
      message: error.message,
      stack: error.stack
    });
  }
});

/**
 * POST /api/proof/verify
 * Verify a PLONK proof off-chain
 */
router.post('/verify', async (req, res) => {
  try {
    const { proof, publicSignals } = req.body;

    if (!proof || !publicSignals) {
      return res.status(400).json({
        error: 'Missing proof or publicSignals'
      });
    }

    const isValid = await plonkProver.verifyProof(proof, publicSignals);

    res.json({
      valid: isValid,
      publicSignals: publicSignals
    });

  } catch (error) {
    console.error('❌ Proof verification error:', error);
    res.status(500).json({
      error: 'Proof verification failed',
      message: error.message
    });
  }
});

/**
 * GET /api/proof/stats
 * Get proof generation statistics
 */
router.get('/stats', (req, res) => {
  const stats = plonkProver.getStats();
  res.json(stats);
});

/**
 * POST /api/proof/stats/reset
 * Reset statistics
 */
router.post('/stats/reset', (req, res) => {
  plonkProver.resetStats();
  res.json({ message: 'Statistics reset successfully' });
});

module.exports = router;