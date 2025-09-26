// /api/users/[email].js
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const userKey = `user:${email}`;
    const userData = await redis.get(userKey);
    
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user's payments
    const paymentsKey = `user:${email}:payments`;
    const payments = await redis.hgetall(paymentsKey);
    
    const response = {
      ...JSON.parse(userData),
      payments: payments ? Object.values(payments).map(p => JSON.parse(p)) : []
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
}
