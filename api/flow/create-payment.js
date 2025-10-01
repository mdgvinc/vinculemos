const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis
let redis;
if (process.env.flow_REDIS_URL && process.env.flow_KV_REST_API_TOKEN) {
  redis = new Redis({
    url: process.env.flow_REDIS_URL,
    token: process.env.flow_KV_REST_API_TOKEN,
  });
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
    const { experience, price, userEmail, userName, phone, preferredDate, comments } = req.body;
    
    console.log('Received payment request:', { experience, price, userEmail, userName });
    
    if (!experience || !price || !userEmail || !userName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const commerceOrder = `VINCULEMOS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store payment session if Redis is available
    if (redis) {
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
      
      await redis.setex(`payment:session:${commerceOrder}`, 86400, JSON.stringify(paymentSession));
    }

    // Check if Flow credentials are configured
    if (!process.env.FLOW_API_KEY || !process.env.FLOW_SECRET_KEY) {
      console.log('Flow credentials not configured, returning test response');
      
      // Return test response when Flow is not configured
      return res.status(200).json({
        success: true,
        commerceOrder,
        flowPayment: {
          url: `https://www.flow.cl/app/web/paymentRedirect.php?token=test_${commerceOrder}`,
          token: `test_${commerceOrder}`
        },
        message: 'Payment created successfully (test mode - Flow not configured)'
      });
    }

    // If Flow credentials are configured, create real payment
    const flowResponse = await createFlowPayment({
      commerceOrder,
      experience,
      price,
      userEmail,
      userName,
      phone,
      preferredDate,
      comments
    });
    
    res.status(200).json({
      success: true,
      commerceOrder,
      flowPayment: flowResponse,
      message: 'Payment created successfully'
    });
    
  } catch (error) {
    console.error('Error creating Flow payment:', error);
    
    // Return a more detailed error response
    res.status(500).json({ 
      error: 'Error creating payment',
      message: error.message,
      details: 'Check server logs for more information'
    });
  }
};

// Helper function to create payment in Flow
async function createFlowPayment(paymentData) {
  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;

  // Flow API requires specific parameters
  const params = new URLSearchParams();
  params.append('apiKey', apiKey);
  params.append('commerceOrder', paymentData.commerceOrder);
  params.append('subject', `Vinculemos - ${paymentData.experience}`);
  params.append('amount', paymentData.price);
  params.append('email', paymentData.userEmail);
  params.append('paymentMethod', '9'); // 9 = All payment methods
  params.append('urlConfirmation', process.env.BASE_URL || 'https://vinculemos.vercel.app');
  params.append('urlReturn', `${process.env.BASE_URL || 'https://vinculemos.vercel.app'}/payment/flow-return.html`);
  
  // Add optional parameters
  const optionalParams = {
    message: `Experiencia: ${paymentData.experience}, Fecha preferida: ${paymentData.preferredDate}, Comentarios: ${paymentData.comments || 'Sin comentarios'}`
  };
  params.append('optional', JSON.stringify(optionalParams));

  // Create signature for security
  const signature = createFlowSignature(params, secretKey);
  params.append('s', signature);

  console.log('Calling Flow API with params:', {
    commerceOrder: paymentData.commerceOrder,
    amount: paymentData.price,
    email: paymentData.userEmail
  });

  const response = await fetch('https://www.flow.cl/api/payment/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params
  });

  const responseText = await response.text();
  console.log('Flow API response status:', response.status);
  console.log('Flow API response:', responseText);

  if (!response.ok) {
    throw new Error(`Flow API error: ${response.status} - ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse Flow response:', responseText);
    throw new Error('Invalid response from Flow API');
  }
  
  if (data.status !== 1) {
    throw new Error(`Flow payment creation failed: ${data.message || 'Unknown error'}`);
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
