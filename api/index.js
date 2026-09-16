const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const Album = require('../models/Album');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');
const Settings = require('../models/Settings');

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// MongoDB Connection
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  
  if (!process.env.MONGODB_URI) {
    throw new Error('FATAL ERROR: MONGODB_URI is missing in Vercel Environment Variables. Please add it and Redeploy.');
  }
  
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    cachedDb = db;
    console.log('MongoDB Connected');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to MongoDB: ' + error.message);
  }
};

app.use(async (req, res, next) => {
  if (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD_HASH) {
    console.error('CRITICAL: SESSION_SECRET or ADMIN_PASSWORD_HASH is missing. Refusing to serve requests.');
    return res.status(500).json({ success: false, error: 'Server misconfiguration: Secrets missing in Vercel.' });
  }
  
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Authentication Middleware
const authMiddleware = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  try {
    // Basic stateless token validation using HMAC with SESSION_SECRET
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token format' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.SESSION_SECRET)
      .update(payload)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token signature' });
    }

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    
    // Check expiration (24 hours)
    if (Date.now() > decodedPayload.exp) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Token expired' });
    }

    req.admin = true;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Token validation failed' });
  }
};


// ---------------- Auth Endpoints ----------------

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window` (here, per 15 minutes)
  message: { success: false, error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { pin } = req.body;
  
  // Hash the incoming PIN with SHA-256 to compare with ADMIN_PASSWORD_HASH
  const hashedPin = crypto.createHash('sha256').update(pin || '').digest('hex');
  
  const storedHash = process.env.ADMIN_PASSWORD_HASH || '';

  const hashedPinBuffer = Buffer.from(hashedPin);
  const storedHashBuffer = Buffer.from(storedHash);

  if (hashedPinBuffer.length === storedHashBuffer.length && crypto.timingSafeEqual(hashedPinBuffer, storedHashBuffer)) {
    const payloadBase64 = Buffer.from(JSON.stringify({
      role: 'admin',
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');
    
    const signature = crypto
      .createHmac('sha256', process.env.SESSION_SECRET)
      .update(payloadBase64)
      .digest('hex');

    const token = `${payloadBase64}.${signature}`;

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) return res.json({ authenticated: false });
  
  try {
    const [payload, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('hex');
    
    if (signature === expectedSignature) {
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
      if (Date.now() <= decodedPayload.exp) {
         return res.json({ authenticated: true });
      }
    }
  } catch (err) {}
  
  res.json({ authenticated: false });
});

// ---------------- Cloudinary Signed Upload ----------------

app.post('/api/cloudinary/sign', authMiddleware, (req, res) => {
  if (!process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ success: false, error: 'Cloudinary is not configured.' });
  }
  
  const folder = req.body.folder || 'yellowrose';
  const timestamp = Math.round((new Date).getTime()/1000);
  const signature = cloudinary.utils.api_sign_request({
    timestamp: timestamp,
    folder: folder
  }, process.env.CLOUDINARY_API_SECRET);

  res.json({ 
    success: true, 
    signature, 
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY
  });
});

// ---------------- Albums Endpoints ----------------

app.get('/api/albums', async (req, res) => {
  try {
    const albums = await Album.find().sort({ createdAt: -1 }).lean();
    res.json(albums);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/albums', authMiddleware, async (req, res) => {
  try {
    const albumData = req.body;
    if (!albumData.id) {
      albumData.id = `alb_yr_${Date.now()}`;
    }
    
    const savedAlbum = await Album.findOneAndUpdate(
      { id: albumData.id },
      albumData,
      { new: true, upsert: true }
    );
    
    res.status(201).json({ success: true, album: savedAlbum });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/albums/:id', authMiddleware, async (req, res) => {
  try {
    await Album.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------- E-Commerce Endpoints ----------------

// --- Categories ---
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
    const saved = await Category.findOneAndUpdate({ id: data.id }, data, { new: true, upsert: true });
    res.status(201).json({ success: true, category: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



app.delete('/api/categories/:id', authMiddleware, async (req, res) => {
  try {
    const categoryId = req.params.id;
    await Category.findOneAndDelete({ id: categoryId });
    // Cascading delete
    await Subcategory.deleteMany({ categoryId: categoryId });
    await Product.deleteMany({ categoryId: categoryId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Subcategories ---
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
    const saved = await Subcategory.findOneAndUpdate({ id: data.id }, data, { new: true, upsert: true });
    res.status(201).json({ success: true, subcategory: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/subcategories/:id', authMiddleware, async (req, res) => {
  try {
    const subcategoryId = req.params.id;
    await Subcategory.findOneAndDelete({ id: subcategoryId });
    // Cascading delete
    await Product.deleteMany({ subcategoryId: subcategoryId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Products ---
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
    const saved = await Product.findOneAndUpdate({ id: data.id }, data, { new: true, upsert: true });
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

// ---------------- Settings Endpoints ----------------

app.get('/api/settings', async (req, res) => {
  try {
    const settingsDoc = await Settings.findOne({ key: 'site_settings' });
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    if (settingsDoc && settingsDoc.value) {
      // Don't expose sensitive info if they accidentally saved it, though new structure shouldn't have any
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
    const settingsObj = req.body;
    await Settings.findOneAndUpdate(
      { key: 'site_settings' },
      { value: settingsObj },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: mongoose.connection.readyState === 1 });
});

if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Local Vercel API simulation running on port ${PORT}`);
  });
}

module.exports = app;
