const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  deviceModel: { type: String, default: '' },
  osVersion: { type: String, default: '' },
  firstSeen: { type: Date, default: Date.now, index: true },
  lastSeen: { type: Date, default: Date.now, index: true },
  requestsCount: { type: Number, default: 1 }
});

const DailyInstallSchema = new mongoose.Schema({
  dateStr: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD
  installs: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const AnalyticsSummarySchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  totalApkDownloads: { type: Number, default: 0 },
  manualInstallOffset: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

let DeviceModel;
let AnalyticsSummaryModel;
let DailyInstallModel;
try {
  DeviceModel = mongoose.model('Device', DeviceSchema);
  AnalyticsSummaryModel = mongoose.model('AnalyticsSummary', AnalyticsSummarySchema);
  DailyInstallModel = mongoose.model('DailyInstall', DailyInstallSchema);
} catch (e) {
  DeviceModel = mongoose.model('Device');
  AnalyticsSummaryModel = mongoose.model('AnalyticsSummary');
  DailyInstallModel = mongoose.model('DailyInstall');
}

module.exports = {
  Device: DeviceModel,
  AnalyticsSummary: AnalyticsSummaryModel,
  DailyInstall: DailyInstallModel
};

