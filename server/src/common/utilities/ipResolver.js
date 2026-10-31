/**
 * Network Client IP Resolver & Spoofing Guard
 *
 * Provides safe, authoritative resolution of client IP addresses.
 * Defends against client IP spoofing across diverse proxy/direct deployment topologies:
 * - Direct untrusted connections cannot forge their IP via CF-Connecting-IP or X-Forwarded-For.
 * - In trusted proxy topologies (behind Cloudflare / Nginx / Docker ingress), CF-Connecting-IP is respected
 *   only when the request arrives through a verified trusted proxy hop (loopback or RFC1918 private subnet).
 * - IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1, ::ffff:10.0.0.1) are normalized before evaluation.
 */

function resolveAuthenticClientIp(req) {
  if (!req) return "";

  const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || "";

  // Normalize IPv4-mapped IPv6 representation (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalizedSocketIp = socketIp.startsWith("::ffff:") ? socketIp.substring(7) : socketIp;

  // Check trust proxy setting on Express app if present
  const hasTrustProxyConfigured =
    req.app && typeof req.app.get === "function" ? req.app.get("trust proxy") : undefined;

  // If Express trust proxy is explicitly disabled (e.g. false or 0), never trust forwarding headers
  if (hasTrustProxyConfigured === false || hasTrustProxyConfigured === 0) {
    return socketIp || req.ip || "127.0.0.1";
  }

  // Determine if the immediate socket connection is from a trusted proxy hop (loopback or RFC1918 private network)
  const isTrustedHop =
    !normalizedSocketIp ||
    normalizedSocketIp === "127.0.0.1" ||
    normalizedSocketIp === "::1" ||
    normalizedSocketIp.startsWith("10.") ||
    normalizedSocketIp.startsWith("192.168.") ||
    normalizedSocketIp.startsWith("172.16.") ||
    normalizedSocketIp.startsWith("172.17.") ||
    normalizedSocketIp.startsWith("172.18.") ||
    normalizedSocketIp.startsWith("172.19.") ||
    normalizedSocketIp.startsWith("172.20.") ||
    normalizedSocketIp.startsWith("172.21.") ||
    normalizedSocketIp.startsWith("172.22.") ||
    normalizedSocketIp.startsWith("172.23.") ||
    normalizedSocketIp.startsWith("172.24.") ||
    normalizedSocketIp.startsWith("172.25.") ||
    normalizedSocketIp.startsWith("172.26.") ||
    normalizedSocketIp.startsWith("172.27.") ||
    normalizedSocketIp.startsWith("172.28.") ||
    normalizedSocketIp.startsWith("172.29.") ||
    normalizedSocketIp.startsWith("172.30.") ||
    normalizedSocketIp.startsWith("172.31.") ||
    normalizedSocketIp.startsWith("fc00:") ||
    normalizedSocketIp.startsWith("fe80:");

  // When arriving from a trusted proxy hop, check Cloudflare's CF-Connecting-IP header
  if (isTrustedHop && req.headers && req.headers["cf-connecting-ip"]) {
    const cfIp = String(req.headers["cf-connecting-ip"]).trim();
    if (cfIp) return cfIp;
  }

  // Fall back to Express-computed req.ip (which validates proxy hops via proxy-addr)
  if (req.ip) {
    return req.ip;
  }

  return socketIp || "127.0.0.1";
}

module.exports = {
  resolveAuthenticClientIp,
};
