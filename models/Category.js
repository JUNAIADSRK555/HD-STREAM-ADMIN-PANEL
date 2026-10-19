const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true },
  icon: { type: String, default: 'fas fa-play-circle' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

let CategoryModel;
try {
  CategoryModel = mongoose.model('Category', CategorySchema);
} catch (e) {
  CategoryModel = mongoose.model('Category');
}

module.exports = CategoryModel;
