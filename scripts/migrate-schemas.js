require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/Order');

async function migrate() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Connected! Starting migration...');
    const result = await Order.updateMany(
        { pagerToken: { $exists: false } },
        { 
            $set: { 
                pagerToken: () => require('crypto').randomBytes(16).toString('hex') 
            }
        }
    );
    
    console.log(`Migration Complete: Updated ${result.modifiedCount} records.`);
    mongoose.disconnect();
}

migrate().catch(console.error);
