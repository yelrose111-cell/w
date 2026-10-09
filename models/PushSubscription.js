const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema({
    endpoint: {
        type: String,
        required: true,
        unique: true,
        index: true,
        maxlength: 500
    },
    keys: {
        p256dh: { type: String, required: true, maxlength: 200 },
        auth:   { type: String, required: true, maxlength: 50 }
    },
    pagerToken: {
        type: String,
        required: true,
        index: true,
        match: /^[a-f0-9]{16,32}$/
    },
    deviceType: {
        type: String,
        enum: ['ios', 'android', 'desktop', 'unknown'],
        default: 'unknown'
    },
    userAgent: { 
        type: String, 
        default: '',
        maxlength: 500
    },
    lastUsedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

pushSubscriptionSchema.index(
    { lastUsedAt: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

pushSubscriptionSchema.index({ pagerToken: 1, lastUsedAt: -1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
