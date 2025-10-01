export default async function handler(req, res) {
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
    
    // For now, just return success without Redis or Flow
    console.log('Creating payment (test mode):', commerceOrder);
    
    res.status(200).json({
      success: true,
      commerceOrder,
      flowPayment: {
        url: `https://www.flow.cl/app/web/paymentRedirect.php?token=test_${commerceOrder}`,
        token: `test_${commerceOrder}`
      },
      message: 'Payment created successfully (test mode)'
    });
    
  } catch (error) {
    console.error('Error creating payment:', error);
    
    res.status(500).json({ 
      error: 'Error creating payment',
      message: error.message
    });
  }
}
