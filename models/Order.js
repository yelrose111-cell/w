const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true }, // مثل: YR-2026-001
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  productId: { type: String, required: false },
  productTitle: { type: String, required: false },
  productCoverUrl: { type: String },
  cardData: {
    recipient: { type: String },
    sender: { type: String },
    message: { type: String, required: true },
    fontFamily: { type: String, default: 'Tajawal' },
    fontSize: { type: String, default: '14pt' },
    textAlign: { type: String, default: 'center' },
    templateStyle: { type: String, default: 'gold-frame' }
  },
  status: { type: String, enum: ['pending', 'printed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  printedAt: { type: Date }
});

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
