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
    console.log('Debug endpoint called with body:', req.body);
    
    // Simple success response
    res.status(200).json({
      success: true,
      message: 'Debug endpoint working!',
      commerceOrder: 'DEBUG_' + Date.now(),
      flowPayment: {
        url: 'https://www.flow.cl/app/web/paymentRedirect.php?token=debug_test',
        token: 'debug_test'
      },
      debug: {
        body: req.body,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: 'Debug endpoint failed',
      message: error.message 
    });
  }
};
