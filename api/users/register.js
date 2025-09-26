// /api/users/register.js
const { Redis } = require('@upstash/redis');

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
    const { email, name, phone, preferences, signupDate } = req.body;
    
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
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Redis error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
}
