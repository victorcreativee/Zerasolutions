// Per-process protection for the single-server deployment. Do not trust forwarded IP headers.
export function createLoginThrottle({ limit = 30, windowMs = 60_000, maxEntries = 10_000, now = Date.now } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, value] of attempts) if (value.until <= time) attempts.delete(key);
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (!entry) {
      // Bound memory without evicting an active limit under a flood of new addresses.
      if (attempts.size >= maxEntries) {
        res.set('Retry-After', '60');
        return res.status(429).json({ message: 'Too many sign-in attempts. Try again shortly.' });
      }
      entry = { count: 0, until: time + windowMs };
      attempts.set(key, entry);
    }
    if (++entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - time) / 1000))));
      return res.status(429).json({ message: 'Too many sign-in attempts. Try again shortly.' });
    }
    next();
  };
}
