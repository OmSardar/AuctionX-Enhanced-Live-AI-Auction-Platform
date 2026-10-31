const passport = require("passport");
const configureGoogleStrategy = require("../../../src/infrastructure/security/passportGoogleStrategy");

describe("Passport Google Strategy Unit Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Strategy Configuration & Environment Independence", () => {
    it("should initialize safely without throwing when Google OAuth credentials are not set", () => {
      expect(() => {
        const result = configureGoogleStrategy();
        expect(result).toBe(false);
      }).not.toThrow();

      const registered = passport._strategy("google");
      expect(registered).toBeDefined();
      expect(registered.name).toBe("google");
      expect(registered instanceof configureGoogleStrategy.UnconfiguredGoogleStrategy).toBe(true);
    });

    it("should correctly report isConfigured() status based on environment variables", () => {
      expect(configureGoogleStrategy.isConfigured()).toBe(false);

      process.env.GOOGLE_CLIENT_ID = "mock-client-id";
      expect(configureGoogleStrategy.isConfigured()).toBe(false);

      process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
      expect(configureGoogleStrategy.isConfigured()).toBe(true);

      process.env.GOOGLE_CLIENT_ID = "   ";
      expect(configureGoogleStrategy.isConfigured()).toBe(false);
    });

    it("should support dependency injection via options to configure live GoogleStrategy", () => {
      const result = configureGoogleStrategy({
        clientID: "test-injected-client-id.apps.googleusercontent.com",
        clientSecret: "test-injected-client-secret",
        callbackURL: "/test/callback",
      });

      expect(result).toBe(true);
      const registered = passport._strategy("google");
      expect(registered).toBeDefined();
      expect(registered.name).toBe("google");
      expect(registered instanceof configureGoogleStrategy.UnconfiguredGoogleStrategy).toBe(false);
    });
  });

  describe("Unconfigured Fallback Strategy Behavior", () => {
    it("should return HTTP 501 error when JSON client invokes unconfigured strategy", (done) => {
      configureGoogleStrategy(); // Configures UnconfiguredGoogleStrategy

      const req = {
        headers: {
          accept: "application/json",
        },
      };

      const strategy = passport._strategy("google");
      const instance = Object.create(strategy);
      instance.error = (err) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.status).toBe(501);
        expect(err.message).toContain("Google OAuth is not configured on this server");
        done();
      };

      instance.authenticate(req, {});
    });

    it("should redirect to client login with error when browser user agent invokes unconfigured strategy", (done) => {
      process.env.CLIENT_URL = "http://localhost:3000";
      configureGoogleStrategy();

      const req = {
        headers: {
          accept: "text/html,application/xhtml+xml",
        },
      };

      const strategy = passport._strategy("google");
      const instance = Object.create(strategy);
      instance.redirect = (url) => {
        expect(url).toBe("http://localhost:3000/login?error=oauth_unconfigured");
        done();
      };

      instance.authenticate(req, {});
    });
  });
});
