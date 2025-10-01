// /api/payment/confirm.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("Flow confirmation:", req.body);

    // You can verify the signature here with secretKey (recommended)

    // Save confirmation in DB / send email, etc.
    res.status(200).send("OK");
  } catch (err) {
    console.error("Confirm error:", err);
    res.status(500).send("Error");
  }
}
