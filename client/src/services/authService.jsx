// src/services/authService.js - Updated to work with https-only cookies
import axios from "axios";

// Base URL for API calls (normalized without trailing slashes)
const API_URL = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
// Create axios instance with credentials enabled
const api = axios.create({
  baseURL: API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important: This allows cookies to be sent with requests
});

// Fetch CSRF token before any modifying request
const getCsrfToken = async () => {
  try {
    const response = await api.get("/api/csrf-token");
    return response.data.csrfToken;
  } catch (error) {
    console.error(
      "CSRF Token fetch failed:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Auth service methods
const authService = {
  // Fetch CSRF Token (already declared above)
  getCsrfToken,

  // User Login
  userLogin: async (email, password) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post(
        "/api/auth/user/login",
        { email, password },
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // User Registration
  userRegister: async (userData) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post("/api/auth/user/register", userData, {
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        "Registration failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  sellerLogin: async (email, password) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post(
        "/api/auth/seller/login",
        { email, password },
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // User Registration
  sellerRegister: async (userData) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post("/api/auth/seller/register", userData, {
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        "Registration failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // Google Login
  userGoogleLogin: () => {
    window.location.href = `${API_URL}/auth/google`;
  },

  // Check Authentication Status with in-flight deduplication
  checkAuth: (() => {
    let inFlightCheck = null;
    return async () => {
      if (inFlightCheck) return inFlightCheck;
      inFlightCheck = (async () => {
        try {
          const response = await api.get("/api/auth/check", { withCredentials: true });
          return response.data;
        } catch {
          // Unauthenticated visitor is normal, return unauthenticated state gracefully
          return { authenticated: false };
        } finally {
          inFlightCheck = null;
        }
      })();
      return inFlightCheck;
    };
  })(),

  // Logout
  logout: async () => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post(
        "/api/auth/logout",
        {},
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Logout failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // Profile Update
  updateProfile: async (profileData) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.patch("/api/user/profile", profileData, {
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        "Profile update failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // OTP Verification
  sendOtp: async (email) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post(
        "/api/auth/send-otp",
        { email },
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("OTP send failed:", error.response?.data || error.message);
      throw error;
    }
  },

  verifyOtp: async (email, otp) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await api.post(
        "/api/auth/verify-otp",
        { email, otp },
        {
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "OTP verification failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  // 2FA - Get Status
  get2faStatus: async () => {
    try {
      const response = await api.get("/api/auth/2fa/status");
      return response.data;
    } catch (error) {
      console.error("Fetch 2FA status failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Initiate Setup (generates temp secret, QR code, and manual entry key)
  setup2fa: async () => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post("/api/auth/2fa/setup", {}, { headers });
      return response.data;
    } catch (error) {
      console.error("2FA setup failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Confirm Setup with 6-digit TOTP code
  confirm2fa: async (code) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post("/api/auth/2fa/confirm", { code }, { headers });
      return response.data;
    } catch (error) {
      console.error("2FA confirm failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Disable 2FA
  disable2fa: async ({ password, code, recoveryCode }) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post(
        "/api/auth/2fa/disable",
        { password, code, recoveryCode },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("2FA disable failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Regenerate Recovery Codes
  regenerateRecoveryCodes: async (password) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post(
        "/api/auth/2fa/regenerate-recovery-codes",
        { password },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("2FA regenerate codes failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Verify during login
  verify2faLogin: async ({ mfaToken, challengeToken, code, recoveryCode }) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post(
        "/api/auth/2fa/verify-login",
        { mfaToken, challengeToken, code, recoveryCode },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("2FA login verification failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Verify Email OTP during login
  verifyEmailOtpLogin: async ({ challengeToken, mfaToken, otp }) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post(
        "/api/auth/2fa/verify-email-otp",
        { challengeToken, mfaToken, otp },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Email OTP login verification failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // 2FA - Resend Email OTP during login
  resendLoginEmailOtp: async ({ challengeToken, mfaToken }) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post(
        "/api/auth/2fa/resend-email-otp",
        { challengeToken, mfaToken },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Resending login email OTP failed:", error.response?.data || error.message);
      throw error;
    }
  },

  // Enable Email OTP in user settings
  enableEmailOtp: async () => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post("/api/auth/2fa/email-otp/enable", {}, { headers });
      return response.data;
    } catch (error) {
      console.error("Failed to enable email OTP:", error.response?.data || error.message);
      throw error;
    }
  },

  // Disable Email OTP in user settings
  disableEmailOtp: async ({ password }) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.post(
        "/api/auth/2fa/email-otp/disable",
        { password },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Failed to disable email OTP:", error.response?.data || error.message);
      throw error;
    }
  },

  // Update Password
  updatePassword: async ({ currentPassword, newPassword }) => {
    try {
      const headers = {};
      const csrfToken = await getCsrfToken().catch(() => null);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await api.patch(
        "/api/auth/update-password",
        { currentPassword, newPassword },
        { headers }
      );
      return response.data;
    } catch (error) {
      console.error("Password update failed:", error.response?.data || error.message);
      throw error;
    }
  },
};

export default authService;
