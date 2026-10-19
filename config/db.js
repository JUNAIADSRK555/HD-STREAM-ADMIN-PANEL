const mongoose = require('mongoose');

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return true;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    // Graceful fallback for in-memory mode without crashing
    return false;
  }

  try {
    cachedConnection = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false
    });
    console.log(`✅ MongoDB Connected Successfully: ${cachedConnection.connection.host}`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    return false;
  }
}

function getDbStatus() {
  const isConnected = mongoose.connection.readyState === 1;
  return {
    connected: isConnected,
    host: isConnected ? mongoose.connection.host : 'In-Memory / Vercel Serverless Ready',
    readyState: mongoose.connection.readyState
  };
}

module.exports = { connectDB, getDbStatus };
