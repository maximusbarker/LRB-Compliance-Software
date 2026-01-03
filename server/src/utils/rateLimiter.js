// Rate limiter for login attempts
// Tracks failed login attempts by IP address and blocks after 5 attempts for 5 minutes

const attempts = new Map(); // IP -> { count: number, blockedUntil: timestamp }

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function getClientIP(req) {
  // Check various headers for the real IP (in case of proxies)
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

function isBlocked(ip) {
  const record = attempts.get(ip);
  if (!record) return false;
  
  // Check if still blocked
  if (record.blockedUntil && Date.now() < record.blockedUntil) {
    return true;
  }
  
  // Block expired, reset
  if (record.blockedUntil && Date.now() >= record.blockedUntil) {
    attempts.delete(ip);
    return false;
  }
  
  return false;
}

function recordFailedAttempt(ip) {
  const record = attempts.get(ip) || { count: 0 };
  record.count += 1;
  
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }
  
  attempts.set(ip, record);
  return record;
}

function recordSuccess(ip) {
  // Clear attempts on successful login
  attempts.delete(ip);
}

function getRemainingAttempts(ip) {
  const record = attempts.get(ip);
  if (!record) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - record.count);
}

function getBlockedUntil(ip) {
  const record = attempts.get(ip);
  if (!record || !record.blockedUntil) return null;
  return record.blockedUntil;
}

// Cleanup old entries periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts.entries()) {
    if (record.blockedUntil && now >= record.blockedUntil) {
      attempts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

export {
  getClientIP,
  isBlocked,
  recordFailedAttempt,
  recordSuccess,
  getRemainingAttempts,
  getBlockedUntil
};


