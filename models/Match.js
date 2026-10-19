const mongoose = require('mongoose');

const StreamSchema = new mongoose.Schema({
  id: { type: String, default: () => 'str_' + Math.random().toString(36).substr(2, 9) },
  title: { type: String, required: true },
  streamType: { type: String, enum: ['M3U8', 'MPD', 'EMBED', 'DIRECT', 'JSON'], default: 'M3U8' },
  streamUrl: { type: String, required: true },
  jsonChannelUrl: { type: String, default: '' },
  jsonTokenUrl: { type: String, default: '' },
  jsonToken: { type: String, default: '' },
  quality: { type: String, default: 'Auto' },
  headers: {
    userAgent: { type: String, default: '' },
    referer: { type: String, default: '' },
    origin: { type: String, default: '' },
    cookie: { type: String, default: '' }
  },
  drm: {
    enabled: { type: Boolean, default: false },
    scheme: { type: String, enum: ['clearkey', 'widevine', 'playready'], default: 'clearkey' },
    keyId: { type: String, default: '' }, // Key 1 (KID)
    key: { type: String, default: '' }     // Key 2 (Hex key)
  },
  isActive: { type: Boolean, default: true }
});

const MatchSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, default: 'Live Cricket' },
  status: { type: String, enum: ['LIVE', 'UPCOMING', 'FINISHED', 'HIDDEN'], default: 'LIVE' },
  matchFormat: { type: String, default: 'T20' },
  startTime: { type: String, default: () => new Date().toISOString() },
  bannerUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  isPinned: { type: Boolean, default: false },
  team1: {
    name: { type: String, default: 'Team A' },
    shortName: { type: String, default: 'T1' },
    flag: { type: String, default: '' },
    score: { type: String, default: '' }
  },
  team2: {
    name: { type: String, default: 'Team B' },
    shortName: { type: String, default: 'T2' },
    flag: { type: String, default: '' },
    score: { type: String, default: '' }
  },
  streams: [StreamSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save update timestamp
MatchSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

let MatchModel;
try {
  MatchModel = mongoose.model('Match', MatchSchema);
} catch (e) {
  MatchModel = mongoose.model('Match');
}

module.exports = MatchModel;
