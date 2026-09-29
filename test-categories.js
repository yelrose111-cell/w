const mongoose = require('mongoose');
require('dotenv').config();

const categorySchema = new mongoose.Schema({
  id: String,
  name: String
}, { strict: false });

const Category = mongoose.model('Category', categorySchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const cats = await Category.find();
  console.log("Categories:", cats.map(c => ({ id: c.id, name: c.name })));
  process.exit(0);
}
run();
