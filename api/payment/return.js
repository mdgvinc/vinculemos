// /api/payment/return.js
export default function handler(req, res) {
  // Flow sends ?token=xxxx in query
  const { token } = req.query;

  // Redirect to your success page
  res.redirect(`/payment/success.html?token=${token}`);
}
