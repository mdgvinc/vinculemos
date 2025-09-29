const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis with new variable names
const redis = new Redis({
  url: process.env.flow_REDIS_URL,
  token: process.env.flow_REST_API_TOKEN || process.env.flow_KV_REST_API_TOKEN,
});

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
    const { email, name, phone, preferences, signupDate } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const userKey = `user:${email}`;
    
    // Check if user exists and update or create
    const existingUser = await redis.get(userKey);
    
    if (existingUser) {
      const userData = JSON.parse(existingUser);
      const updatedUser = {
        ...userData,
        name: name || userData.name,
        phone: phone || userData.phone,
        preferences: preferences || userData.preferences,
        updatedAt: new Date().toISOString()
      };
      
      await redis.set(userKey, JSON.stringify(updatedUser));
    } else {
      const newUser = {
        email,
        name,
        phone,
        preferences: preferences || {},
        signupDate: signupDate || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        totalPayments: 0,
        totalSpent: 0
      };
      
      await redis.set(userKey, JSON.stringify(newUser));
      
      // Add to users list for easy enumeration
      await redis.sadd('users:all', email);
    }
    
    res.status(200).json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).json({ error: 'Failed to register user: ' + error.message });
  }
};
