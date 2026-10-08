const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
    endpoint: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true }
    },
    pagerToken: {
        type: String,
        required: true,
        index: true
    },
    deviceType: {
        type: String,
        enum: ['ios', 'android', 'desktop', 'unknown'],
        default: 'unknown'
    },
    userAgent: { type: String, default: '' },
    createdAt:  { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// TTL: Auto delete after 90 days of no use
pushSubscriptionSchema.index(
    { lastUsedAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
