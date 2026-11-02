const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  appName: { type: String, default: 'JDCRIC & Entertainment Live' },
  announcement: { type: String, default: 'Welcome to Live Streaming HD! Enjoy high quality cricket & entertainment.' },
  announcementEnabled: { type: Boolean, default: true },
  appVersion: { type: String, default: '3.0.6' },
  minVersion: { type: String, default: '3.0.6' },
  apkDownloadUrl: { type: String, default: 'https://stream-admin-backend.vercel.app/HD-STREAM.apk' },
  maintenanceMode: { type: Boolean, default: false },
  telegramLink: { type: String, default: 'https://t.me/livetvofficialapp' },
  supportEmail: { type: String, default: 'support@hdstream.live' },
  adminUsername: { type: String, default: 'admin' },
  adminPassword: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

let SettingsModel;
try {
  SettingsModel = mongoose.model('Settings', SettingsSchema);
} catch (e) {
  SettingsModel = mongoose.model('Settings');
}

module.exports = SettingsModel;
