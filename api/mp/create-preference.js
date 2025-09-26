// /api/mp/create-preference.js
const mercadopago = require('mercadopago');
const { Redis } = require('@upstash/redis');

// Configure Mercado Pago SDK
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

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
    const { 
      experience, 
      price, 
      userEmail, 
      userName, 
      phone, 
      preferredDate,
      comments 
    } = req.body;

    // Create preference
    const preference = {
      items: [
        {
          title: `Vinculemos - ${experience}`,
          unit_price: parseInt(price),
          quantity: 1,
          currency_id: 'CLP',
        },
      ],
      payer: {
        name: userName,
        email: userEmail,
        phone: {
          number: phone
        }
      },
      back_urls: {
        success: `${process.env.BASE_URL}/payment/success`,
        failure: `${process.env.BASE_URL}/payment/failure`,
        pending: `${process.env.BASE_URL}/payment/pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.BASE_URL}/api/mp/webhook`,
      metadata: {
        experience,
        preferredDate,
        comments,
        userEmail,
        userName,
        phone,
      },
    };

    const result = await mercadopago.preferences.create(preference);
    
    // Store payment session in Redis with 1-hour expiration
    const paymentSession = {
      preferenceId: result.body.id,
      userEmail,
      userName,
      phone,
      experience,
      price: parseInt(price),
      preferredDate,
      comments,
      createdAt: new Date().toISOString(),
    };
    
    await redis.setex(
      `payment:session:${result.body.id}`, 
      3600, // 1 hour expiration
      JSON.stringify(paymentSession)
    );
    
    res.status(200).json({
      id: result.body.id,
      init_point: result.body.init_point,
      sandbox_init_point: result.body.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error creating preference:', error);
    res.status(500).json({ error: 'Error creating payment preference' });
  }
}
