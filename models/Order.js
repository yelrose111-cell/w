const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    customerName: { 
        type: String, 
        required: true,
        maxlength: 100,
        trim: true
    },
    customerPhone: { 
        type: String, 
        required: true,
        match: /^[0-9+\-\s()]{8,20}$/,
        maxlength: 20
    },
    productId: { type: String, required: false },
    productTitle: { type: String, required: false, maxlength: 200, trim: true },
    productCoverUrl: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 1000, trim: true },
    cardData: {
        recipient: { type: String, maxlength: 100, trim: true },
        sender: { type: String, maxlength: 100, trim: true },
        message: { type: String, maxlength: 500, trim: true },
        fontFamily: { type: String, default: 'Tajawal', maxlength: 50 },
        fontSize: { type: String, default: '14pt', maxlength: 10 },
        textAlign: { 
            type: String, 
            default: 'center',
            enum: ['left', 'center', 'right']
        },
        templateStyle: { type: String, default: 'gold-frame', maxlength: 50 }
    },
    needsPrint: { type: Boolean, default: false },
    isGift: { type: Boolean, default: false },
    deliveryMethod: { 
        type: String,
        enum: ['pickup', 'delivery', 'توصيل', 'استلام من الفرع', '', null],
        default: null
    },
    status: { 
        type: String, 
        enum: ['pending', 'preparing', 'printed', 'ready', 'completed'], 
        default: 'pending',
        index: true 
    },
    pagerToken: { 
        type: String, 
        required: true,
        unique: true,
        match: /^[a-f0-9]{16,32}$/,
        default: () => require('crypto').randomBytes(16).toString('hex')
    },
    createdAt: { type: Date, default: Date.now, index: true },
    printedAt: { type: Date },
    readyAt: { type: Date },
    lastPingAt: { type: Date },
    lastCallAt: { type: Date },
    callType: { 
        type: String, 
        enum: ['arrived', 'help', 'ontheway', null],
        default: null
    },
    pushSubscription: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'PushSubscription', 
        default: null,
        index: true
    }
});

orderSchema.pre('validate', function(next) {
    if (this.deliveryMethod) {
        const val = this.deliveryMethod.toString().trim();
        if (val === 'توصيل' || val === 'delivery') {
            this.deliveryMethod = 'delivery';
        } else if (val === 'استلام من الفرع' || val === 'pickup') {
            this.deliveryMethod = 'pickup';
        } else if (val === '') {
            this.deliveryMethod = null;
        }
    } else {
        this.deliveryMethod = null;
    }
    next();
});

orderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
