export default function aiAuth(req, res, next) {
  if (req.headers["x-ai-secret"] !== process.env.AI_SERVICE_SECRET)
    return res.status(403).json({ message: "Invalid AI service" });
  next();
}
