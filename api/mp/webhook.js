// /api/mp/webhook.js
const mercadopago = require('mercadopago');
const { Redis } = require('@upstash/redis');

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data } = req.body;
    
    if (type === 'payment') {
      const payment = await mercadopago.payment.findById(data.id);
      const paymentData = payment.body;
      
      if (paymentData.status === 'approved') {
        // Payment was successful
        const { metadata } = paymentData;
        
        // Store payment record
        const paymentRecord = {
          paymentId: data.id,
          userEmail: metadata.userEmail,
          userName: metadata.userName,
          phone: metadata.phone,
          experience: metadata.experience,
          amount: paymentData.transaction_amount,
          preferredDate: metadata.preferredDate,
          comments: metadata.comments,
          paymentDate: new Date().toISOString(),
          status: 'completed'
        };
        
        // Store in Redis with key that includes user email for easy querying
        await redis.hset(
          `user:${metadata.userEmail}:payments`,
          { [data.id]: JSON.stringify(paymentRecord) }
        );
        
        // Also store in a general payments list for analytics
        await redis.lpush(
          'payments:all',
          JSON.stringify({
            ...paymentRecord,
            id: data.id
          })
        );
        
        // Update user profile or create if doesn't exist
        const userKey = `user:${metadata.userEmail}`;
        const existingUser = await redis.get(userKey);
        
        if (existingUser) {
          const userData = JSON.parse(existingUser);
          await redis.set(
            userKey,
            JSON.stringify({
              ...userData,
              lastPayment: new Date().toISOString(),
              totalPayments: (userData.totalPayments || 0) + 1,
              totalSpent: (userData.totalSpent || 0) + paymentData.transaction_amount
            })
          );
        } else {
          // Create new user profile
          await redis.set(
            userKey,
            JSON.stringify({
              email: metadata.userEmail,
              name: metadata.userName,
              phone: metadata.phone,
              signupDate: new Date().toISOString(),
              lastPayment: new Date().toISOString(),
              totalPayments: 1,
              totalSpent: paymentData.transaction_amount,
              preferences: {
                interests: [metadata.experience]
              }
            })
          );
        }
        
        console.log('Payment processed successfully:', paymentRecord);
        
        // Here you can integrate with your email service
        // await sendConfirmationEmail(metadata.userEmail, metadata.experience);
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}
