const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    ordersCount: {
        type: Number,
        default: 0
    },
    orders: [{
        orderId: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        productTitle: { type: String, default: '' },
        status: { type: String, default: 'pending' },
        pagerToken: { type: String, default: '' }
    }],
    lastOrderAt: {
        type: Date,
        default: Date.now
    },
    firstOrderAt: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        maxlength: 1500,
        trim: true,
        default: ''
    },
    tags: {
        type: [String],
        default: []
    },
    ratingSummary: {
        totalReviews: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

customerSchema.index({ name: 'text', notes: 'text' });
customerSchema.index({ lastOrderAt: -1 });

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
