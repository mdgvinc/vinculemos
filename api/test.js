module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    res.status(200).json({
      success: true,
      message: 'Flow API endpoint is working',
      timestamp: new Date().toISOString(),
      env: {
        hasFlowApiKey: !!process.env.FLOW_API_KEY,
        hasFlowSecret: !!process.env.FLOW_SECRET_KEY,
        hasRedis: !!(process.env.flow_REDIS_URL && process.env.flow_KV_REST_API_TOKEN)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
