// /api/flow/payment.js - Vercel Serverless Function para integración con Flow (CommonJS)
const crypto = require('crypto');

console.log('=== PAYMENT.JS LOADED ===');

// Configuración de Flow
const FLOW_CONFIG = {
  API_URL: process.env.FLOW_API_URL || 'https://sandbox.flow.cl/api',
  API_KEY: process.env.FLOW_API_KEY,
  SECRET_KEY: process.env.FLOW_SECRET_KEY,
  URL_CONFIRMATION: process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/api/flow/confirm` 
    : 'http://localhost:3000/api/flow/confirm',
  URL_RETURN: process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/payment/success.html` 
    : 'http://localhost:3000/payment/success.html'
};

console.log('Flow config check:', {
  hasApiKey: !!FLOW_CONFIG.API_KEY,
  hasSecretKey: !!FLOW_CONFIG.SECRET_KEY,
  apiUrl: FLOW_CONFIG.API_URL
});

// Función para generar firma Flow
function generateFlowSignature(params, secretKey) {
  try {
    const sortedKeys = Object.keys(params).sort();
    const signString = sortedKeys.map(key => `${key}${params[key]}`).join('');
    return crypto.createHmac('sha256', secretKey).update(signString).digest('hex');
  } catch (error) {
    console.error('Signature generation error:', error);
    throw error;
  }
}

// Función para generar número de orden único
function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `VIN-${timestamp}-${random}`;
}

module.exports = async function handler(req, res) {
  console.log('=== HANDLER CALLED ===', {
    method: req.method,
    url: req.url
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Validate environment variables
  if (!FLOW_CONFIG.API_KEY || !FLOW_CONFIG.SECRET_KEY) {
    console.error('MISSING CREDENTIALS:', {
      API_KEY: FLOW_CONFIG.API_KEY,
      SECRET_KEY: FLOW_CONFIG.SECRET_KEY
    });
    return res.status(500).json({ 
      error: 'Configuración incompleta',
      details: 'Credenciales de Flow no configuradas correctamente'
    });
  }

  try {
    console.log('Request body received');
    const body = req.body || {};
    console.log('Body:', body);

    // FIX: Use 'genero' instead of 'genre' and 'date' is no longer used
    const { experience, name, email, phone, genero, comments, price } = body;

    // FIX: Validate 'genero' instead of 'genre' and remove 'date'
    if (!experience || !name || !email || !phone || !genero || !price) {
      console.log('Missing required fields:', { experience, name, email, phone, genero, price });
      return res.status(400).json({ 
        error: 'Faltan datos requeridos',
        received: { experience, name, email, phone, genero, price }
      });
    }

    const amount = parseInt(price);
    if (isNaN(amount) || amount <= 0) {
      console.log('Invalid price:', price);
      return res.status(400).json({ error: 'Precio inválido' });
    }

    const commerceOrder = generateOrderNumber();
    console.log('Generated order:', commerceOrder);

    // Preparar parámetros para Flow
    const flowParams = {
      apiKey: FLOW_CONFIG.API_KEY,
      commerceOrder: commerceOrder,
      subject: `Vinculemos - ${experience}`,
      currency: 'CLP',
      amount: amount,
      email: email,
      paymentMethod: 9, // 9 = Todos los medios de pago
      urlConfirmation: FLOW_CONFIG.URL_CONFIRMATION,
      urlReturn: FLOW_CONFIG.URL_RETURN,
      // Datos adicionales para confirmación
      // FIX: Use 'genero' in the optional data
      optional: JSON.stringify({
        name: name,
        phone: phone,
        genero: genero,
        comments: comments || '',
        experience: experience
      })
    };

    console.log('Flow params prepared:', flowParams);

    // Generar firma
    const signature = generateFlowSignature(flowParams, FLOW_CONFIG.SECRET_KEY);
    flowParams.s = signature;

    // Crear formulario URL-encoded para Flow
    const formData = new URLSearchParams();
    Object.keys(flowParams).forEach(key => {
      formData.append(key, flowParams[key]);
    });

    console.log('Calling Flow API...', FLOW_CONFIG.API_URL);

    // Llamar a Flow API
    const flowResponse = await fetch(`${FLOW_CONFIG.API_URL}/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    console.log('Flow API response status:', flowResponse.status);

    const flowResult = await flowResponse.json();
    console.log('Flow API response:', flowResult);

    if (flowResult.url && flowResult.token) {
      console.log('Payment created successfully');
      
      return res.status(200).json({
        success: true,
        flowUrl: `${flowResult.url}?token=${flowResult.token}`,
        commerceOrder: commerceOrder,
        token: flowResult.token
      });
    } else {
      console.error('Flow API error response:', flowResult);
      throw new Error(flowResult.message || 'Error al crear el pago en Flow');
    }

  } catch (error) {
    console.error('FATAL ERROR in handler:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message
    });
  }
};
