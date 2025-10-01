// /api/flow/confirm.js - Endpoint de confirmación de pago Flow

import crypto from 'crypto';

// Configuración de Flow
const FLOW_CONFIG = {
  API_URL: process.env.FLOW_API_URL || 'https://sandbox.flow.cl/api',
  API_KEY: process.env.FLOW_API_KEY || 'tu_api_key_aqui',
  SECRET_KEY: process.env.FLOW_SECRET_KEY || 'tu_secret_key_aqui'
};

// Función para generar firma Flow
function generateFlowSignature(params, secretKey) {
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys.map(key => `${key}${params[key]}`).join('');
  return crypto.createHmac('sha256', secretKey).update(signString).digest('hex');
}

// Función para verificar firma Flow
function verifyFlowSignature(params, signature, secretKey) {
  const expectedSignature = generateFlowSignature(params, secretKey);
  return expectedSignature === signature;
}

// Función para enviar email de confirmación (opcional)
async function sendConfirmationEmail(paymentData) {
  // Aquí puedes integrar con un servicio de email como SendGrid, Resend, etc.
  console.log('Enviando email de confirmación:', paymentData);
  
  // Ejemplo básico con fetch a un webhook de FormSubmit
  try {
    const emailData = {
      to: paymentData.payer,
      subject: 'Confirmación de Pago - Vinculemos',
      message: `
        Hola ${paymentData.optional?.name || 'Cliente'},
        
        ¡Tu pago ha sido confirmado exitosamente!
        
        Detalles de la reserva:
        - Experiencia: ${paymentData.optional?.experience || 'No especificado'}
        - Monto: $${paymentData.amount} CLP
        - Fecha preferida: ${paymentData.optional?.date || 'No especificada'}
        - Número de orden: ${paymentData.commerceOrder}
        
        Te contactaremos pronto para confirmar los detalles finales.
        
        ¡Gracias por elegir Vinculemos!
      `
    };
    
    // Enviar a FormSubmit como backup
    await fetch('https://formsubmit.co/vinculemos.marketingdigital@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        _subject: 'Pago Confirmado - Vinculemos',
        _template: 'table',
        commerce_order: paymentData.commerceOrder,
        amount: paymentData.amount,
        payer_email: paymentData.payer,
        status: paymentData.status,
        payment_data: JSON.stringify(paymentData.optional)
      })
    });
    
  } catch (error) {
    console.error('Error enviando email:', error);
  }
}

export default async function handler(req, res) {
  // Flow envía confirmaciones via POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { token, s } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Verificar el pago con Flow
    const verifyParams = {
      apiKey: FLOW_CONFIG.API_KEY,
      token: token
    };

    const signature = generateFlowSignature(verifyParams, FLOW_CONFIG.SECRET_KEY);
    verifyParams.s = signature;

    const formData = new URLSearchParams();
    Object.keys(verifyParams).forEach(key => {
      formData.append(key, verifyParams[key]);
    });

    // Consultar estado del pago en Flow
    const flowResponse = await fetch(`${FLOW_CONFIG.API_URL}/payment/getStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const paymentData = await flowResponse.json();

    if (paymentData.status === 2) { // 2 = Pago exitoso
      // Procesar pago exitoso
      console.log('Pago confirmado:', paymentData);
      
      // Parsear datos opcionales
      let optionalData = {};
      try {
        optionalData = JSON.parse(paymentData.optional || '{}');
      } catch (e) {
        console.log('Error parsing optional data:', e);
      }

      // Aquí puedes:
      // 1. Guardar en base de datos
      // 2. Enviar emails de confirmación
      // 3. Actualizar inventario
      // 4. Enviar notificaciones

      // Enviar email de confirmación
      await sendConfirmationEmail({
        ...paymentData,
        optional: optionalData
      });

      // Respuesta exitosa a Flow
      return res.status(200).send('PAYMENT_CONFIRMED');
      
    } else {
      // Pago no exitoso
      console.log('Pago no confirmado:', paymentData);
      return res.status(400).json({ 
        error: 'Pago no confirmado',
        status: paymentData.status 
      });
    }

  } catch (error) {
    console.error('Error en confirmación de pago:', error);
    return res.status(500).json({ 
      error: 'Error interno',
      details: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}
