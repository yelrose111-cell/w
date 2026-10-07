require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Album = require('./models/Album');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  try {
    const categories = await Category.find().lean();
    const categoryPrefixMap = {};
    const catOps = [];
    
    for (const cat of categories) {
      let prefix = 'YR';
      const catName = cat.name || '';
      if (catName.includes('باقات')) prefix = 'YF';
      else if (catName.includes('فازات')) prefix = 'YV';
      else if (catName.includes('شوكولاتة') || catName.includes('شوكلاته') || catName.includes('شوكلاتة')) prefix = 'YC';
      else if (catName.includes('هدايا') || catName.includes('تغليف')) prefix = 'YG';
      else if (catName.includes('مسكات') || catName.includes('عرايس')) prefix = 'YW';
      else if (catName.includes('مواليد')) prefix = 'YN';
      else if (catName.includes('نباتات')) prefix = 'YP';
      
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
    }
    
    const prefixCounters = {};
    const products = await Product.find().sort({ createdAt: 1 }).lean();
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
    
    // Also migrate Albums!
    const albums = await Album.find().sort({ createdAt: 1 }).lean();
    const albOps = [];
    
    for (const alb of albums) {
      const prefix = categoryPrefixMap[alb.category] || 'YR';
      if (!prefixCounters[prefix]) prefixCounters[prefix] = 1;
      
      const count = prefixCounters[prefix]++;
      const codeNum = count.toString().padStart(2, '0');
      const albumCode = `${prefix}-${codeNum}`; // Since Album doesn't have productCode, we only update images
      
      const updatedImages = alb.images ? [...alb.images] : [];
      if (updatedImages.length > 0) {
        updatedImages.forEach((img, idx) => {
          if (updatedImages.length === 1) {
            img.code = albumCode;
          } else {
            img.code = `${albumCode}-${idx + 1}`;
          }
        });
      }
      
      albOps.push({
        updateOne: {
          filter: { id: alb.id },
          update: { $set: { images: updatedImages } }
        }
      });
    }

    if (prodOps.length > 0) await Product.bulkWrite(prodOps);
    if (albOps.length > 0) await Album.bulkWrite(albOps);
    
    console.log(`Success: ${categories.length} categories, ${products.length} products, ${albums.length} albums.`);
  } catch (error) {
    console.error("Migration Error:", error);
  } finally {
    mongoose.disconnect();
  }
}
test();
