const mongoose = require('mongoose');
require('dotenv').config();

const Category = require('./models/Category');
const Product = require('./models/Product');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log("Migrating Categories...");
  const categories = await Category.find();
  const categoryPrefixMap = {};
  
  for (const cat of categories) {
    let prefix = 'YR';
    if (cat.name.includes('باقات')) prefix = 'YF';
    else if (cat.name.includes('فازات')) prefix = 'YV';
    else if (cat.name.includes('شوكولاتة') || cat.name.includes('شوكلاته') || cat.name.includes('شوكلاتة')) prefix = 'YC';
    else if (cat.name.includes('هدايا') || cat.name.includes('تغليف')) prefix = 'YG';
    else if (cat.name.includes('مسكات') || cat.name.includes('عرايس')) prefix = 'YW';
    else if (cat.name.includes('مواليد')) prefix = 'YN';
    else if (cat.name.includes('نباتات')) prefix = 'YP';
    
    cat.prefix = prefix;
    await cat.save();
    categoryPrefixMap[cat.id] = prefix;
    console.log(`Category: ${cat.name} -> Prefix: ${prefix}`);
  }
  
  console.log("Migrating Products...");
  const prefixCounters = {};
  const products = await Product.find().sort({ createdAt: 1 }); // Oldest first to maintain a logical sequence
  
  let updatedCount = 0;
  for (const prod of products) {
    const prefix = categoryPrefixMap[prod.categoryId] || 'YR';
    if (!prefixCounters[prefix]) prefixCounters[prefix] = 1;
    
    const count = prefixCounters[prefix]++;
    // Format to 2 digits minimum (e.g. 01, 02, 10, 100)
    const codeNum = count.toString().padStart(2, '0');
    const productCode = `${prefix}-${codeNum}`;
    
    prod.productCode = productCode;
    
    if (prod.images && prod.images.length > 0) {
      prod.images.forEach((img, idx) => {
        if (prod.images.length === 1) {
          img.code = productCode;
        } else {
          img.code = `${productCode}-${idx + 1}`;
        }
      });
    }
    
    await prod.save();
    updatedCount++;
    console.log(`Product: ${prod.title} -> Code: ${productCode}`);
  }
  
  console.log(`Migration completed. Updated ${categories.length} categories and ${updatedCount} products.`);
  process.exit(0);
}

run().catch(console.error);
