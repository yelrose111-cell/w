require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Album = require('./models/Album');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const cat = await Category.findOne().lean();
    console.log('Category:', cat);
    const prod = await Product.findOne().lean();
    console.log('Product:', prod);
    const alb = await Album.findOne().lean();
    console.log('Album:', alb);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
}
test();
