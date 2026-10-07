const mongoose = require('mongoose');
const Order = require('./models/Order');

mongoose.connect('mongodb+srv://haithamsh:h1a2i3t4h5a6m@cluster0.zoxmb8d.mongodb.net/yellowrose?retryWrites=true&w=majority&appName=Cluster0')
.then(async () => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(5);
  console.log(JSON.stringify(orders, null, 2));
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
