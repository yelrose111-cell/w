const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    orderId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    rating: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 5 
    },
    comment: { 
        type: String, 
        maxlength: 500, 
        trim: true 
    },
    customerName: { 
        type: String, 
        maxlength: 100 
    },
    customerPhone: { 
        type: String 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Index للحساب السريع للمتوسط والترتيب حسب الأحدث
ratingSchema.index({ createdAt: -1 });
ratingSchema.index({ rating: 1 });

module.exports = mongoose.models.Rating || mongoose.model('Rating', ratingSchema);
