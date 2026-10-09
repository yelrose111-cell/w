require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');
const PushSubscription = require('./models/PushSubscription');
const webpush = require('web-push');

// Mock web-push to avoid sending real network requests if no real keys
let notificationSent = false;
const originalSend = webpush.sendNotification;
webpush.sendNotification = async function(subscription, payload) {
  console.log('--- WEBPUSH MOCK CALLED ---');
  console.log('To endpoint:', subscription.endpoint);
  console.log('Payload:', payload);
  notificationSent = true;
  return { statusCode: 201 }; // Mock success
};

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('DB connected');

  // 1. Create a dummy order
  const orderId = 'TEST-PUSH-123';
  const pagerToken = 'mock_pager_token_123';
  
  await Order.findOneAndDelete({ orderId });
  await PushSubscription.deleteMany({ pagerToken });

  const order = await Order.create({
    orderId,
    customerName: 'Test Customer',
    customerPhone: '0500000000',
    pagerToken,
    status: 'pending'
  });
  console.log('Order created:', order._id);

  // 2. Create a dummy subscription
  const sub = await PushSubscription.create({
    endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/mock',
    keys: {
      p256dh: 'mock-p256dh',
      auth: 'mock-auth'
    },
    pagerToken: pagerToken
  });
  console.log('Subscription created:', sub._id);

  // 3. Link subscription to order
  order.pushSubscription = sub._id;
  await order.save();

  // 4. Test the ping logic directly (simulating the /api/orders/:id/ping route)
  console.log('Simulating Ping...');
  
  const updated = await Order.findOneAndUpdate(
    { orderId: orderId },
    { lastPingAt: Date.now() },
    { new: true }
  );

  // Copy logic from api/index.js
  if (updated && updated.pushSubscription && process.env.VAPID_PUBLIC_KEY) {
    try {
      const subDoc = await PushSubscription.findById(updated.pushSubscription).lean();
      if (subDoc) {
        const payload = JSON.stringify({
          title: 'Yellow Rose 🌹',
          body: `طلبك رقم ${updated.orderId} جاهز للاستلام!`,
          url: `/pager.html?token=${updated.pagerToken}`,
          orderId: updated.orderId
        });
        await webpush.sendNotification({
          endpoint: subDoc.endpoint,
          keys: { p256dh: subDoc.keys.p256dh, auth: subDoc.keys.auth }
        }, payload);
      }
    } catch (err) {
      console.error('Push error:', err);
    }
  } else {
    console.log('Ping conditions not met:', { 
        hasUpdated: !!updated, 
        hasPushSub: !!updated.pushSubscription, 
        hasVapid: !!process.env.VAPID_PUBLIC_KEY 
    });
  }

  if (notificationSent) {
    console.log('✅ TEST PASSED: Web push notification logic fired successfully.');
  } else {
    console.error('❌ TEST FAILED: Web push notification logic was not fired.');
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
