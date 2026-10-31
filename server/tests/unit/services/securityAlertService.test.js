const {
  parseUserAgent,
  resolveApproximateLocation,
  escapeHtml,
  sendLoginSecurityAlert,
} = require("../../../src/infrastructure/security/securityAlertService");

describe("securityAlertService Unit Tests", () => {
  describe("escapeHtml", () => {
    it("escapes special HTML characters properly", () => {
      expect(escapeHtml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
      );
      expect(escapeHtml('John "The Rock" & Co.')).toBe(
        "John &quot;The Rock&quot; &amp; Co."
      );
    });

    it("handles null or non-string inputs safely", () => {
      expect(escapeHtml(null)).toBe("");
      expect(escapeHtml(undefined)).toBe("");
      expect(escapeHtml(12345)).toBe("");
    });
  });

  describe("parseUserAgent", () => {
    it("identifies Windows and Chrome Desktop", () => {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
      const result = parseUserAgent(ua);
      expect(result.browser).toBe("Google Chrome");
      expect(result.os).toBe("Windows");
      expect(result.device).toBe("Desktop");
    });

    it("identifies macOS and Safari", () => {
      const ua =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15";
      const result = parseUserAgent(ua);
      expect(result.browser).toBe("Apple Safari");
      expect(result.os).toBe("macOS");
      expect(result.device).toBe("Desktop");
    });

    it("identifies iPhone / Mobile device", () => {
      const ua =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
      const result = parseUserAgent(ua);
      expect(result.browser).toBe("Apple Safari");
      expect(result.os).toBe("iOS");
      expect(result.device).toBe("Mobile");
    });

    it("handles empty or malformed user-agent gracefully", () => {
      const result = parseUserAgent("");
      expect(result.browser).toBe("Unknown Browser");
      expect(result.os).toBe("Unknown OS");
      expect(result.device).toBe("Desktop / Device");
    });
  });

  describe("resolveApproximateLocation", () => {
    it("returns 'Local / Internal Network' for loopback addresses", () => {
      expect(resolveApproximateLocation({ ip: "127.0.0.1" })).toBe("Local / Internal Network");
      expect(resolveApproximateLocation({ ip: "::1" })).toBe("Local / Internal Network");
      expect(resolveApproximateLocation({ ip: "192.168.1.50" })).toBe("Local / Internal Network");
    });

    it("returns approximate/unavailable statement without claiming exact geocoding", () => {
      expect(resolveApproximateLocation({ ip: "203.0.113.195" })).toMatch(
        /Location details unavailable/i
      );
      expect(resolveApproximateLocation(null)).toBe("Location details unavailable");
    });
  });

  describe("sendLoginSecurityAlert", () => {
    it("returns failure when user email is absent", async () => {
      const result = await sendLoginSecurityAlert(null);
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/No user email/i);
    });

    it("deduplicates multiple rapid alerts for the same user and session", async () => {
      const fakeUser = {
        _id: "60d5ec49f1b2c82d88c0e111",
        email: "dedupe_test@example.com",
        name: "Dedupe Tester",
      };

      const options = {
        method: "Password Login",
        sessionId: "session-unique-abc-123",
        req: { ip: "127.0.0.1", headers: { "user-agent": "Mozilla/5.0 Chrome" } },
      };

      const firstCall = await sendLoginSecurityAlert(fakeUser, options);
      const secondCall = await sendLoginSecurityAlert(fakeUser, options);

      expect(secondCall.success).toBe(true);
      expect(secondCall.deduplicated).toBe(true);
    });
  });
});
