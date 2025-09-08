import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "contacts.json");

export default function handler(req, res) {
  const { token } = req.query;
  if (token !== "VALID_TOKEN") return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.status(200).json(data);
  } else if (req.method === "POST") {
    const contact = req.body;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.push(contact);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.status(200).json({ ok: true });
  } else {
    res.status(405).end();
  }
}
