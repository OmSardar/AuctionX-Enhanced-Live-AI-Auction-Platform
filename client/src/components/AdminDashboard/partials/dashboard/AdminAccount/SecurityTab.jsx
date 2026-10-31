import React, { useState, useEffect, useCallback } from "react";
import axiosWithAuth from "../../../../../redux/slices/axiosWithAuth";
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Mail,
  RefreshCw,
  Copy,
  Download,
  AlertTriangle,
  X,
  Lock,
} from "lucide-react";
import authService from "../../../../../services/authService";

function SecurityTab({ profile, csrfToken, API_BASE_URL, getRequestConfig, showStatusMessage }) {
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // 2FA TOTP State
  const [twoFactorStatus, setTwoFactorStatus] = useState({
    enabled: false,
    confirmedAt: null,
    emailOtpEnabled: false,
  });
  const [loading2fa, setLoading2fa] = useState(true);

  // Setup / Enrollment Modal State
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupData, setSetupData] = useState(null); // { qrCodeDataUrl, secret, manualEntryKey }
  const [verifyCode, setVerifyCode] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  // Disable TOTP Modal State
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableUseRecovery, setDisableUseRecovery] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // Regenerate Recovery Codes Modal State
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Email OTP on Login State
  const [showDisableEmailOtpModal, setShowDisableEmailOtpModal] = useState(false);
  const [disableEmailOtpPassword, setDisableEmailOtpPassword] = useState("");
  const [isTogglingEmailOtp, setIsTogglingEmailOtp] = useState(false);

  // Fetch Authoritative 2FA Status
  const fetch2faStatus = useCallback(async () => {
    try {
      setLoading2fa(true);
      const data = await authService.get2faStatus();
      setTwoFactorStatus({
        enabled: Boolean(data.twoFactorEnabled),
        confirmedAt: data.confirmedAt || null,
        emailOtpEnabled: Boolean(data.emailOtpLoginEnabled),
      });
    } catch (err) {
      console.error("Failed to fetch admin 2FA status:", err);
    } finally {
      setLoading2fa(false);
    }
  }, []);

  useEffect(() => {
    fetch2faStatus();
  }, [fetch2faStatus]);

  // Handle password input changes
  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  // Handle password update
  const handleUpdatePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showStatusMessage("New passwords don't match", "error");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      showStatusMessage("Password must be at least 8 characters", "error");
      return;
    }

    try {
      await axiosWithAuth.put(
        `${API_BASE_URL}/api/auth/user/change-password`,
        {
          email: profile.email,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }
      );

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setIsChangingPassword(false);
      showStatusMessage("Password updated successfully", "success");
    } catch (error) {
      console.error("Error updating password:", error);
      if (error.response && error.response.status === 400) {
        showStatusMessage(error.response.data.message || "Current password is incorrect", "error");
      } else {
        showStatusMessage("Failed to update password", "error");
      }
    }
  };

  // ---------------- TOTP Enrollment Flow ----------------
  const handleStartSetup = async () => {
    try {
      setIsEnrolling(true);
      const data = await authService.setup2fa();
      setSetupData(data);
      setVerifyCode("");
      setRecoveryCodes(null);
      setShowSetupModal(true);
    } catch (err) {
      showStatusMessage(err.response?.data?.message || "Failed to initiate 2FA setup", "error");
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      showStatusMessage("Please enter the 6-digit verification code", "error");
      return;
    }

    try {
      setIsEnrolling(true);
      const res = await authService.confirm2fa(verifyCode.trim());
      setRecoveryCodes(res.recoveryCodes || []);
      setTwoFactorStatus((prev) => ({ ...prev, enabled: true }));
      showStatusMessage("Two-factor authentication enabled successfully!", "success");
    } catch (err) {
      showStatusMessage(
        err.response?.data?.message || "Invalid code. Please check your authenticator and try again.",
        "error"
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  // ---------------- TOTP Disable Flow ----------------
  const handleDisable2fa = async (e) => {
    e.preventDefault();
    if (!disablePassword || !disableCode) {
      showStatusMessage("Password and verification code are required", "error");
      return;
    }

    try {
      setIsDisabling(true);
      await authService.disable2fa({
        password: disablePassword,
        code: disableUseRecovery ? undefined : disableCode.trim(),
        recoveryCode: disableUseRecovery ? disableCode.trim() : undefined,
      });

      setTwoFactorStatus((prev) => ({ ...prev, enabled: false }));
      setShowDisableModal(false);
      setDisablePassword("");
      setDisableCode("");
      showStatusMessage("Two-factor authentication disabled", "success");
    } catch (err) {
      showStatusMessage(err.response?.data?.message || "Failed to disable 2FA", "error");
    } finally {
      setIsDisabling(false);
    }
  };

  // ---------------- Regenerate Recovery Codes Flow ----------------
  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    if (!regenPassword) {
      showStatusMessage("Password is required", "error");
      return;
    }

    try {
      setIsRegenerating(true);
      const res = await authService.regenerateRecoveryCodes(regenPassword);
      setRecoveryCodes(res.recoveryCodes || []);
      setRegenPassword("");
      setShowRegenModal(false);
      setShowSetupModal(true); // Re-use modal for showing codes
      showStatusMessage("Fresh recovery codes generated successfully", "success");
    } catch (err) {
      showStatusMessage(err.response?.data?.message || "Failed to generate recovery codes", "error");
    } finally {
      setIsRegenerating(false);
    }
  };

  // ---------------- Email OTP Handlers ----------------
  const handleEnableEmailOtp = async () => {
    try {
      setIsTogglingEmailOtp(true);
      await authService.enableEmailOtp();
      setTwoFactorStatus((prev) => ({ ...prev, emailOtpEnabled: true }));
      showStatusMessage("Email OTP verification enabled for login", "success");
    } catch (err) {
      showStatusMessage(err.response?.data?.message || "Failed to enable Email OTP", "error");
    } finally {
      setIsTogglingEmailOtp(false);
    }
  };

  const handleDisableEmailOtp = async (e) => {
    e.preventDefault();
    if (!disableEmailOtpPassword) {
      showStatusMessage("Password is required to disable Email OTP", "error");
      return;
    }

    try {
      setIsTogglingEmailOtp(true);
      await authService.disableEmailOtp({ password: disableEmailOtpPassword });
      setTwoFactorStatus((prev) => ({ ...prev, emailOtpEnabled: false }));
      setShowDisableEmailOtpModal(false);
      setDisableEmailOtpPassword("");
      showStatusMessage("Email OTP verification disabled", "success");
    } catch (err) {
      showStatusMessage(err.response?.data?.message || "Failed to disable Email OTP", "error");
    } finally {
      setIsTogglingEmailOtp(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ---------------- Password Change Section ---------------- */}
      <div className="bg-surface-subtle rounded-2xl p-6 border border-border-default shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-action-primary/10 text-action-primary">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground font-display">
                Administrator Password
              </h3>
              <p className="text-xs text-foreground-secondary">
                Ensure your administrator account uses a strong, unique password
              </p>
            </div>
          </div>
          {!isChangingPassword && (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="px-4 py-2 bg-action-primary text-white text-xs font-semibold rounded-xl hover:bg-action-primary-hover shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              Change Password
            </button>
          )}
        </div>

        {isChangingPassword ? (
          <div className="space-y-4 pt-4 border-t border-border-default">
            <div>
              <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1.5 uppercase tracking-wide">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-3.5 py-2.5 border border-border-default rounded-xl bg-surface text-foreground text-sm focus:outline-hidden focus:border-action-primary transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsChangingPassword(false);
                  setPasswordData({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                }}
                className="px-4 py-2 border border-border-default bg-surface hover:bg-surface-subtle text-foreground text-xs font-medium rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePassword}
                className="px-4 py-2 bg-action-primary text-white text-xs font-semibold rounded-xl hover:bg-action-primary-hover shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-foreground-muted">
            Password was last changed on{" "}
            <span className="text-foreground font-medium">
              {profile.passwordLastChanged || "Not recorded"}
            </span>
          </p>
        )}
      </div>

      {/* ---------------- Authenticator App (TOTP) Section ---------------- */}
      <div className="bg-surface-subtle rounded-2xl p-6 border border-border-default shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl ${
                twoFactorStatus.enabled
                  ? "bg-status-success-bg text-status-success"
                  : "bg-status-warning-bg text-status-warning"
              }`}
            >
              {twoFactorStatus.enabled ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-foreground">
                  Authenticator App (TOTP 2FA)
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    twoFactorStatus.enabled
                      ? "bg-status-success-bg text-status-success border border-status-success/30"
                      : "bg-surface text-foreground-muted border border-border-default"
                  }`}
                >
                  {twoFactorStatus.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-foreground-secondary mt-1">
                {twoFactorStatus.enabled
                  ? "Your admin account is protected by standard RFC 6238 time-based authenticator codes."
                  : "Require a six-digit code from Google Authenticator, Authy, or 1Password when logging in."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {twoFactorStatus.enabled ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowRegenModal(true)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border-default text-foreground hover:bg-surface-subtle bg-surface transition duration-150 inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Recovery Codes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisableModal(true)}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-status-danger-bg text-status-danger border border-status-danger/30 hover:bg-status-danger/20 transition duration-150 cursor-pointer"
                >
                  Disable 2FA
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartSetup}
                disabled={isEnrolling}
                className="px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-white text-xs font-semibold rounded-xl transition duration-150 inline-flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{isEnrolling ? "Generating..." : "Enable 2FA"}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-default text-xs text-foreground-muted space-y-1">
          <p>• Admin MFA is strictly enforced during administrator login.</p>
          <p>• Single-use emergency recovery codes can be used if your device is unavailable.</p>
        </div>
      </div>

      {/* ---------------- Email OTP on Login Section ---------------- */}
      <div className="bg-surface-subtle rounded-2xl p-6 border border-border-default shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl ${
                twoFactorStatus.emailOtpEnabled
                  ? "bg-status-success-bg text-status-success"
                  : "bg-action-primary/10 text-action-primary"
              }`}
            >
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-foreground">
                  Email OTP on Password Login
                </h3>
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    twoFactorStatus.emailOtpEnabled
                      ? "bg-status-success-bg text-status-success border border-status-success/30"
                      : "bg-surface text-foreground-muted border border-border-default"
                  }`}
                >
                  {twoFactorStatus.emailOtpEnabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-foreground-secondary mt-1">
                {twoFactorStatus.emailOtpEnabled
                  ? "A 6-digit one-time code will be dispatched to your registered email upon password verification."
                  : "Require an extra one-time code sent to your email on each administrator login."}
              </p>
            </div>
          </div>

          <div>
            {twoFactorStatus.emailOtpEnabled ? (
              <button
                type="button"
                onClick={() => setShowDisableEmailOtpModal(true)}
                disabled={isTogglingEmailOtp}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-status-danger-bg text-status-danger border border-status-danger/30 hover:bg-status-danger/20 transition duration-150 cursor-pointer"
              >
                Disable Email OTP
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnableEmailOtp}
                disabled={isTogglingEmailOtp}
                className="px-4 py-2 bg-action-primary hover:bg-action-primary-hover text-white text-xs font-semibold rounded-xl transition duration-150 inline-flex items-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isTogglingEmailOtp ? "Enabling..." : "Enable Email OTP"}</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border-default text-xs text-foreground-muted space-y-1">
          <p>• If both Authenticator 2FA and Email OTP are enabled, you will verify TOTP first, then Email OTP.</p>
          <p>• Login security alert notifications will be sent to this email upon successful sign-in.</p>
        </div>
      </div>

      {/* ---------------- 2FA Enrollment / Recovery Codes Modal ---------------- */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-status-success-bg text-status-success">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground font-display">
                    {recoveryCodes ? "Recovery Codes" : "Enable Two-Factor Authentication"}
                  </h3>
                  <p className="text-xs text-foreground-secondary">
                    {recoveryCodes ? "Save these single-use codes safely" : "Scan QR code with your authenticator app"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSetupModal(false);
                  setSetupData(null);
                  setRecoveryCodes(null);
                  fetch2faStatus();
                }}
                className="text-foreground-muted hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {recoveryCodes ? (
              <div className="space-y-4">
                <div className="p-3 bg-status-warning-bg border border-status-warning/40 rounded-xl text-xs text-status-warning">
                  Save these codes now. If you lose your authenticator, each code can be used once to log in.
                </div>
                <div className="grid grid-cols-2 gap-2 p-4 bg-surface-subtle rounded-xl border border-border-default font-mono text-xs">
                  {recoveryCodes.map((code, idx) => (
                    <div key={idx} className="p-2 bg-surface rounded-lg text-center font-bold text-foreground border border-border-subtle">
                      {code}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryCodes.join("\n"));
                      showStatusMessage("Recovery codes copied!", "success");
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl border border-border-default bg-surface hover:bg-surface-subtle text-foreground inline-flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Codes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSetupModal(false);
                      setSetupData(null);
                      setRecoveryCodes(null);
                      fetch2faStatus();
                    }}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl bg-action-primary text-white hover:bg-action-primary-hover shadow-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : setupData ? (
              <div className="space-y-4">
                <div className="flex justify-center p-4 bg-white rounded-xl border border-border-default max-w-xs mx-auto">
                  <img
                    src={setupData.qrCodeDataUrl || setupData.qrCode}
                    alt="TOTP QR Code"
                    className="w-44 h-44 object-contain"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-foreground-secondary block mb-1">
                    Secret Key (Manual Entry):
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={setupData.manualEntryKey || setupData.secret}
                      className="w-full px-3 py-1.5 text-xs font-mono bg-surface-subtle border border-border-default text-foreground rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(setupData.manualEntryKey || setupData.secret);
                        showStatusMessage("Secret key copied!", "success");
                      }}
                      className="px-3 py-1.5 text-xs border border-border-default rounded-lg hover:bg-surface-subtle text-foreground cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleConfirmSetup} className="space-y-3 pt-2 border-t border-border-default">
                  <label className="block text-xs font-semibold text-foreground-secondary">
                    Enter 6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="123456"
                    className="w-full py-2.5 text-center text-lg font-mono font-bold tracking-widest bg-surface-subtle border border-border-default text-foreground rounded-xl focus:outline-hidden focus:border-action-primary"
                    required
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSetupModal(false)}
                      className="flex-1 py-2 text-xs font-semibold rounded-xl border border-border-default bg-surface hover:bg-surface-subtle text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isEnrolling || verifyCode.length < 6}
                      className="flex-1 py-2 text-xs font-semibold rounded-xl bg-action-primary text-white hover:bg-action-primary-hover shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isEnrolling ? "Verifying..." : "Confirm & Enable"}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ---------------- 2FA Disable Modal ---------------- */}
      {showDisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-status-danger-bg text-status-danger">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Disable Two-Factor Authentication</h3>
                  <p className="text-xs text-foreground-secondary">Security Verification Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDisableModal(false)}
                className="text-foreground-muted hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisable2fa} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1">
                  Administrator Password
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-surface-subtle border border-border-default text-foreground rounded-xl focus:outline-hidden focus:border-action-primary"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-foreground-secondary">
                    {disableUseRecovery ? "Recovery Code" : "Authenticator Code"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDisableUseRecovery(!disableUseRecovery);
                      setDisableCode("");
                    }}
                    className="text-[11px] text-action-primary hover:underline cursor-pointer"
                  >
                    {disableUseRecovery ? "Use 6-digit code" : "Use recovery code"}
                  </button>
                </div>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder={disableUseRecovery ? "XXXX-XXXX" : "123456"}
                  maxLength={disableUseRecovery ? 12 : 6}
                  required
                  className="w-full px-3.5 py-2 text-sm text-center font-mono bg-surface-subtle border border-border-default text-foreground rounded-xl focus:outline-hidden focus:border-action-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisableModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl border border-border-default bg-surface hover:bg-surface-subtle text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDisabling}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-status-danger text-white hover:bg-status-danger/90 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isDisabling ? "Disabling..." : "Confirm Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Regenerate Recovery Codes Modal ---------------- */}
      {showRegenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-action-primary/10 text-action-primary">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Regenerate Recovery Codes</h3>
                  <p className="text-xs text-foreground-secondary">Previous recovery codes will be invalidated</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegenModal(false)}
                className="text-foreground-muted hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegenerateCodes} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1">
                  Administrator Password
                </label>
                <input
                  type="password"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-surface-subtle border border-border-default text-foreground rounded-xl focus:outline-hidden focus:border-action-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegenModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl border border-border-default bg-surface hover:bg-surface-subtle text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegenerating}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-action-primary text-white hover:bg-action-primary-hover shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isRegenerating ? "Generating..." : "Generate Codes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Disable Email OTP Modal ---------------- */}
      {showDisableEmailOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 animate-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-status-danger-bg text-status-danger">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Disable Email OTP</h3>
                  <p className="text-xs text-foreground-secondary">Password confirmation required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDisableEmailOtpModal(false)}
                className="text-foreground-muted hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisableEmailOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground-secondary mb-1">
                  Administrator Password
                </label>
                <input
                  type="password"
                  value={disableEmailOtpPassword}
                  onChange={(e) => setDisableEmailOtpPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-surface-subtle border border-border-default text-foreground rounded-xl focus:outline-hidden focus:border-action-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisableEmailOtpModal(false)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl border border-border-default bg-surface hover:bg-surface-subtle text-foreground cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isTogglingEmailOtp || !disableEmailOtpPassword}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl bg-status-danger text-white hover:bg-status-danger/90 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isTogglingEmailOtp ? "Disabling..." : "Confirm Disable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SecurityTab;