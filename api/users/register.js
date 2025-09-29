const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis with error handling
let redis;
try {
  redis = new Redis({
    url: process.env.flow_REDIS_URL,
    token: process.env.flow_KV_REST_API_TOKEN,
  });
  console.log('Redis initialized successfully');
} catch (initError) {
  console.error('Redis initialization failed:', initError);
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

  // Check if Redis was initialized
  if (!redis) {
    console.error('Redis client not initialized');
    return res.status(500).json({ 
      error: 'Database connection failed',
      details: 'Redis client not initialized. Check environment variables.'
    });
  }

  try {
    const { email, name, phone, preferences, signupDate } = req.body;
    
    console.log('Registering user:', { email, name: name?.substring(0, 10) + '...' });
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const userKey = `user:${email}`;
    
    // Test connection first with a simple operation
    try {
      await redis.ping();
    } catch (pingError) {
      console.error('Redis ping failed:', pingError);
      throw new Error('Database connection test failed: ' + pingError.message);
    }
    
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
      console.log('Updated existing user:', email);
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
      console.log('Created new user:', email);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'User registered successfully',
      user: { email, name }
    });
  } catch (error) {
    console.error('User registration error:', error);
    res.status(500).json({ 
      error: 'Failed to register user: ' + error.message,
      step: 'database_operation'
    });
  }
};
