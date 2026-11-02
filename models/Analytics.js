const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  requestsCount: { type: Number, default: 1 }
});

const AnalyticsSummarySchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  totalApkDownloads: { type: Number, default: 0 },
  manualInstallOffset: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

let DeviceModel;
let AnalyticsSummaryModel;
try {
  DeviceModel = mongoose.model('Device', DeviceSchema);
  AnalyticsSummaryModel = mongoose.model('AnalyticsSummary', AnalyticsSummarySchema);
} catch (e) {
  DeviceModel = mongoose.model('Device');
  AnalyticsSummaryModel = mongoose.model('AnalyticsSummary');
}

module.exports = {
  Device: DeviceModel,
  AnalyticsSummary: AnalyticsSummaryModel
};

