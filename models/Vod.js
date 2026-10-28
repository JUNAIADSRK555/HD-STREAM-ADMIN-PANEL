const mongoose = require('mongoose');

const EpisodeSchema = new mongoose.Schema({
  id: { type: String, default: () => 'ep_' + Math.random().toString(36).substr(2, 9) },
  episodeNumber: { type: Number, required: true },
  title: { type: String, required: true },
  duration: { type: String, default: '45m' },
  thumbnail: { type: String, default: '' },
  streamType: { type: String, default: 'M3U8' },
  streamUrl: { type: String, required: true },
  headers: {
    userAgent: { type: String, default: '' },
    referer: { type: String, default: '' }
  },
  drm: {
    enabled: { type: Boolean, default: false },
    scheme: { type: String, enum: ['clearkey', 'widevine', 'playready'], default: 'clearkey' },
    keyId: { type: String, default: '' },
    key: { type: String, default: '' }
  },
  isActive: { type: Boolean, default: true }
});

const VodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, default: 'Bigg Boss' },
  posterUrl: { type: String, default: '' },
  bannerUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  rating: { type: String, default: '8.5' },
  releaseYear: { type: String, default: '2026' },
  isFeatured: { type: Boolean, default: false },
  episodes: [EpisodeSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

VodSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

let VodModel;
try {
  VodModel = mongoose.model('Vod', VodSchema);
} catch (e) {
  VodModel = mongoose.model('Vod');
}

module.exports = VodModel;
