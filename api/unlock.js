export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { password } = req.body;
  if (password === process.env.SECRET_KEY) {
    // return the secret itself
    return res.status(200).send(process.env.SECRET_KEY);
  }
  return res.status(401).send("Unauthorized");
}
