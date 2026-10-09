// ============================================
// scripts/migrate-schemas.js — Migration Script
// ============================================
// تشغيل: node scripts/migrate-schemas.js
// ============================================

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

async function migrate() {
    if (!process.env.MONGODB_URI) {
        console.error('❌ MONGODB_URI is not defined');
        process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('🔧 Starting schema migration...\n');
    
    // 1. إنشاء الفهارس على الطلبات
    console.log('📦 Creating indexes on orders collection...');
    try {
        await db.collection('orders').createIndex({ pagerToken: 1 }, { unique: true, sparse: true });
        console.log('  ✅ pagerToken unique index created');
        
        await db.collection('orders').createIndex({ status: 1, createdAt: -1 });
        console.log('  ✅ status+createdAt compound index created');
        
        await db.collection('orders').createIndex({ pushSubscription: 1 });
        console.log('  ✅ pushSubscription index created');
        
        await db.collection('orders').createIndex({ lastCallAt: -1 });
        console.log('  ✅ lastCallAt index created');
        
    } catch (err) {
        if (err.code === 11000) {
            console.log('  ⚠️  Duplicate pagerToken values found!');
            console.log('  Run: db.orders.find({ pagerToken: { $exists: false } })');
        } else {
            throw err;
        }
    }
    
    // 2. إنشاء الفهارس على الاشتراكات
    console.log('\n📦 Creating indexes on pushsubscriptions collection...');
    await db.collection('pushsubscriptions').createIndex({ pagerToken: 1, lastUsedAt: -1 });
    console.log('  ✅ pagerToken+lastUsedAt compound index created');
    
    // 3. إنشاء فهرس TTL للحذف التلقائي
    console.log('\n📦 Creating TTL index...');
    try {
        await db.collection('pushsubscriptions').createIndex(
            { lastUsedAt: 1 },
            { expireAfterSeconds: 90 * 24 * 60 * 60 }
        );
        console.log('  ✅ TTL index created (90 days)');
    } catch (err) {
        console.log('  ⚠️  TTL index may already exist:', err.message);
    }
    
    // 4. إنشاء فهارس التقييمات
    console.log('\n📦 Creating indexes on ratings collection...');
    await db.collection('ratings').createIndex({ orderId: 1 }, { unique: true });
    await db.collection('ratings').createIndex({ createdAt: -1 });
    console.log('  ✅ Ratings indexes created');
    
    // 5. إنشاء فهارس الاشتراكات التسويقية
    console.log('\n📦 Creating indexes on marketingsubscriptions collection...');
    await db.collection('marketingsubscriptions').createIndex({ endpoint: 1 }, { unique: true });
    await db.collection('marketingsubscriptions').createIndex({ isActive: 1, interests: 1 });
    console.log('  ✅ Marketing indexes created');
    
    // 6. تنظيف الاشتراكات اليتيمة
    console.log('\n🧹 Cleaning up orphaned subscriptions...');
    const result = await db.collection('pushsubscriptions').deleteMany({
        pagerToken: { $exists: false }
    });
    console.log(`  ✅ Deleted ${result.deletedCount} orphaned subscriptions`);
    
    console.log('\n✅ Migration completed successfully!');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
