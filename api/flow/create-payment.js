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
    const { 
      experience, 
      price, 
      userEmail, 
      userName, 
      phone, 
      preferredDate,
      comments 
    } = req.body;

    // Validate required fields
    if (!experience || !price || !userEmail || !userName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate unique commerce order ID
    const commerceOrder = `VINCULEMOS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment object for Flow
    const paymentData = {
      commerceOrder,
      subject: `Vinculemos - ${experience}`,
      amount: parseInt(price),
      email: userEmail,
      paymentMethod: 9, // 9 = All payment methods
      urlConfirmation: process.env.BASE_URL || 'https://vinculemos.vercel.app',
      urlReturn: `${process.env.BASE_URL || 'https://vinculemos.vercel.app'}/payment/flow-return.html`,
      optional: {
        message: `Experiencia: ${experience}, Fecha preferida: ${preferredDate}, Comentarios: ${comments}`
      }
    };

    // Store payment session in Redis with 24-hour expiration
    const paymentSession = {
      commerceOrder,
      userEmail,
      userName,
      phone,
      experience,
      price: parseInt(price),
      preferredDate,
      comments,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await redis.setex(
      `payment:session:${commerceOrder}`, 
      86400, // 24 hours expiration
      JSON.stringify(paymentSession)
    );

    // Create Flow payment using their API
    const flowResponse = await createFlowPayment(paymentData);
    
    res.status(200).json({
      success: true,
      commerceOrder,
      flowPayment: flowResponse,
      redirectUrl: flowResponse.url, // URL to redirect user to Flow payment page
    });
  } catch (error) {
    console.error('Error creating Flow payment:', error);
    res.status(500).json({ 
      error: 'Error creating payment: ' + error.message,
      details: error.response?.data || 'No additional details'
    });
  }
};

// Helper function to create payment in Flow
async function createFlowPayment(paymentData) {
  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('Flow API credentials not configured');
  }

  // Flow API requires specific parameters
  const params = new URLSearchParams();
  params.append('apiKey', apiKey);
  params.append('commerceOrder', paymentData.commerceOrder);
  params.append('subject', paymentData.subject);
  params.append('amount', paymentData.amount);
  params.append('email', paymentData.email);
  params.append('paymentMethod', paymentData.paymentMethod);
  params.append('urlConfirmation', paymentData.urlConfirmation);
  params.append('urlReturn', paymentData.urlReturn);
  
  if (paymentData.optional) {
    params.append('optional', JSON.stringify(paymentData.optional));
  }

  // Create signature for security
  const signature = createFlowSignature(params, secretKey);
  params.append('s', signature);

  const response = await fetch('https://www.flow.cl/api/payment/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Flow API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (data.status !== 1) {
    throw new Error(`Flow payment creation failed: ${data.message}`);
  }

  return data;
}

// Helper function to create Flow signature
function createFlowSignature(params, secretKey) {
  const crypto = require('crypto');
  
  // Sort parameters alphabetically and concatenate values
  const sortedKeys = Array.from(params.keys()).sort();
  const message = sortedKeys.map(key => params.get(key)).join('');
  
  // Create HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  return hmac.digest('hex');
}
