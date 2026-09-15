const mongoose = require('mongoose');

const subcategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
  name: { type: String, required: true },
  coverUrl: { type: String },
  icon: { type: String },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Subcategory', subcategorySchema);
