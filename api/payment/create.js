// /api/payment/create.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { experience, price, userEmail, userName, phone, preferredDate, comments } = req.body;

    // Flow credentials (store in Vercel env vars)
    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const baseUrl = "https://sandbox.flow.cl/api"; // Change to production when ready

    const commerceOrder = `ORDER-${Date.now()}`;
    const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/return`;
    const confirmUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/payment/confirm`;

    // Build request params
    const params = {
      apiKey,
      commerceOrder,
      subject: experience,
      currency: "CLP",
      amount: price,
      email: userEmail,
      urlConfirmation: confirmUrl,
      urlReturn: returnUrl,
    };

    // Generate signature (HMAC SHA256 with secretKey)
    const queryString = new URLSearchParams(params).toString();
    const crypto = await import("crypto");
    const signature = crypto.createHmac("sha256", secretKey).update(queryString).digest("hex");

    // Send request to Flow
    const flowRes = await fetch(`${baseUrl}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, s: signature }),
    });

    const data = await flowRes.json();

    if (flowRes.ok && data.url) {
      return res.status(200).json({
        success: true,
        commerceOrder,
        flowPayment: { url: data.url },
      });
    } else {
      throw new Error(data.message || "Error creating Flow payment");
    }
  } catch (err) {
    console.error("Flow error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
