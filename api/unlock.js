export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const { password } = req.body;
  if (password === process.env.SECRET_KEY) {
    // could generate a JWT instead
    res.status(200).send("VALID_TOKEN");
  } else {
    res.status(401).send("Unauthorized");
  }
}
