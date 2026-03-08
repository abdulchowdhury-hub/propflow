require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const db = require('./db/database');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & performance
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
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

// Initialize database with tables
db.initialize();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PropFlow running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}`);
});
