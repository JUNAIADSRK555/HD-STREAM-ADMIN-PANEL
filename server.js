require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { connectDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serverless auto-connect for Vercel before routing
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      await connectDB();
    } catch (_) {}
  }
  next();
});

// Serve Admin Dashboard Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

// Direct APK Download Endpoint
app.get('/HD-STREAM.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'HD-STREAM.apk');
  res.download(apkPath, 'HD-STREAM.apk', (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('APK file not found');
    }
  });
});

// API Routes
const apiRoutes = require('./routes/api');
const feedRoutes = require('./routes/feeds');

app.use('/api', apiRoutes);
app.use('/api/feed', feedRoutes);

// Root Fallback to Admin Dashboard
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API Route Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Start Server locally if not running on Vercel
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 HD STREAM Admin Backend Running on port ${PORT}`);
    });
  }).catch(() => {
    app.listen(PORT);
  });
}

module.exports = app;
