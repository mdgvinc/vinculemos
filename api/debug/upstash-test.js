  const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis
const redis = new Redis({
  url: process.env.flow_REDIS_URL,
  token: process.env.flow_KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test basic connection
    await redis.set('test_key', 'Hello Upstash!');
    const testValue = await redis.get('test_key');
    
    // Test if we can list keys (basic operation)
    const ping = await redis.ping();
    
    res.status(200).json({
      success: true,
      message: 'Upstash connection successful',
      testValue,
      ping,
      env: {
        hasRedisUrl: !!process.env.flow_REDIS_URL,
        hasToken: !!process.env.flow_KV_REST_API_TOKEN,
        redisUrlLength: process.env.flow_REDIS_URL?.length,
        tokenLength: process.env.flow_KV_REST_API_TOKEN?.length
      }
    });
  } catch (error) {
    console.error('Upstash test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      env: {
        hasRedisUrl: !!process.env.flow_REDIS_URL,
        hasToken: !!process.env.flow_KV_REST_API_TOKEN,
        redisUrl: process.env.flow_REDIS_URL ? '***' + process.env.flow_REDIS_URL.slice(-10) : 'missing',
        token: process.env.flow_KV_REST_API_TOKEN ? '***' + process.env.flow_KV_REST_API_TOKEN.slice(-10) : 'missing'
      }
    });
  }
};
