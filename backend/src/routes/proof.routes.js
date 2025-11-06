// backend/src/routes/proof.routes.js
const express = require('express');
const router = express.Router();
const plonkProver = require('../services/plonkProver');

/**
 * POST /api/proof/generate
 * Generate a PLONK proof for transfer
 */
router.post('/generate', async (req, res) => {
  try {
    const { senderBalance, transferAmount, recipientId, assetId, maxAmount } = req.body;

    // Validate request body
    if (!senderBalance || !transferAmount || !recipientId || !assetId || !maxAmount) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['senderBalance', 'transferAmount', 'recipientId', 'assetId', 'maxAmount']
      });
    }

    // Convert to numbers
    const input = {
      senderBalance: Number(senderBalance),
      transferAmount: Number(transferAmount),
      recipientId: Number(recipientId),
      assetId: Number(assetId),
      maxAmount: Number(maxAmount),
    };

    console.log('\n📥 Received proof generation request');
    console.log('   Sender Balance:', input.senderBalance);
    console.log('   Transfer Amount:', input.transferAmount);
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