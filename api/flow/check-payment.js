const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis with new variable names
const redis = new Redis({
  url: process.env.flow_REDIS_URL,
  token: process.env.flow_REST_API_TOKEN || process.env.flow_KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { commerceOrder } = req.query;
    
    if (!commerceOrder) {
      return res.status(400).json({ error: 'commerceOrder is required' });
    }

    // Get payment session from Redis
    const paymentSessionKey = `payment:session:${commerceOrder}`;
    const paymentSession = await redis.get(paymentSessionKey);
    
    if (!paymentSession) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const paymentData = JSON.parse(paymentSession);
    
    res.status(200).json({
      success: true,
      payment: paymentData
    });
  } catch (error) {
    console.error('Error checking payment:', error);
    res.status(500).json({ error: 'Error checking payment status: ' + error.message });
  }
};
