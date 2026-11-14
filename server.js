require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { connectDB } = require('./config/db');
const Store = require('./services/store');

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

// Fast health check & 24/7 Keep-Alive route (Zero database overhead)
app.get(['/api/ping', '/ping', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'HD STREAM 24/7 Server Active',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Serverless auto-connect for Vercel before routing
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && req.path !== '/api/ping') {
    try {
      await connectDB();
    } catch (_) {}
  }
  next();
});

// Serve Admin Dashboard Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

// Direct APK Download Endpoints (No-Cache so phone always gets the fresh new APK)
app.get(['/HD-STREAM.apk', '/HD-STREAM-v2-NEW.apk', '/HD-STREAM-release.apk'], (req, res) => {
  // Track download event
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  Store.trackApkDownload().catch(() => {});
  Store.trackDevice(clientIp, userAgent).catch(() => {});

  const reqFile = 'HD-STREAM.apk';
  const apkPath = path.join(__dirname, 'public', 'HD-STREAM.apk');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.download(apkPath, reqFile, (err) => {
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
