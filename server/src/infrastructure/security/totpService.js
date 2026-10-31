const crypto = require("crypto");
const QRCode = require("qrcode");

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encode a Buffer into an RFC 4648 Base32 string (without padding).
 * @param {Buffer} buffer
 * @returns {string}
 */
function base32Encode(buffer) {
  let bits = "";
  for (let i = 0; i < buffer.length; i++) {
    bits += buffer[i].toString(2).padStart(8, "0");
  }

  let base32 = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substring(i, i + 5);
    if (chunk.length < 5) {
      base32 += BASE32_CHARS[parseInt(chunk.padEnd(5, "0"), 2)];
    } else {
      base32 += BASE32_CHARS[parseInt(chunk, 2)];
    }
  }

  return base32;
}

/**
 * Decode an RFC 4648 Base32 string into a Buffer.
 * @param {string} base32
 * @returns {Buffer}
 */
function base32Decode(base32) {
  if (!base32 || typeof base32 !== "string") {
    throw new Error("Invalid base32 string");
  }

  const clean = base32.replace(/[\s=-]/g, "").toUpperCase();
  let bits = "";
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${clean[i]}`);
    }
    bits += val.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

/**
 * Generate a cryptographically secure random Base32 secret for TOTP.
 * Standard 20 bytes = 160 bits (recommended by RFC 6238).
 * @param {number} byteLength
 * @returns {string}
 */
function generateBase32Secret(byteLength = 20) {
  const randomBytes = crypto.randomBytes(byteLength);
  return base32Encode(randomBytes);
}

/**
 * Format the standard otpauth URI used by Google Authenticator, Authy, etc.
 * @param {string} secret
 * @param {string} accountName - e.g. user email
 * @param {string} issuer - defaults to "AuctionX"
 * @returns {string}
 */
function generateTotpUri(secret, accountName, issuer = "AuctionX") {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a base64 PNG Data URL for the QR Code.
 * @param {string} otpauthUri
 * @returns {Promise<string>}
 */
async function generateQrCodeDataUrl(otpauthUri) {
  return await QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#1A1512",
      light: "#FFFFFF",
    },
  });
}

/**
 * Compute RFC 6238 TOTP value for a given timestamp.
 * @param {string} secret - Base32 encoded secret
 * @param {number} time - Unix time in seconds (defaults to now)
 * @param {number} timeStep - Interval in seconds (default 30)
 * @returns {{ otp: string, step: number }}
 */
function generateTotp(secret, time = Math.floor(Date.now() / 1000), timeStep = 30) {
  const counter = Math.floor(time / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = (binary % 1000000).toString().padStart(6, "0");
  return { otp, step: counter };
}

/**
 * Verify a 6-digit TOTP token with time drift window and replay attack protection.
 * @param {string} token - The user-provided 6-digit code
 * @param {string} secret - Base32 secret
 * @param {object} options
 * @param {number} options.window - Window steps to check (default 1 = ±30s drift)
 * @param {number} options.lastVerifiedStep - Previously accepted counter step
 * @returns {{ valid: boolean, step: number, isReplay: boolean }}
 */
function verifyTotp(token, secret, options = {}) {
  if (!token || typeof token !== "string") {
    return { valid: false, step: 0, isReplay: false };
  }

  const cleanToken = token.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false, step: 0, isReplay: false };
  }

  const window = options.window ?? 1;
  const lastVerifiedStep = options.lastVerifiedStep ?? 0;
  const currentTime = Math.floor(Date.now() / 1000);
  const currentStep = Math.floor(currentTime / 30);

  // Check [currentStep - window, currentStep + window]
  for (let step = currentStep - window; step <= currentStep + window; step++) {
    const timeForStep = step * 30;
    const { otp } = generateTotp(secret, timeForStep);

    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(otp))) {
      // Replay attack check: cannot reuse the same or older step
      if (step <= lastVerifiedStep) {
        return { valid: false, step, isReplay: true };
      }
      return { valid: true, step, isReplay: false };
    }
  }

  return { valid: false, step: 0, isReplay: false };
}

/**
 * Generate 8 cryptographically secure single-use recovery codes.
 * Format: XXXX-XXXX (8 alphanumeric characters with hyphen).
 * Returns plain codes (to show user once) and hashed codes (to store in DB).
 * @param {number} count
 * @returns {{ plainCodes: string[], hashedCodes: Array<{ codeHash: string, used: boolean, usedAt: null }> }}
 */
function generateRecoveryCodes(count = 8) {
  const plainCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    const formatted = `${raw.substring(0, 4)}-${raw.substring(4, 8)}`;
    plainCodes.push(formatted);

    const codeHash = hashRecoveryCode(formatted);
    hashedCodes.push({
      codeHash,
      used: false,
      usedAt: null,
    });
  }

  return { plainCodes, hashedCodes };
}

/**
 * Hash a recovery code for secure database persistence.
 * @param {string} code
 * @returns {string}
 */
function hashRecoveryCode(code) {
  const clean = code.trim().replace(/[-\s]/g, "").toUpperCase();
  return crypto.createHash("sha256").update(clean).digest("hex");
}

/**
 * Get symmetric key for 2FA secret encryption (AES-256-GCM).
 * @returns {Buffer} 32-byte key
 */
function getEncryptionKey() {
  const masterKey = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.JWT_SECRET || "auctionx-mfa-default-key-32bytes!";
  return crypto.createHash("sha256").update(masterKey).digest();
}

/**
 * Encrypt a secret before saving to MongoDB using AES-256-GCM.
 * Format: "ivHex:tagHex:encryptedHex"
 * @param {string} secret
 * @returns {string}
 */
function encryptSecret(secret) {
  if (!secret) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an AES-256-GCM encrypted secret.
 * @param {string} ciphertext
 * @returns {string}
 */
function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format for 2FA secret");
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(data, null, "utf8") + decipher.final("utf8");
}

module.exports = {
  base32Encode,
  base32Decode,
  generateBase32Secret,
  generateTotpUri,
  generateQrCodeDataUrl,
  generateTotp,
  verifyTotp,
  generateRecoveryCodes,
  hashRecoveryCode,
  encryptSecret,
  decryptSecret,
};
