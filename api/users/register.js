const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis
let redis;
try {
  redis = new Redis({
    url: process.env.flow_REDIS_URL,
    token: process.env.flow_KV_REST_API_TOKEN,
  });
  console.log('Redis initialized successfully');
} catch (error) {
  console.error('Redis init error:', error);
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, name, phone, preferences } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // If Redis is not available, still return success for testing
    if (!redis) {
      console.log('Redis not available, but returning success for testing');
      return res.status(200).json({ 
        success: true, 
        message: 'User registered (test mode - Redis not configured)',
        user: { email, name }
      });
    }

    const userKey = `user:${email}`;
    const userData = {
      email,
      name,
      phone,
      preferences: preferences || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await redis.set(userKey, JSON.stringify(userData));
    await redis.sadd('users:all', email);
    
    console.log('User registered successfully:', email);
    
    res.status(200).json({ 
      success: true, 
      message: 'User registered successfully',
      user: { email, name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Failed to register user',
      details: error.message
    });
  }
};
