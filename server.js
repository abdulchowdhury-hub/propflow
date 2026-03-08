require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

// Wrap everything in try-catch for Railway debugging
try {
  const db = require('./db/database');
  const authRoutes = require('./routes/auth');
  const apiRoutes = require('./routes/api');
  const { authenticateToken } = require('./middleware/auth');

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Ensure uploads directory exists
  const UPLOADS_DIR = path.join(__dirname, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // Health check (no auth) - Railway uses this
  app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  // Security & performance
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Public routes (login page, static assets)
  app.use('/auth', authRoutes);
  app.use('/login', express.static(path.join(__dirname, 'public', 'login.html')));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

  // Protected API routes
  app.use('/api', authenticateToken, apiRoutes);

  // Protected static files (the main app)
  app.get('/', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  app.use('/', authenticateToken, express.static(path.join(__dirname, 'public')));

  // Serve uploaded receipts (protected)
  app.use('/uploads', authenticateToken, express.static(path.join(__dirname, 'uploads')));

  // Initialize database with tables
  console.log('Initializing database...');
  db.initialize();
  console.log('Database initialized successfully');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PropFlow running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('FATAL STARTUP ERROR:', err.message);
  console.error(err.stack);
  // Start a minimal server to show the error
  const minimal = express();
  minimal.get('*', (req, res) => {
    res.status(500).json({ error: 'Server startup failed', message: err.message });
  });
  minimal.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log('Minimal error server started on port ' + (process.env.PORT || 3000));
  });
}
