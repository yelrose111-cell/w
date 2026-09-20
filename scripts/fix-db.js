const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');
const Category = require('./models/Category');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const cats = await Category.find();
    console.log('Found categories:', cats.length);
    
    // Create a mapping from old string ID to new category ID if needed
    // The previous prompt said: "in the admin page there are 12 sections" and old data uses string IDs.
    // Let's see what string IDs exist in products.
    const prods = await Product.find();
    console.log('Found products:', prods.length);
    
    const stringToCatIdMap = {};
    cats.forEach(c => {
      // Maybe match by name or English equivalent?
      console.log(' -', c.id, c.name);
    });
    
    let needsUpdate = 0;
    for (const p of prods) {
      if (!p.categoryId.startsWith('cat_')) {
        console.log('Product with old categoryId:', p.id, p.categoryId);
        // Find matching category
        // E.g. "bouquets" -> "باقات ورد"
        let newCat = cats.find(c => c.name.includes('باقات') && p.categoryId === 'bouquets');
        if (!newCat) newCat = cats.find(c => c.name.includes('فازات') && p.categoryId === 'vases');
        if (!newCat) newCat = cats.find(c => c.name.includes('مسكات') && p.categoryId === 'bridal');
        
        if (newCat) {
          console.log('  -> Mapping to', newCat.id);
          p.categoryId = newCat.id;
          await p.save();
          needsUpdate++;
        }
      }
    }
    console.log('Updated', needsUpdate, 'products');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
