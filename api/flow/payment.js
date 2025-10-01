// /api/flow/payment.js - Vercel Serverless Function para integración con Flow

import crypto from 'crypto';

// Configuración de Flow - REEMPLAZAR CON TUS CREDENCIALES REALES
const FLOW_CONFIG = {
  // Sandbox credentials (para pruebas)
  API_URL: process.env.FLOW_API_URL || 'https://sandbox.flow.cl/api',
  API_KEY: process.env.FLOW_API_KEY || 'tu_api_key_aqui',
  SECRET_KEY: process.env.FLOW_SECRET_KEY || 'tu_secret_key_aqui',
  
  // URLs de retorno
  URL_CONFIRMATION: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/flow/confirm` : 'http://localhost:3000/api/flow/confirm',
  URL_RETURN: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/payment/success` : 'http://localhost:3000/payment/success.html'
};

// Función para generar firma Flow
function generateFlowSignature(params, secretKey) {
  // Ordenar parámetros alfabéticamente y crear string
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys.map(key => `${key}${params[key]}`).join('');
  
  // Generar HMAC SHA256
  return crypto.createHmac('sha256', secretKey).update(signString).digest('hex');
}

// Función para generar número de orden único
function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `VIN-${timestamp}-${random}`;
}

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { experience, name, email, phone, date, comments, price } = req.body;

    // Validar datos requeridos
    if (!experience || !name || !email || !phone || !date || !price) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Generar número de orden único
    const commerceOrder = generateOrderNumber();

    // Preparar parámetros para Flow
    const flowParams = {
      apiKey: FLOW_CONFIG.API_KEY,
      commerceOrder: commerceOrder,
      subject: `Vinculemos - ${experience}`,
      currency: 'CLP',
      amount: parseInt(price),
      email: email,
      paymentMethod: 9, // 9 = Todos los medios de pago
      urlConfirmation: FLOW_CONFIG.URL_CONFIRMATION,
      urlReturn: FLOW_CONFIG.URL_RETURN,
      // Datos adicionales para confirmación
      optional: JSON.stringify({
        name: name,
        phone: phone,
        date: date,
        comments: comments,
        experience: experience
      })
    };

    // Generar firma
    const signature = generateFlowSignature(flowParams, FLOW_CONFIG.SECRET_KEY);
    flowParams.s = signature;

    // Crear formulario URL-encoded para Flow
    const formData = new URLSearchParams();
    Object.keys(flowParams).forEach(key => {
      formData.append(key, flowParams[key]);
    });

    // Llamar a Flow API
    const flowResponse = await fetch(`${FLOW_CONFIG.API_URL}/payment/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const flowResult = await flowResponse.json();

    if (flowResult.url && flowResult.token) {
      // Aquí podrías guardar la información en una base de datos
      // Por ahora, solo devolvemos la URL de pago
      
      return res.status(200).json({
        success: true,
        flowUrl: `${flowResult.url}?token=${flowResult.token}`,
        commerceOrder: commerceOrder,
        token: flowResult.token
      });
    } else {
      throw new Error(flowResult.message || 'Error al crear el pago en Flow');
    }

  } catch (error) {
    console.error('Error en Flow payment:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

// Configuración para Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
