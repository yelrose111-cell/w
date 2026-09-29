const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  coverUrl: { type: String },
  icon: { type: String },
  prefix: { type: String, default: 'YR' },
  order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
