import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const { method } = req;

  // Auth check
  const authHeader = req.headers["authorization"];
  if (!authHeader || authHeader !== `Bearer ${process.env.SECRET_KEY}`) {
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

    if (method === "PUT") {
      const { index, updatedContact } = req.body;
      let contacts = (await kv.get("contacts")) || [];
      contacts[index] = updatedContact;
      await kv.set("contacts", contacts);
      return res.status(200).json({ success: true });
    }

    if (method === "DELETE") {
      const { index } = req.body;
      let contacts = (await kv.get("contacts")) || [];
      contacts.splice(index, 1);
      await kv.set("contacts", contacts);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
