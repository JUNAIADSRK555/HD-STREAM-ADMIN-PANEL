const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  appName: { type: String, default: 'JDCRIC & Entertainment Live' },
  announcement: { type: String, default: 'Welcome to Live Streaming HD! Enjoy high quality cricket & entertainment.' },
  announcementEnabled: { type: Boolean, default: true },
  appVersion: { type: String, default: '1.5.0' },
  minVersion: { type: String, default: '1.0.0' },
  apkDownloadUrl: { type: String, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  telegramLink: { type: String, default: 'https://t.me/jdcric_official' },
  supportEmail: { type: String, default: 'support@jdcric.live' },
  updatedAt: { type: Date, default: Date.now }
});

let SettingsModel;
try {
  SettingsModel = mongoose.model('Settings', SettingsSchema);
} catch (e) {
  SettingsModel = mongoose.model('Settings');
}

module.exports = SettingsModel;
