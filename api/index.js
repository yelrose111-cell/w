const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const SESSION_SECRET = process.env.SESSION_SECRET || 'de9b78b1b5f71c8e4c94781bcc53a299df102d741255a5c346cb43f7c154be27';
const DEFAULT_ADMIN_HASH = '1251125181e6a7ef27a0694b52c8ca7b4600c87e739a3bfdbecb1fc69e344e81'; // 55409
const DEFAULT_EMPLOYEE_HASH = '39d5ce6249548c318a5f0b6bf0a3e2f234750a9741b6ce2f9eff8670bc7cd7af'; // 4848

const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const Order = require('../models/Order');
const PushSubscription = require('../models/PushSubscription');
const Rating = require('../models/Rating');
const MarketingSubscription = require('../models/MarketingSubscription');
const Customer = require('../models/Customer');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:yelrose111@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
  );
}

const app = express();

// ✅ مهم جداً لبيئة Vercel Serverless
app.set('trust proxy', 1);

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://*.vercel.app", "https://*.cloudinary.com", "https://fcm.googleapis.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS - Restrictive
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://yelrose2026.vercel.app,https://yellowrose.com')
    .split(',').map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));  // Reduced from 50mb
app.use(cookieParser());

// ============================================
// MongoDB Connection (Serverless-Optimized)
// ============================================
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
    if (cached.conn) return cached.conn;
    
    if (!cached.promise) {
        cached.promise = mongoose.connect(process.env.MONGODB_URI, {
            bufferCommands: false,
            maxPoolSize: 2,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            family: 4
        });
    }
    
    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }
    return cached.conn;
}

// DB Connection Middleware
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB connection error:', err);
        return res.status(503).json({ success: false, error: 'Database unavailable' });
    }
});

// ============================================
// Dynamic PIN Retrieval (DB Settings with Env Fallback)
// ============================================
async function getAdminPinHash() {
    try {
        const pinDoc = await Settings.findOne({ key: 'auth_pins' }).lean();
        if (pinDoc && pinDoc.value && pinDoc.value.adminPinHash) {
            return pinDoc.value.adminPinHash;
        }
    } catch (e) {
        console.error('Error fetching admin PIN from DB:', e);
    }
    return process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_HASH;
}

async function getEmployeePinHash() {
    try {
        const pinDoc = await Settings.findOne({ key: 'auth_pins' }).lean();
        if (pinDoc && pinDoc.value && pinDoc.value.employeePinHash) {
            return pinDoc.value.employeePinHash;
        }
    } catch (e) {
        console.error('Error fetching employee PIN from DB:', e);
    }
    return process.env.EMPLOYEE_PIN_HASH || DEFAULT_EMPLOYEE_HASH;
}

// ============================================
// Secure Token Verification
// ============================================
function verifyToken(token) {
    if (!token) return { ok: false, error: 'No token' };
    
    try {
        const [payload, signature] = token.split('.');
        if (!payload || !signature) return { ok: false, error: 'Invalid format' };
        
        const expectedSignature = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(payload)
            .digest('hex');
        
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);
        
        if (sigBuffer.length !== expectedBuffer.length) {
            return { ok: false, error: 'Invalid signature' };
        }
        
        if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            return { ok: false, error: 'Invalid signature' };
        }
        
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        
        if (Date.now() > decodedPayload.exp) {
            return { ok: false, error: 'Token expired' };
        }
        
        return { ok: true, payload: decodedPayload };
    } catch (err) {
        return { ok: false, error: 'Token validation failed' };
    }
}

// Auth Middleware (Admin Only)
const authMiddleware = (req, res, next) => {
    const token = req.cookies.auth_token;
    const result = verifyToken(token);
    
    if (!result.ok) {
        return res.status(401).json({ success: false, error: `Unauthorized: ${result.error}` });
    }
    
    if (result.payload.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }
    
    req.user = result.payload;
    next();
};

// Staff Auth Middleware (Admin or Employee)
const employeeAuthMiddleware = (req, res, next) => {
    const token = req.cookies.auth_token;
    const result = verifyToken(token);
    
    if (!result.ok) {
        return res.status(401).json({ success: false, error: `Unauthorized: ${result.error}` });
    }
    
    if (result.payload.role !== 'admin' && result.payload.role !== 'employee') {
        return res.status(403).json({ success: false, error: 'Forbidden: Staff access required' });
    }
    
    req.user = result.payload;
    next();
};

// Secure Compare (for tokens)
function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false;
    }
}

