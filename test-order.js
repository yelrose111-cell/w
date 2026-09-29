require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const data = {
      customerName: "عميل عبر الواتساب",
      customerPhone: "0500000000",
      productId: "test-id",
      productTitle: "Test Product",
      productCoverUrl: "http://example.com/img.jpg",
      cardData: {
        recipient: "",
        sender: "",
        message: "This is a test message",
        fontFamily: "Tajawal",
        fontSize: "14pt",
        textAlign: "center"
      }
    };
    data.orderId = 'YR-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
    const saved = await Order.create(data);
    console.log("Success:", saved);
  } catch(e) {
    console.error("Mongoose Error:", e.message);
  } finally {
    mongoose.disconnect();
  }
}
run();
