const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  thumbnailUrl: { type: String },
  name: { type: String },
  code: { type: String },
  publicId: { type: String },
  width: { type: Number },
  height: { type: Number },
  format: { type: String },
  bytes: { type: Number }
}, { _id: false });

const albumSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Custom string ID used in frontend (e.g. alb_yr_... or direct_bouquets)
  title: { type: String, required: true },
  category: { type: String, required: true },
  categoryName: { type: String },
  description: { type: String },
  coverUrl: { type: String },
  images: [imageSchema],
  featured: { type: Boolean, default: false },
  albumDate: { type: String }, // User-defined display date
  isDirectMode: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Album', albumSchema);
