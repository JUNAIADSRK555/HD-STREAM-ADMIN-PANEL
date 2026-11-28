const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true },
  icon: { type: String, default: 'fas fa-play-circle' },
  imageUrl: { type: String, default: '' },
  m3uLink: { type: String, default: '' },
  type: { type: String, default: '' },
  server: { type: String, default: '' },
  username: { type: String, default: '' },
  password: { type: String, default: '' },
  portal_url: { type: String, default: '' },
  mac: { type: String, default: '' },
  serial: { type: String, default: '' },
  device_id_1: { type: String, default: '' },
  device_id_2: { type: String, default: '' },
  headers: { type: Object, default: {} },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

let CategoryModel;
try {
  CategoryModel = mongoose.model('Category', CategorySchema);
} catch (e) {
  CategoryModel = mongoose.model('Category');
}

module.exports = CategoryModel;
