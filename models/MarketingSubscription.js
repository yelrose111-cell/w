const mongoose = require('mongoose');

const marketingSubscriptionSchema = new mongoose.Schema({
    // نقطة النهاية الفريدة
    endpoint: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    
    // مفاتيح التشفير
    keys: {
        p256dh: { type: String, required: true, maxlength: 200 },
        auth:   { type: String, required: true, maxlength: 50 }
    },
    
    // نوع الجهاز
    deviceType: { 
        type: String, 
        enum: ['ios', 'android', 'desktop', 'unknown'],
        default: 'unknown' 
    },
    
    // اهتمامات العميل (للتقسيم الذكي)
    interests: [{
        type: String,
        enum: ['flowers', 'weddings', 'gifts', 'offers', 'events']
    }],
    
    // حالة الاشتراك
    isActive: { 
        type: Boolean, 
        default: true,
        index: true 
    },
    
    // الموافقة الصريحة (إلزامية قانونياً)
    consentedAt: { 
        type: Date, 
        required: true,
        default: Date.now 
    },
    consentMethod: { 
        type: String, 
        enum: ['in_app', 'qr', 'website'],
        default: 'in_app'
    },
    
    // إلغاء الاشتراك
    unsubscribedAt: { type: Date },
    unsubscribeReason: { type: String, maxlength: 200 },
    
    // إحصائيات التفاعل
    notificationsSent: { type: Number, default: 0 },
    notificationsOpened: { type: Number, default: 0 },
    lastNotificationAt: { type: Date },
    
    // ربط اختياري بطلب سابق
    linkedPagerToken: { 
        type: String,
        sparse: true 
    }
    
}, { timestamps: true });

// فهارس للحملات التسويقية
marketingSubscriptionSchema.index({ isActive: 1, interests: 1 });
marketingSubscriptionSchema.index({ consentedAt: -1 });

module.exports = mongoose.model('MarketingSubscription', marketingSubscriptionSchema);
