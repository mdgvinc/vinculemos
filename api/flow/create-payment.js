const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis
let redis;
if (process.env.flow_REDIS_URL && process.env.flow_KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.flow_REDIS_URL,
    token: process.env.flow_KV_REST_API_TOKEN,
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { experience, price, userEmail, userName } = req.body;
    
    if (!experience || !price || !userEmail || !userName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const commerceOrder = `VINCULEMOS_${Date.now()}`;
    
    // Store payment session if Redis is available
    if (redis) {
      const paymentSession = {
        commerceOrder,
        userEmail,
        userName,
        experience,
        price: parseInt(price),
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      
      await redis.setex(`payment:session:${commerceOrder}`, 86400, JSON.stringify(paymentSession));
    }

    // For now, return a simulated Flow response
    res.status(200).json({
      success: true,
      commerceOrder,
      flowPayment: {
        url: `https://www.flow.cl/app/web/paymentRedirect.php?token=test_${commerceOrder}`,
        token: `test_${commerceOrder}`
      },
      message: 'Payment created successfully (test mode)'
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Payment creation failed: ' + error.message });
  }
};
