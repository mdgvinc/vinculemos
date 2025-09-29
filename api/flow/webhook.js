const { Redis } = require('@upstash/redis');

// Initialize Upstash Redis with new variable names
const redis = new Redis({
  url: process.env.flow_REDIS_URL,
  token: process.env.flow_REST_API_TOKEN || process.env.flow_KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Flow webhook received:', req.body);
    
    const { token, status, commerceOrder, flowOrder, amount, pendingReason } = req.body;

    // Verify the token (security check)
    if (!verifyFlowToken(token, commerceOrder, status, process.env.FLOW_SECRET_KEY)) {
      console.error('Invalid token in webhook');
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Get payment session from Redis
    const paymentSessionKey = `payment:session:${commerceOrder}`;
    const paymentSession = await redis.get(paymentSessionKey);
    
    if (!paymentSession) {
      console.error('Payment session not found:', commerceOrder);
      return res.status(404).json({ error: 'Payment session not found' });
    }

    const sessionData = JSON.parse(paymentSession);
    
    // Update payment status based on Flow status
    let newStatus = 'pending';
    switch (parseInt(status)) {
      case 1: // Payment approved
        newStatus = 'completed';
        await handleSuccessfulPayment(sessionData, commerceOrder, flowOrder, amount);
        break;
      case 2: // Payment rejected
        newStatus = 'rejected';
        break;
      case 3: // Payment pending
        newStatus = 'pending';
        break;
      case 4: // Payment abandoned
        newStatus = 'abandoned';
        break;
      default:
        newStatus = 'unknown';
    }

    // Update payment session with new status
    sessionData.status = newStatus;
    sessionData.flowOrder = flowOrder;
    sessionData.updatedAt = new Date().toISOString();
    sessionData.pendingReason = pendingReason;

    await redis.setex(
      paymentSessionKey,
      86400, // Reset expiration to 24 hours
      JSON.stringify(sessionData)
    );

    // Store payment record
    await redis.hset(
      `user:${sessionData.userEmail}:payments`,
      { [commerceOrder]: JSON.stringify({
        paymentId: commerceOrder,
        flowOrder,
        userEmail: sessionData.userEmail,
        userName: sessionData.userName,
        phone: sessionData.phone,
        experience: sessionData.experience,
        amount: sessionData.price,
        preferredDate: sessionData.preferredDate,
        comments: sessionData.comments,
        paymentDate: new Date().toISOString(),
        status: newStatus,
        pendingReason
      })}
    );

    console.log(`Payment ${commerceOrder} updated to status: ${newStatus}`);
    
    res.status(200).json({ received: true, status: newStatus });
  } catch (error) {
    console.error('Flow webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed: ' + error.message });
  }
};

// Handle successful payment
async function handleSuccessfulPayment(sessionData, commerceOrder, flowOrder, amount) {
  // Update user profile or create if doesn't exist
  const userKey = `user:${sessionData.userEmail}`;
  const existingUser = await redis.get(userKey);
  
  if (existingUser) {
    const userData = JSON.parse(existingUser);
    await redis.set(
      userKey,
      JSON.stringify({
        ...userData,
        lastPayment: new Date().toISOString(),
        totalPayments: (userData.totalPayments || 0) + 1,
        totalSpent: (userData.totalSpent || 0) + parseInt(amount)
      })
    );
  } else {
    // Create new user profile
    await redis.set(
      userKey,
      JSON.stringify({
        email: sessionData.userEmail,
        name: sessionData.userName,
        phone: sessionData.phone,
        signupDate: new Date().toISOString(),
        lastPayment: new Date().toISOString(),
        totalPayments: 1,
        totalSpent: parseInt(amount),
        preferences: {
          interests: [sessionData.experience]
        }
      })
    );
    
    // Add to users list
    await redis.sadd('users:all', sessionData.userEmail);
  }

  // Add to payments list for analytics
  await redis.lpush(
    'payments:all',
    JSON.stringify({
      paymentId: commerceOrder,
      flowOrder,
      userEmail: sessionData.userEmail,
      experience: sessionData.experience,
      amount: parseInt(amount),
      status: 'completed',
      paymentDate: new Date().toISOString()
    })
  );

  console.log('Successful payment processed for:', sessionData.userEmail);
  
  // Here you can send confirmation email
  // await sendConfirmationEmail(sessionData.userEmail, sessionData.experience);
}

// Verify Flow token
function verifyFlowToken(token, commerceOrder, status, secretKey) {
  const crypto = require('crypto');
  
  // Flow token is HMAC-SHA256 of commerceOrder + status
  const message = commerceOrder + status;
  const expectedToken = crypto.createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');
    
  return token === expectedToken;
}
