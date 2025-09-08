// pages/api/contacts.js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  console.log("📥 Request received:", req.method);

  const { method } = req;
 
  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.SECRET_KEY}`) {
    console.warn("🚨 Unauthorized request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (method === "GET") {
      const contacts = (await kv.get("contacts")) || [];
      return res.status(200).json(contacts);
    }

    if (method === "POST") {
      const newContact = req.body;
      let contacts = (await kv.get("contacts")) || [];
      contacts.push(newContact);
      await kv.set("contacts", contacts);
      return res.status(201).json({ success: true });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (err) {
    console.error("❌ Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
