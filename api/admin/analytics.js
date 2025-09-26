// /api/admin/analytics.js
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Add basic auth check in production
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get total users
    const totalUsers = await redis.scard('users:all');
    
    // Get recent payments (last 50)
    const recentPayments = await redis.lrange('payments:all', 0, 49);
    
    // Calculate revenue
    const allPayments = recentPayments.map(p => JSON.parse(p));
    const totalRevenue = allPayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Get experience statistics
    const experienceStats = allPayments.reduce((stats, payment) => {
      const exp = payment.experience;
      stats[exp] = (stats[exp] || 0) + 1;
      return stats;
    }, {});
    
    res.status(200).json({
      totalUsers,
      totalRevenue,
      recentPayments: allPayments,
      experienceStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
