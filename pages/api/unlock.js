// pages/api/unlock.js
export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  } 

  const { password } = req.body;

  if (password === process.env.SECRET_KEY) {
    // ✅ Return a proper Bearer token
    return res.status(200).json({ token: process.env.SECRET_KEY });
  }

  return res.status(401).send("Unauthorized");
}