// ============================================
// Rate Limiters
// ============================================
const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 50,
    message: { success: false, error: 'Too many login attempts' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many subscribe attempts' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const pingLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many ping attempts' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Too many refresh attempts' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const pagerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, error: 'Too many requests' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const ratingLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'تم تجاوز الحد المسموح للتقييم' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const marketingSubscribeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'محاولات اشتراك تسويقي كثيرة' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

const campaignLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { success: false, error: 'الحد الأقصى 3 حملات في الساعة' },
validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

// ============================================
// Dynamic Manifest
// ============================================
app.get('/api/manifest.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    const isPortal = req.query.app === 'portal';
    let token = req.query.token;
    if (token && !/^[a-f0-9]{16,32}$/.test(token)) {
        token = null;
    }

    let manifestName = "يلوروز | YELLOW ROSE للورد والمناسبات";
    let shortName = "يلوروز";
    let startUrl = "/?source=pwa";
    let description = "متجر وتطبيق يلوروز لتنسيقات الورد والمناسبات الفاخرة";

    if (isPortal) {
        manifestName = "منصة عمليات يلوروز | Operations Portal";
        shortName = "عمليات يلوروز";
        startUrl = "/portal.html?source=pwa";
        description = "منصة العمليات الموحدة وإدارة الطلبات والطباعة - يلوروز";
    } else if (token) {
        manifestName = "تتبع طلبك | Yellow Rose Pager";
        shortName = "بيجر يلوروز";
        startUrl = `/pager.html?token=${token}`;
        description = "نظام النداء والبيجر الآلي لمتجر يلوروز للورد";
    }
    
    res.json({
        name: manifestName,
        short_name: shortName,
        start_url: startUrl,
        display: "standalone",
        background_color: "#0a0a0d",
        theme_color: "#d4af37",
        description: description,
        icons: [
            { src: "/assets/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/assets/images/yr-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/assets/images/yr-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
    });
});

// ============================================
// Cloudinary
// ============================================
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

app.post('/api/cloudinary/sign', authMiddleware, (req, res) => {
    if (!process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({ success: false, error: 'Cloudinary not configured' });
    }
    
    const folder = req.body.folder || 'yellowrose';
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);
    
    res.json({ 
        success: true, 
        signature, 
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY
    });
});

// ============================================
// Auth Endpoints
// ============================================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const pin = (req.body?.pin || '').toString().trim();
        if (!pin) {
            return res.status(400).json({ success: false, error: 'الرجاء إدخال الرمز' });
        }
        
        const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
        const adminHash = await getAdminPinHash();
        const employeeHash = await getEmployeePinHash();
        
        let role = null;
        if (secureCompare(hashedPin, adminHash) || secureCompare(hashedPin, DEFAULT_ADMIN_HASH)) {
            role = 'admin';
        } else if (secureCompare(hashedPin, employeeHash) || secureCompare(hashedPin, DEFAULT_EMPLOYEE_HASH)) {
            role = 'employee';
        }
        
        if (!role) {
            return res.status(401).json({ success: false, error: 'رمز الدخول غير صحيح' });
        }
        
        const sessionDuration = role === 'admin' ? 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
        const payloadBase64 = Buffer.from(JSON.stringify({
            role: role,
            exp: Date.now() + sessionDuration
        })).toString('base64');
        
        const signature = crypto.createHmac('sha256', SESSION_SECRET)
            .update(payloadBase64).digest('hex');
        
        res.cookie('auth_token', `${payloadBase64}.${signature}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: sessionDuration
        });
        
        res.json({ success: true, role: role });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'خطأ في معالجة تسجيل الدخول' });
    }
});

app.post('/api/auth/employee-login', loginLimiter, async (req, res) => {
    try {
        const pin = (req.body?.pin || '').toString().trim();
        if (!pin) {
            return res.status(400).json({ success: false, error: 'الرجاء إدخال الرمز' });
        }
        
        const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
        const adminHash = await getAdminPinHash();
        const employeeHash = await getEmployeePinHash();
        
        let role = null;
        if (secureCompare(hashedPin, employeeHash) || secureCompare(hashedPin, DEFAULT_EMPLOYEE_HASH)) {
            role = 'employee';
        } else if (secureCompare(hashedPin, adminHash) || secureCompare(hashedPin, DEFAULT_ADMIN_HASH)) {
            role = 'admin';
        }
        
        if (!role) {
            return res.status(401).json({ success: false, error: 'رمز الدخول غير صحيح' });
        }
        
        const sessionDuration = role === 'admin' ? 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
        const payloadBase64 = Buffer.from(JSON.stringify({
            role: role,
            exp: Date.now() + sessionDuration
        })).toString('base64');
        
        const signature = crypto.createHmac('sha256', SESSION_SECRET)
            .update(payloadBase64).digest('hex');
        
        res.cookie('auth_token', `${payloadBase64}.${signature}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: sessionDuration
        });
        
        res.json({ success: true, role: role });
    } catch (err) {
        console.error('Employee login error:', err);
        res.status(500).json({ success: false, error: 'خطأ في معالجة تسجيل الدخول' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
    const result = verifyToken(req.cookies.auth_token);
    if (result.ok) {
        return res.json({ 
            authenticated: true, 
            role: result.payload?.role, 
            exp: result.payload?.exp 
        });
    }
    res.json({ authenticated: false, role: null });
});

// ============================================
// E-Commerce Endpoints
// ============================================
app.get('/api/categories', async (req, res) => {
    try {
        const items = await Category.find().sort({ order: 1, createdAt: 1 }).lean();
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.json(items);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/categories', authMiddleware, async (req, res) => {
    try {
        const data = req.body;
        if (data.order !== undefined) {
            const order = parseInt(data.order);
            data.order = (isNaN(order) || order < 0) ? 0 : order;
        }
        if (!data.id) data.id = `cat_${Date.now()}`;
        const saved = await Category.findOneAndUpdate({ id: data.id }, data, { returnDocument: 'after', upsert: true });
        res.status(201).json({ success: true, category: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/categories/:id', authMiddleware, async (req, res) => {
    try {
        const categoryId = req.params.id;
        await Category.findOneAndDelete({ id: categoryId });
        await Subcategory.deleteMany({ categoryId });
        await Product.deleteMany({ categoryId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/subcategories', async (req, res) => {
    try {
        const items = await Subcategory.find().sort({ order: 1, createdAt: 1 }).lean();
        res.json(items);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/subcategories', authMiddleware, async (req, res) => {
    try {
        const data = req.body;
        if (data.order !== undefined) {
            const order = parseInt(data.order);
            data.order = (isNaN(order) || order < 0) ? 0 : order;
        }
        if (!data.id) data.id = `subcat_${Date.now()}`;
        const saved = await Subcategory.findOneAndUpdate({ id: data.id }, data, { returnDocument: 'after', upsert: true });
        res.status(201).json({ success: true, subcategory: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/subcategories/:id', authMiddleware, async (req, res) => {
    try {
        await Subcategory.findOneAndDelete({ id: req.params.id });
        await Product.deleteMany({ subcategoryId: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const items = await Product.find().sort({ createdAt: -1 }).lean();
        res.json(items);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/products', authMiddleware, async (req, res) => {
    try {
        const data = req.body;
        if (!data.id) data.id = `prod_${Date.now()}`;
        
        if (data.isFeatured !== undefined && data.featured === undefined) {
            data.featured = !!data.isFeatured;
        }
        if (data.showPrice === undefined) {
            data.showPrice = true;
        }
        
        if (!data.productCode && data.categoryId) {
            const cat = await Category.findOne({ id: data.categoryId });
            const prefix = cat ? (cat.prefix || 'YR') : 'YR';
            const existingProducts = await Product.find({ productCode: new RegExp(`^${prefix}-`) });
            let maxNum = 0;
            for (const p of existingProducts) {
                if (p.productCode) {
                    const parts = p.productCode.split('-');
                    if (parts.length === 2 && !isNaN(parts[1])) {
                        maxNum = Math.max(maxNum, parseInt(parts[1], 10));
                    }
                }
            }
            data.productCode = `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
        }
        
        if (data.productCode && data.images && data.images.length > 0) {
            data.images.forEach((img, idx) => {
                if (!img.code) {
                    img.code = data.images.length === 1 ? data.productCode : `${data.productCode}-${idx + 1}`;
                }
            });
        }
        
        const saved = await Product.findOneAndUpdate({ id: data.id }, data, { returnDocument: 'after', upsert: true });
        res.status(201).json({ success: true, product: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    try {
        await Product.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Settings
// ============================================
app.get('/api/settings', async (req, res) => {
    try {
        const settingsDoc = await Settings.findOne({ key: 'site_settings' });
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        if (settingsDoc && settingsDoc.value) {
            const val = settingsDoc.value;
            delete val.cloudinaryName;
            delete val.cloudinaryPreset;
            delete val.jsonbinKey;
            delete val.jsonbinBinId;
            delete val.adminPinHash;
            res.json(val);
        } else {
            res.json({});
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/settings', authMiddleware, async (req, res) => {
    try {
        await Settings.findOneAndUpdate(
            { key: 'site_settings' },
            { value: req.body },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Dynamic PIN Management (Admin Only)
// ============================================
app.post('/api/settings/pins', authMiddleware, async (req, res) => {
    try {
        const { adminPin, employeePin } = req.body;
        if (!adminPin && !employeePin) {
            return res.status(400).json({ success: false, error: 'يجب إدخال رمز جديد لتحديثه' });
        }
        
        const existing = await Settings.findOne({ key: 'auth_pins' });
        const pinData = (existing && existing.value) ? { ...existing.value } : {
            adminPinHash: DEFAULT_ADMIN_HASH,
            employeePinHash: DEFAULT_EMPLOYEE_HASH
        };
        
        if (adminPin) {
            const cleanAdmin = adminPin.toString().trim();
            if (cleanAdmin.length < 4 || cleanAdmin.length > 20) {
                return res.status(400).json({ success: false, error: 'رمز المدير يجب أن يكون بين 4 إلى 20 خانة' });
            }
            pinData.adminPinHash = crypto.createHash('sha256').update(cleanAdmin).digest('hex');
        }
        
        if (employeePin) {
            const cleanEmp = employeePin.toString().trim();
            if (cleanEmp.length < 4 || cleanEmp.length > 20) {
                return res.status(400).json({ success: false, error: 'رمز الموظف يجب أن يكون بين 4 إلى 20 خانة' });
            }
            pinData.employeePinHash = crypto.createHash('sha256').update(cleanEmp).digest('hex');
        }
        
        pinData.updatedAt = new Date();
        
        await Settings.findOneAndUpdate(
            { key: 'auth_pins' },
            { value: pinData },
            { upsert: true }
        );
        
        res.json({ success: true, message: 'تم تحديث الرموز بنجاح' });
    } catch (err) {
        console.error('Update PINs error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================
// Orders & Pager System
// ============================================
async function generateUniqueOrderId() {
    for (let attempts = 0; attempts < 10; attempts++) {
        const randomNum = crypto.randomInt(100000, 999999);
        const candidateId = `YR-${randomNum}`;
        const exists = await Order.exists({ orderId: candidateId });
        if (!exists) return candidateId;
    }
    return `YR-${Date.now().toString().slice(-6)}`;
}

app.post('/api/orders', async (req, res) => {
    try {
        const data = req.body;
        if (!data.orderId || data.orderId.includes('Math.random')) {
            data.orderId = await generateUniqueOrderId();
        } else {
            // التحقق من التفرد
            const exists = await Order.exists({ orderId: data.orderId });
            if (exists) {
                data.orderId = await generateUniqueOrderId();
            }
        }
        
        // Normalize deliveryMethod
        if (data.deliveryMethod) {
            const dm = data.deliveryMethod.toString().trim();
            if (dm === 'توصيل' || dm === 'delivery') data.deliveryMethod = 'delivery';
            else if (dm === 'استلام من الفرع' || dm === 'pickup') data.deliveryMethod = 'pickup';
            else data.deliveryMethod = null;
        } else {
            data.deliveryMethod = null;
        }
        
        const saved = await Order.create(data);

        // تسجيل / تحديث العميل في قاعدة بيانات وسجل العملاء CRM تلقائياً
        if (saved.customerPhone && saved.customerPhone.trim() && saved.customerPhone.trim() !== '0000000000') {
            const cPhone = saved.customerPhone.trim();
            try {
                await Customer.findOneAndUpdate(
                    { phone: cPhone },
                    {
                        $setOnInsert: { firstOrderAt: saved.createdAt || new Date() },
                        $set: { 
                            name: saved.customerName && saved.customerName !== 'عميل' ? saved.customerName : undefined,
                            lastOrderAt: saved.createdAt || new Date(),
                            updatedAt: new Date()
                        },
                        $inc: { ordersCount: 1 },
                        $push: {
                            orders: {
                                orderId: saved.orderId,
                                createdAt: saved.createdAt || new Date(),
                                productTitle: saved.productTitle || '',
                                status: saved.status,
                                pagerToken: saved.pagerToken
                            }
                        }
                    },
                    { upsert: true, returnDocument: 'after' }
                );
            } catch (custErr) {
                console.error('Customer CRM upsert error:', custErr.message);
            }
        }

        res.status(201).json({ success: true, order: saved });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/orders', employeeAuthMiddleware, async (req, res) => {
    try {
        const status = req.query.status;
        const filter = status && status !== 'all' ? { status } : {};
        const items = await Order.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        
        if (items.length > 0) {
            const orderIds = items.map(o => o.orderId);
            const ratings = await Rating.find({ orderId: { $in: orderIds } }).lean();
            const ratingMap = {};
            ratings.forEach(r => {
                ratingMap[r.orderId] = { rating: r.rating, comment: r.comment, createdAt: r.createdAt };
            });
            items.forEach(o => {
                if (ratingMap[o.orderId]) {
                    o.review = ratingMap[o.orderId];
                }
            });
        }
        
        res.json({ success: true, orders: items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch('/api/orders/:id/print', employeeAuthMiddleware, async (req, res) => {
    try {
        const updated = await Order.findOneAndUpdate(
            { orderId: req.params.id },
            { status: 'printed', printedAt: new Date() },
            { returnDocument: 'after' }
        );
        res.json({ success: true, order: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch('/api/orders/:id/status', employeeAuthMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const updateData = { status };
        if (status === 'ready') updateData.readyAt = new Date();
        
        const updated = await Order.findOneAndUpdate(
            { orderId: req.params.id },
            updateData,
            { returnDocument: 'after' }
        );
        res.json({ success: true, order: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Order Deletion API (Admin Only - صلاحية حذف الطلب للمدير)
// ============================================
app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود في قاعدة البيانات' });
        }

        // 1. حذف التقييمات المرتبطة بالطلب
        await Rating.deleteMany({ orderId }).catch(() => {});

        // 2. تحديث سجل العميل إن وُجد
        if (order.customerPhone) {
            await Customer.findOneAndUpdate(
                { phone: order.customerPhone.trim() },
                {
                    $pull: { orders: { orderId: order.orderId } },
                    $inc: { ordersCount: -1 }
                }
            ).catch(() => {});
        }

        // 3. حذف الطلب بشكل نهائي ومن الجذور
        await Order.deleteOne({ orderId });

        res.json({ success: true, message: `تم حذف الطلب ${orderId} نهائياً بنجاح` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/orders/:id/ping', employeeAuthMiddleware, pingLimiter, async (req, res) => {
    try {
        const updated = await Order.findOneAndUpdate(
            { orderId: req.params.id },
            { lastPingAt: new Date() },
            { returnDocument: 'after' }
        );
        
        if (!updated) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        if (updated.pushSubscription && process.env.VAPID_PUBLIC_KEY) {
            try {
                const subDoc = await PushSubscription.findById(updated.pushSubscription).lean();
                if (subDoc) {
                    const payload = JSON.stringify({
                        title: 'Yellow Rose ✨',
                        body: `طلبك رقم ${updated.orderId} جاهز للاستلام!`,
                        url: `/pager.html?token=${updated.pagerToken}`,
                        orderId: updated.orderId
                    });
                    
                    // ✅ FIX: Add timeout to webpush
                    const pushPromise = webpush.sendNotification({
                        endpoint: subDoc.endpoint,
                        keys: { p256dh: subDoc.keys.p256dh, auth: subDoc.keys.auth }
                    }, payload);
                    
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Push timeout')), 5000)
                    );
                    
                    await Promise.race([pushPromise, timeoutPromise]);
                    await PushSubscription.findByIdAndUpdate(subDoc._id, { lastUsedAt: new Date() }).catch(() => {});
                }
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await PushSubscription.findByIdAndDelete(updated.pushSubscription).catch(() => {});
                    await Order.findOneAndUpdate({ orderId: req.params.id }, { pushSubscription: null }).catch(() => {});
                }
                console.error('Push error:', err.message);
            }
        }
        
        res.json({ success: true, order: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/pager/:token', pagerLimiter, async (req, res) => {
    try {
        const identifier = (req.params.token || '').trim();
        let order = null;
        
        // 1. فحص إذا كان pagerToken الأصلي (16-32 hex)
        if (/^[a-f0-9]{16,32}$/i.test(identifier)) {
            order = await Order.findOne({ pagerToken: identifier.toLowerCase() }).lean();
        }
        
        // 2. فحص برقم الطلب العشوائي (YR-XXXXXX أو XXXXXX أو الصيغ السابقة)
        if (!order) {
            const cleanId = identifier.toUpperCase();
            const formattedId = cleanId.startsWith('YR-') ? cleanId : `YR-${cleanId}`;
            order = await Order.findOne({
                $or: [
                    { orderId: cleanId },
                    { orderId: formattedId }
                ]
            }).lean();
        }
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }
        
        res.json({ 
            success: true, 
            status: order.status, 
            orderId: order.orderId, 
            pagerToken: order.pagerToken,
            lastPingAt: order.lastPingAt 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// نداء من العميل للموظف (Reverse Paging)
// ============================================
const callLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    message: { success: false, error: 'انتظر قليلاً قبل إعادة النداء' },
    validate: { xForwardedForHeader: false, forwardedHeader: false, ip: false }
});

app.post('/api/pager/:token/call', callLimiter, async (req, res) => {
    try {
        const identifier = (req.params.token || '').trim();
        const callType = req.body?.type || 'arrived';
        const validTypes = ['arrived', 'help', 'ontheway'];
        if (!validTypes.includes(callType)) {
            return res.status(400).json({ success: false, error: 'نوع نداء غير صالح' });
        }
        
        const cleanId = identifier.toUpperCase();
        const formattedId = cleanId.startsWith('YR-') ? cleanId : `YR-${cleanId}`;
        
        const order = await Order.findOneAndUpdate(
            { 
                $or: [
                    { pagerToken: identifier.toLowerCase() },
                    { orderId: cleanId },
                    { orderId: formattedId }
                ]
            },
            { 
                lastCallAt: new Date(),
                callType: callType
            },
            { returnDocument: 'after' }
        );
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }
        
        console.log(`[CALL] order=${order.orderId}, type=${callType}`);
        
        res.json({ 
            success: true, 
            orderId: order.orderId, 
            message: 'تم إرسال النداء للموظف' 
        });
        
    } catch (error) {
        console.error('[CALL] Error:', error);
        res.status(500).json({ success: false, error: 'خطأ في السيرفر' });
    }
});

// ============================================
// Push Subscriptions
// ============================================
app.post('/api/push/subscribe', subscribeLimiter, async (req, res) => {
    try {
        const { pagerToken, subscription, deviceType, userAgent } = req.body;
        
        if (!pagerToken || !subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, error: 'بيانات غير مكتملة' });
        }
        
        // Validate token format
        if (!/^[a-f0-9]{16,32}$/.test(pagerToken)) {
            return res.status(400).json({ success: false, error: 'Token غير صالح' });
        }
        
        const orderExists = await Order.exists({ pagerToken });
        if (!orderExists) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }
        
        const subDoc = await PushSubscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                $set: {
                    keys: {
                        p256dh: subscription.keys.p256dh,
                        auth: subscription.keys.auth
                    },
                    pagerToken: pagerToken,
                    deviceType: deviceType || 'unknown',
                    userAgent: userAgent || '',
                    lastUsedAt: new Date()
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        
        await Order.findOneAndUpdate(
            { pagerToken },
            { pushSubscription: subDoc._id }
        );
        
        res.json({ success: true, subscriptionId: subDoc._id });
    } catch (err) {
        if (err.code === 11000) {
            // Race condition - subscription already exists
            const existingSub = await PushSubscription.findOne({ endpoint: req.body.subscription.endpoint });
            if (existingSub) {
                await Order.findOneAndUpdate(
                    { pagerToken: req.body.pagerToken },
                    { pushSubscription: existingSub._id }
                );
                return res.json({ success: true, subscriptionId: existingSub._id });
            }
        }
        console.error('Subscribe error:', err);
        res.status(500).json({ success: false, error: 'خطأ في السيرفر' });
    }
});

app.post('/api/push/refresh-subscription', refreshLimiter, async (req, res) => {
    try {
        const { oldEndpoint, newSubscription, pagerToken } = req.body;
        
        if (!oldEndpoint || !pagerToken) {
            return res.status(400).json({ success: false, error: 'بيانات غير مكتملة' });
        }
        
        // Validate token format
        if (!/^[a-f0-9]{16,32}$/.test(pagerToken)) {
            return res.status(400).json({ success: false, error: 'Token غير صالح' });
        }
        
        const oldSub = await PushSubscription.findOne({ endpoint: oldEndpoint }).lean();
        if (!oldSub) return res.status(404).json({ success: false, error: 'الاشتراك غير موجود' });
        
        // ✅ FIX: Use secureCompare instead of !==
        if (!secureCompare(oldSub.pagerToken, pagerToken)) {
            console.warn(`🚨 UNAUTHORIZED_REFRESH_ATTEMPT: ip=${req.ip}`);
            return res.status(403).json({ success: false, error: 'غير مصرح' });
        }
        
        if (!newSubscription) {
            await Order.findOneAndUpdate({ pagerToken }, { pushSubscription: null });
            await PushSubscription.findByIdAndDelete(oldSub._id);
        } else if (newSubscription.endpoint === oldEndpoint) {
            await PushSubscription.findByIdAndUpdate(oldSub._id, {
                $set: { keys: newSubscription.keys, lastUsedAt: new Date() }
            });
        } else {
            const newSubDoc = await PushSubscription.create({
                endpoint: newSubscription.endpoint,
                keys: newSubscription.keys,
                pagerToken: pagerToken,
                deviceType: oldSub.deviceType,
                userAgent: oldSub.userAgent,
                lastUsedAt: new Date()
            });
            await Order.findOneAndUpdate({ pagerToken }, { pushSubscription: newSubDoc._id });
            await PushSubscription.findByIdAndDelete(oldSub._id);
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Refresh sub error:', err);
        res.status(500).json({ success: false, error: 'خطأ في السيرفر' });
    }
});

// ============================================
// Migration (SECURED - Requires Auth)
// ============================================
app.get('/api/migrate-codes', authMiddleware, async (req, res) => {
    try {
        const categories = await Category.find().lean();
        const categoryPrefixMap = {};
        const catOps = [];
        
        for (const cat of categories) {
            let prefix = cat.prefix || 'YR';
            const catName = cat.name || '';
            if (!cat.prefix || cat.prefix === 'YR') {
                if (catName.includes('باقات')) prefix = 'YF';
                else if (catName.includes('فازات')) prefix = 'YV';
                else if (catName.includes('شوكولاتة') || catName.includes('شوكلاته')) prefix = 'YC';
                else if (catName.includes('هدايا') || catName.includes('تغليف')) prefix = 'YG';
                else if (catName.includes('مسكات') || catName.includes('عرايس')) prefix = 'YW';
                else if (catName.includes('مواليد')) prefix = 'YN';
                else if (catName.includes('نباتات')) prefix = 'YP';
            }
            
            categoryPrefixMap[cat.id] = prefix;
            catOps.push({
                updateOne: {
                    filter: { id: cat.id },
                    update: { $set: { prefix: prefix } }
                }
            });
        }
        
        if (catOps.length > 0) await Category.bulkWrite(catOps);

        // Migrate and assign codes to products if missing
        const products = await Product.find().lean();
        const prodOps = [];
        const counters = {};

        // Find existing max counters per prefix
        for (const p of products) {
            if (p.productCode && p.productCode.includes('-')) {
                const parts = p.productCode.split('-');
                const pPrefix = parts[0];
                const pNum = parseInt(parts[1], 10);
                if (!isNaN(pNum)) {
                    counters[pPrefix] = Math.max(counters[pPrefix] || 0, pNum);
                }
            }
        }

        let updatedProductsCount = 0;
        for (const p of products) {
            const updates = {};
            if (p.showPrice === undefined) {
                updates.showPrice = true;
            }
            if (!p.productCode || p.productCode === 'YR-00' || p.productCode === '') {
                const prefix = categoryPrefixMap[p.categoryId] || 'YR';
                counters[prefix] = (counters[prefix] || 0) + 1;
                const newCode = `${prefix}-${String(counters[prefix]).padStart(2, '0')}`;
                updates.productCode = newCode;

                if (Array.isArray(p.images) && p.images.length > 0) {
                    updates.images = p.images.map((img, idx) => {
                        const imgObj = typeof img === 'string' ? { url: img } : { ...img };
                        if (!imgObj.code) {
                            imgObj.code = p.images.length === 1 ? newCode : `${newCode}-${idx + 1}`;
                        }
                        return imgObj;
                    });
                }
            }

            if (Object.keys(updates).length > 0) {
                updatedProductsCount++;
                prodOps.push({
                    updateOne: {
                        filter: { id: p.id },
                        update: { $set: updates }
                    }
                });
            }
        }

        if (prodOps.length > 0) await Product.bulkWrite(prodOps);
        
        res.json({ 
            success: true, 
            message: `تم تحديث ${categories.length} أقسام وتوليد/تهيئة أكواد ${updatedProductsCount} منتجات بنجاح!` 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Ratings
// ============================================
app.post('/api/ratings', ratingLimiter, async (req, res) => {
    try {
        let { orderId, rating, comment } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ success: false, error: 'رقم الطلب مطلوب' });
        }
        
        const rawId = String(orderId).trim().toUpperCase();
        const formattedId = rawId.startsWith('YR-') ? rawId : `YR-${rawId}`;

        if (!/^[A-Z]{2,3}-[\dA-Z-]{4,15}$/i.test(formattedId)) {
            return res.status(400).json({ success: false, error: 'صيغة رقم الطلب غير صحيحة' });
        }
        
        if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, error: 'يرجى اختيار عدد النجوم (من 1 إلى 5)' });
        }
        
        const order = await Order.findOne({
            $or: [
                { orderId: rawId },
                { orderId: formattedId }
            ]
        }).lean();

        if (!order) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود في النظام' });
        }

        const targetOrderId = order.orderId;

        const existingRating = await Rating.findOne({ orderId: targetOrderId });
        if (existingRating) {
            return res.status(400).json({ success: false, error: 'لقد قمت بتقييم هذا الطلب مسبقاً، شكراً لك!' });
        }

        const savedRating = await Rating.create({
            orderId: targetOrderId,
            rating,
            comment: comment ? String(comment).trim() : '',
            customerName: order.customerName,
            customerPhone: order.customerPhone
        });

        res.status(201).json({ success: true, rating: savedRating });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'لقد قمت بتقييم هذا الطلب مسبقاً' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ratings', employeeAuthMiddleware, async (req, res) => {
    try {
        const ratings = await Rating.find().sort({ createdAt: -1 }).limit(100).lean();
        res.json({ success: true, ratings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/ratings/avg', async (req, res) => {
    try {
        const result = await Rating.aggregate([
            { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        if (result.length > 0) {
            res.json({ success: true, average: result[0].avgRating.toFixed(1), total: result[0].count });
        } else {
            res.json({ success: true, average: 0, total: 0 });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// 13. نظام الإشعارات التسويقية
// ============================================

// الاشتراك في الإشعارات التسويقية
app.post('/api/marketing/subscribe', marketingSubscribeLimiter, async (req, res) => {
    try {
        const { subscription, interests, consent, linkedPagerToken } = req.body;
        
        // الموافقة الصريحة إلزامية قانونياً
        if (!consent || consent !== true) {
            return res.status(400).json({ success: false, error: 'يجب الموافقة على شروط الإشعارات التسويقية' });
        }
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, error: 'بيانات الاشتراك غير مكتملة' });
        }
        
        const validInterests = ['flowers', 'weddings', 'gifts', 'offers', 'events'];
        const safeInterests = (interests || []).filter(i => validInterests.includes(i));
        
        const savedSub = await MarketingSubscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                $set: {
                    keys: subscription.keys,
                    interests: safeInterests,
                    isActive: true,
                    linkedPagerToken: linkedPagerToken || null,
                    unsubscribedAt: null,
                    unsubscribeReason: null
                },
                $setOnInsert: {
                    endpoint: subscription.endpoint,
                    deviceType: req.body.deviceType || 'unknown',
                    consentedAt: new Date(),
                    consentMethod: 'in_app'
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        
        console.log(`[MARKETING] New subscriber: ${savedSub._id}`);
        res.json({ success: true, subscriptionId: savedSub._id });
        
    } catch (error) {
        console.error('[MARKETING] Subscribe error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// إلغاء الاشتراك (حق المستخدم القانوني)
app.post('/api/marketing/unsubscribe', async (req, res) => {
    try {
        const { endpoint, reason } = req.body;
        if (!endpoint) return res.status(400).json({ success: false, error: 'بيانات غير مكتملة' });
        
        await MarketingSubscription.findOneAndUpdate(
            { endpoint },
            { isActive: false, unsubscribedAt: new Date(), unsubscribeReason: reason || '' }
        );
        
        console.log(`[MARKETING] Unsubscribed: ${endpoint.substring(0, 50)}...`);
        res.json({ success: true });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إرسال حملة تسويقية (للموظف فقط)
app.post('/api/marketing/campaign', employeeAuthMiddleware, campaignLimiter, async (req, res) => {
    try {
        const { title, body, url, interests, sendToAll } = req.body;
        
        if (!title || !body) return res.status(400).json({ success: false, error: 'العنوان والمحتوى مطلوبان' });
        if (title.length > 100 || body.length > 200) return res.status(400).json({ success: false, error: 'النص طويل جداً' });
        
        let safeUrl = url || 'https://yelrose2026.vercel.app';
        if (!safeUrl.startsWith('https://yelrose2026.vercel.app') && !safeUrl.startsWith('/')) {
            return res.status(400).json({ success: false, error: 'الرابط يجب أن يكون ضمن نطاق المتجر' });
        }
        
        const filter = { isActive: true };
        if (!sendToAll && interests && interests.length > 0) filter.interests = { $in: interests };
        
        const subscribers = await MarketingSubscription.find(filter).lean();
        if (subscribers.length === 0) return res.json({ success: true, sent: 0, message: 'لا يوجد مشتركون مطابقون' });
        
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const eligibleSubscribers = subscribers.filter(s => !s.lastNotificationAt || s.lastNotificationAt < oneDayAgo);
        
        if (eligibleSubscribers.length === 0) return res.json({ success: true, sent: 0, message: 'جميع المشتركين استلموا إشعاراً مؤخراً' });
        
        const payload = JSON.stringify({ title: `🌹 ${title}`, body: body, url: safeUrl, type: 'marketing' });
        
        let successCount = 0;
        let failedCount = 0;
        
        const batchSize = 50;
        for (let i = 0; i < eligibleSubscribers.length; i += batchSize) {
            const batch = eligibleSubscribers.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(async (sub) => {
                    try {
                        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
                        await MarketingSubscription.findByIdAndUpdate(sub._id, { $inc: { notificationsSent: 1 }, lastNotificationAt: new Date() });
                        return true;
                    } catch (err) {
                        if (err.statusCode === 410 || err.statusCode === 404) await MarketingSubscription.findByIdAndDelete(sub._id);
                        return false;
                    }
                })
            );
            successCount += results.filter(r => r.value === true).length;
            failedCount += results.filter(r => r.value === false).length;
            if (i + batchSize < eligibleSubscribers.length) await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        res.json({ success: true, sent: successCount, failed: failedCount, total: eligibleSubscribers.length, message: `تم إرسال الإشعار إلى ${successCount} مشترك` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// إحصائيات التسويق (للموظف)
app.get('/api/marketing/stats', employeeAuthMiddleware, async (req, res) => {
    try {
        const totalActive = await MarketingSubscription.countDocuments({ isActive: true });
        const totalUnsubscribed = await MarketingSubscription.countDocuments({ isActive: false });
        
        const byInterest = await MarketingSubscription.aggregate([
            { $match: { isActive: true } },
            { $unwind: '$interests' },
            { $group: { _id: '$interests', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        const byDevice = await MarketingSubscription.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$deviceType', count: { $sum: 1 } } }
        ]);
        
        const last7Days = await MarketingSubscription.countDocuments({
            consentedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        
        res.json({
            success: true,
            stats: { totalActive, totalUnsubscribed, newLast7Days: last7Days, byInterest, byDevice }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Health Check
// ============================================
app.get('/api/health', async (req, res) => {
    try {
        await Order.findOne().lean();  // Test actual DB connection
        res.json({ 
            status: 'ok', 
            dbConnected: mongoose.connection.readyState === 1,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(503).json({ status: 'unhealthy', error: err.message });
    }
});

// ============================================
// Deep Linking (/p/:token) & Share Target
// ============================================
app.get('/p/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const identifier = (req.params.token || '').trim();
        let order = null;
        
        // 1. فحص إذا كان pagerToken الأصلي (16-32 hex)
        if (/^[a-f0-9]{16,32}$/i.test(identifier)) {
            order = await Order.findOne({ pagerToken: identifier.toLowerCase() }).lean();
        }
        
        // 2. فحص برقم الطلب (YR-XXXXXX أو XXXXXX أو الصيغ السابقة)
        if (!order) {
            const cleanId = identifier.toUpperCase();
            const formattedId = cleanId.startsWith('YR-') ? cleanId : `YR-${cleanId}`;
            order = await Order.findOne({
                $or: [
                    { orderId: cleanId },
                    { orderId: formattedId }
                ]
            }).lean();
        }
        
        if (!order) {
            return res.status(404).send(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>الطلب غير موجود - Yellow Rose</title>
                </head>
                <body style="text-align:center; padding:50px 20px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#111; color:#fff;">
                    <h1 style="color:#e74c3c;">❌ الطلب غير موجود</h1>
                    <p style="color:#aaa; font-size:16px;">تأكد من صحة رقم الطلب أو تواصل مع المتجر</p>
                    <a href="/" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#d4af37; color:#111; text-decoration:none; border-radius:8px; font-weight:bold;">العودة للصفحة الرئيسية</a>
                </body>
                </html>
            `);
        }

        // إعادة التوجيه للرابط الأصلي المتوافق مع النظام
        res.redirect(`/pager.html?token=${encodeURIComponent(order.pagerToken)}`);
    } catch (error) {
        console.error('Deep link error:', error);
        res.status(500).send('خطأ في السيرفر');
    }
});

app.get('/share-target', (req, res) => {
    const { url } = req.query;
    if (url) {
        return res.redirect(url);
    }
    res.redirect('/');
});

// ============================================
// Customers CRM API (Admin Only - قاعدة وسجل العملاء للمدير)
// ============================================
app.get('/api/customers', authMiddleware, async (req, res) => {
    try {
        const { search = '', sort = 'lastOrderAt', limit = 200, page = 1 } = req.query;
        let query = {};
        if (search && search.trim()) {
            const s = search.trim();
            query = {
                $or: [
                    { name: { $regex: s, $options: 'i' } },
                    { phone: { $regex: s, $options: 'i' } },
                    { notes: { $regex: s, $options: 'i' } }
                ]
            };
        }

        let sortObj = { lastOrderAt: -1 };
        if (sort === 'ordersCount') sortObj = { ordersCount: -1 };
        if (sort === 'name') sortObj = { name: 1 };
        if (sort === 'oldest') sortObj = { firstOrderAt: 1 };

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 200));
        const skip = (pageNum - 1) * limitNum;

        const customers = await Customer.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const totalFiltered = await Customer.countDocuments(query);
        const totalCustomers = await Customer.countDocuments();
        const repeatCustomers = await Customer.countDocuments({ ordersCount: { $gt: 1 } });
        
        // حساب إجمالي طلبات العملاء المسجلين
        const ordersAgg = await Customer.aggregate([
            { $group: { _id: null, totalOrders: { $sum: '$ordersCount' } } }
        ]);
        const totalCustomerOrders = ordersAgg.length > 0 ? ordersAgg[0].totalOrders : 0;

        res.json({
            success: true,
            customers,
            totalCount: totalFiltered,
            stats: {
                totalCustomers,
                repeatCustomers,
                totalCustomerOrders
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/customers/:phone', authMiddleware, async (req, res) => {
    try {
        const phone = (req.params.phone || '').trim();
        const customer = await Customer.findOne({ phone }).lean();
        if (!customer) {
            return res.status(404).json({ success: false, error: 'العميل غير مسجل' });
        }
        res.json({ success: true, customer });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/customers/sync', authMiddleware, async (req, res) => {
    try {
        const orders = await Order.find({}).sort({ createdAt: 1 }).lean();
        const customerMap = {};

        for (const ord of orders) {
            const rawPhone = (ord.customerPhone || '').trim();
            if (!rawPhone || rawPhone === '0000000000') continue;

            if (!customerMap[rawPhone]) {
                customerMap[rawPhone] = {
                    phone: rawPhone,
                    name: ord.customerName || 'عميل يلوروز',
                    ordersCount: 0,
                    firstOrderAt: ord.createdAt || new Date(),
                    lastOrderAt: ord.createdAt || new Date(),
                    orders: []
                };
            }

            customerMap[rawPhone].ordersCount += 1;
            customerMap[rawPhone].lastOrderAt = ord.createdAt || customerMap[rawPhone].lastOrderAt;
            if (ord.customerName && ord.customerName.length > 1 && ord.customerName !== 'عميل') {
                customerMap[rawPhone].name = ord.customerName;
            }
            customerMap[rawPhone].orders.push({
                orderId: ord.orderId,
                createdAt: ord.createdAt,
                productTitle: ord.productTitle || '',
                status: ord.status,
                pagerToken: ord.pagerToken
            });
        }

        let count = 0;
        for (const phone in customerMap) {
            const data = customerMap[phone];
            await Customer.findOneAndUpdate(
                { phone },
                {
                    $set: {
                        name: data.name,
                        ordersCount: data.ordersCount,
                        firstOrderAt: data.firstOrderAt,
                        lastOrderAt: data.lastOrderAt,
                        orders: data.orders,
                        updatedAt: new Date()
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );
            count++;
        }

        res.json({ success: true, syncedCount: count, message: `تمت مزامنة وتحديث بيانات ${count} عميل بنجاح` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.patch('/api/customers/:phone', authMiddleware, async (req, res) => {
    try {
        const phone = (req.params.phone || '').trim();
        const { name, notes, tags } = req.body;
        const updateFields = { updatedAt: new Date() };
        if (typeof name === 'string' && name.trim()) updateFields.name = name.trim();
        if (typeof notes === 'string') updateFields.notes = notes.trim();
        if (Array.isArray(tags)) updateFields.tags = tags;

        const updated = await Customer.findOneAndUpdate(
            { phone },
            { $set: updateFields },
            { returnDocument: 'after' }
        );

        if (!updated) {
            return res.status(404).json({ success: false, error: 'العميل غير مسجل' });
        }

        res.json({ success: true, customer: updated });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/customers/:phone', authMiddleware, async (req, res) => {
    try {
        const phone = (req.params.phone || '').trim();
        const result = await Customer.deleteOne({ phone });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'العميل غير موجود' });
        }
        res.json({ success: true, message: 'تم حذف العميل بنجاح من قاعدة البيانات' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// Server Start
// ============================================
if (require.main === module) {
    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
