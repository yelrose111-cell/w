require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  // get schemas from models
  const Category = require('./models/Category');
  const Product = require('./models/Product');

  try {
    const categories = await Category.find();
    const categoryPrefixMap = {};
    const catOps = [];
    
    for (const cat of categories) {
      let prefix = 'YR';
      if (cat.name.includes('باقات')) prefix = 'YF';
      else if (cat.name.includes('فازات')) prefix = 'YV';
      else if (cat.name.includes('شوكولاتة') || cat.name.includes('شوكلاته') || cat.name.includes('شوكلاتة')) prefix = 'YC';
      else if (cat.name.includes('هدايا') || cat.name.includes('تغليف')) prefix = 'YG';
      else if (cat.name.includes('مسكات') || cat.name.includes('عرايس')) prefix = 'YW';
      else if (cat.name.includes('مواليد')) prefix = 'YN';
      else if (cat.name.includes('نباتات')) prefix = 'YP';
      
      categoryPrefixMap[cat.id] = prefix;
      catOps.push({
        updateOne: {
          filter: { id: cat.id },
          update: { $set: { prefix: prefix } }
        }
      });
    }
    
    if (catOps.length > 0) {
      await Category.bulkWrite(catOps);
      console.log(`Updated ${catOps.length} categories.`);
    }
    
    const prefixCounters = {};
    const products = await Product.find().sort({ createdAt: 1 });
    const prodOps = [];
    
    for (const prod of products) {
      const prefix = categoryPrefixMap[prod.categoryId] || 'YR';
      if (!prefixCounters[prefix]) prefixCounters[prefix] = 1;
      
      const count = prefixCounters[prefix]++;
      const codeNum = count.toString().padStart(2, '0');
      const productCode = `${prefix}-${codeNum}`;
      
      const updatedImages = prod.images ? [...prod.images] : [];
      if (updatedImages.length > 0) {
        updatedImages.forEach((img, idx) => {
          if (updatedImages.length === 1) {
            img.code = productCode;
          } else {
            img.code = `${productCode}-${idx + 1}`;
          }
        });
      }
      
      prodOps.push({
        updateOne: {
          filter: { id: prod.id },
          update: { $set: { productCode: productCode, images: updatedImages } }
        }
      });
    }
    
    if (prodOps.length > 0) {
      await Product.bulkWrite(prodOps);
      console.log(`Updated ${prodOps.length} products.`);
    }

    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

run();
