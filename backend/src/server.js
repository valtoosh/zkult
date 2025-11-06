// backend/src/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const proofRoutes = require('./routes/proof.routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/proof', proofRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    proofSystem: 'PLONK',
    version: '1.0.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log('════════════════════════════════════════');
  console.log('  🔐 zkUlt PLONK Proof Server');
  console.log('════════════════════════════════════════');
  console.log(`  🚀 Server: http://localhost:${PORT}`);
  console.log(`  🏥 Health: http://localhost:${PORT}/health`);
  console.log(`  📊 Stats:  http://localhost:${PORT}/api/proof/stats`);
  console.log('════════════════════════════════════════\n');
});