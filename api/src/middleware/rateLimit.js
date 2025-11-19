// SkillForge AI — Rate Limiter Middleware (Token Bucket Strategy)

const buckets = new Map();

/**
 * Simple in-memory rate limiter (per IP or user ID)
 * Window: RATE_WINDOW_MS (default 60s)
 * Max requests: RATE_MAX_REQUESTS (default 30)
 */
export default function rateLimit(req, res, next) {
  try {
    const key = req.user?.id || req.ip;
    const now = Date.now();

    const windowMs = Number(process.env.RATE_WINDOW_MS || 60_000);
    const maxReq = Number(process.env.RATE_MAX_REQUESTS || 30);

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }

    // reset bucket after window
    if (now > bucket.reset) {
      bucket.count = 0;
      bucket.reset = now + windowMs;
    }

    bucket.count++;
    buckets.set(key, bucket);

    const remaining = Math.max(0, maxReq - bucket.count);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", bucket.reset);

    if (bucket.count > maxReq) {
      console.warn(`⚠️ Rate limit exceeded for ${key}`);
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please slow down and try again later.",
      });
    }

    next();
  } catch (err) {
    console.error("RateLimit middleware error:", err);
    next(); // always allow fallback
  }
}
