const {
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
} = require("../../src/infrastructure/security/totpService");

describe("TOTP & 2FA Service Unit Tests", () => {
  const sampleSecret = "JBSWY3DPEHPK3PXP"; // "Hello!" in Base32

  describe("Base32 encoding and decoding", () => {
    test("should encode and decode arbitrary buffers losslessly", () => {
      const original = Buffer.from("AuctionX Secure MFA Test 2026", "utf8");
      const encoded = base32Encode(original);
      const decoded = base32Decode(encoded);
      expect(decoded.toString("utf8")).toBe("AuctionX Secure MFA Test 2026");
    });

    test("generateBase32Secret should generate 32-character secret from 20 bytes", () => {
      const secret = generateBase32Secret(20);
      expect(typeof secret).toBe("string");
      expect(secret.length).toBe(32);
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
    });

    test("base32Decode throws on invalid base32 characters", () => {
      expect(() => base32Decode("INVALID890")).toThrow("Invalid base32 character");
    });
  });

  describe("TOTP generation and verification (RFC 6238)", () => {
    test("generateTotp returns 6-digit numeric string", () => {
      const now = Math.floor(Date.now() / 1000);
      const { otp, step } = generateTotp(sampleSecret, now);

      expect(typeof otp).toBe("string");
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      expect(step).toBe(Math.floor(now / 30));
    });

    test("verifyTotp succeeds with current token", () => {
      const now = Math.floor(Date.now() / 1000);
      const { otp } = generateTotp(sampleSecret, now);

      const result = verifyTotp(otp, sampleSecret, { window: 1 });
      expect(result.valid).toBe(true);
      expect(result.isReplay).toBe(false);
    });

    test("verifyTotp accepts tokens within ±1 drift window (30s ago)", () => {
      const pastTime = Math.floor(Date.now() / 1000) - 30; // 1 step ago
      const { otp } = generateTotp(sampleSecret, pastTime);

      const result = verifyTotp(otp, sampleSecret, { window: 1 });
      expect(result.valid).toBe(true);
    });

    test("verifyTotp rejects tokens older than window (>60s ago)", () => {
      const staleTime = Math.floor(Date.now() / 1000) - 90; // 3 steps ago
      const { otp } = generateTotp(sampleSecret, staleTime);

      const result = verifyTotp(otp, sampleSecret, { window: 1 });
      expect(result.valid).toBe(false);
    });

    test("verifyTotp rejects invalid token formats", () => {
      expect(verifyTotp("12345", sampleSecret).valid).toBe(false);
      expect(verifyTotp("1234567", sampleSecret).valid).toBe(false);
      expect(verifyTotp("abcdef", sampleSecret).valid).toBe(false);
      expect(verifyTotp("", sampleSecret).valid).toBe(false);
      expect(verifyTotp(null, sampleSecret).valid).toBe(false);
    });

    test("verifyTotp prevents replay attacks on same time step", () => {
      const now = Math.floor(Date.now() / 1000);
      const { otp, step } = generateTotp(sampleSecret, now);

      // First verification: success
      const firstResult = verifyTotp(otp, sampleSecret, { window: 1, lastVerifiedStep: 0 });
      expect(firstResult.valid).toBe(true);
      expect(firstResult.step).toBe(step);

      // Replay attempt with same step must be rejected
      const replayResult = verifyTotp(otp, sampleSecret, {
        window: 1,
        lastVerifiedStep: step,
      });
      expect(replayResult.valid).toBe(false);
      expect(replayResult.isReplay).toBe(true);
    });
  });

  describe("Recovery codes generation and hashing", () => {
    test("generateRecoveryCodes creates 8 unique codes and matching hashes", () => {
      const { plainCodes, hashedCodes } = generateRecoveryCodes(8);

      expect(plainCodes).toHaveLength(8);
      expect(hashedCodes).toHaveLength(8);

      // Code format: XXXX-XXXX
      plainCodes.forEach((code) => {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });

      // Verify hashes match
      plainCodes.forEach((code, idx) => {
        expect(hashedCodes[idx].codeHash).toBe(hashRecoveryCode(code));
        expect(hashedCodes[idx].used).toBe(false);
        expect(hashedCodes[idx].usedAt).toBeNull();
      });
    });

    test("hashRecoveryCode is case-insensitive and ignores hyphens/spaces", () => {
      const code1 = "A1B2-C3D4";
      const code2 = "a1b2c3d4";
      const code3 = " A1B2 C3D4 ";
      expect(hashRecoveryCode(code1)).toBe(hashRecoveryCode(code2));
      expect(hashRecoveryCode(code1)).toBe(hashRecoveryCode(code3));
    });
  });

  describe("Secret Encryption & Decryption (AES-256-GCM)", () => {
    test("encryptSecret and decryptSecret round-trip properly", () => {
      const secret = generateBase32Secret(20);
      const encrypted = encryptSecret(secret);

      expect(typeof encrypted).toBe("string");
      expect(encrypted).not.toBe(secret);
      expect(encrypted.split(":")).toHaveLength(3); // iv:tag:data

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    test("decryptSecret fails when ciphertext is tampered", () => {
      const secret = generateBase32Secret(20);
      const encrypted = encryptSecret(secret);
      const parts = encrypted.split(":");

      // Tamper with ciphertext data
      const tampered = `${parts[0]}:${parts[1]}:bad0${parts[2].slice(4)}`;
      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  describe("URI and QR Code generation", () => {
    test("generateTotpUri formats valid otpauth URI", () => {
      const uri = generateTotpUri(sampleSecret, "user@auctionx.com", "AuctionX");
      expect(uri).toContain("otpauth://totp/AuctionX:user%40auctionx.com");
      expect(uri).toContain(`secret=${sampleSecret}`);
      expect(uri).toContain("issuer=AuctionX");
      expect(uri).toContain("period=30");
      expect(uri).toContain("digits=6");
    });

    test("generateQrCodeDataUrl produces valid PNG Data URL", async () => {
      const uri = generateTotpUri(sampleSecret, "user@auctionx.com");
      const dataUrl = await generateQrCodeDataUrl(uri);

      expect(typeof dataUrl).toBe("string");
      expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(dataUrl.length).toBeGreaterThan(100);
    });
  });
});
