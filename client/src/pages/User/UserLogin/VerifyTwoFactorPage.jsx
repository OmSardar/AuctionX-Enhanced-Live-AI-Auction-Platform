import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";
import { ShieldCheck, KeyRound, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { AuctionXLogo } from "../../../components/ui/AuctionXLogo";
import authService from "../../../services/authService";
import { setUser, setLoginType } from "../../../features/auth/state/authSlice";

const VerifyTwoFactorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Extract challenge token and session state
  const stateData = location.state || {};
  const challengeToken = stateData.challengeToken || stateData.mfaToken;
  const email = stateData.email || "";

  // 6 individual digit inputs for authenticator code
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  // Recovery code fallback mode
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Validate presence of challenge token
  useEffect(() => {
    if (!challengeToken) {
      toast.error("Authentication session missing or expired. Please sign in again.");
      navigate("/login", { replace: true });
    } else {
      // Auto-focus first input
      inputRefs.current[0]?.focus();
    }
  }, [challengeToken, navigate]);

  const handleDigitChange = (index, value) => {
    // Only accept numeric single characters
    const char = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMessage("");

    // Advance focus to next input if digit entered
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setDigits(newDigits);
    setErrorMessage("");

    const targetIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetIndex]?.focus();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    let codeToSend = "";
    let recoveryCodeToSend = "";

    if (useRecoveryCode) {
      if (!recoveryCode.trim()) {
        setErrorMessage("Please enter your recovery code.");
        return;
      }
      recoveryCodeToSend = recoveryCode.trim();
    } else {
      codeToSend = digits.join("");
      if (codeToSend.length !== 6) {
        setErrorMessage("Please enter all 6 digits of your authenticator code.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await authService.verify2faLogin({
        challengeToken,
        mfaToken: challengeToken,
        code: useRecoveryCode ? undefined : codeToSend,
        recoveryCode: useRecoveryCode ? recoveryCodeToSend : undefined,
      });

      if (response.success) {
        // If state machine requires second factor (Email OTP)
        if (response.stage === "AWAITING_EMAIL_OTP") {
          toast.success("Authenticator verified! Complete email verification.");
          navigate("/verify-login-otp", {
            replace: true,
            state: {
              challengeToken: response.challengeToken || response.mfaToken,
              email: email || response.email,
            },
          });
          return;
        }

        // Authentication completely finalized
        if (response.user) {
          dispatch(setUser(response.user));
          dispatch(setLoginType("normal"));

          toast.success("Signed in successfully!");

          const isVerified = Boolean(response.user.isVerified ?? response.user.verified);
          const isNewUser = Boolean(response.user.isNewUser);
          const isProfileIncomplete = isNewUser && (!response.user.phoneNo || !response.user.address);

          if (!isVerified || isProfileIncomplete) {
            navigate("/verifyprofile", {
              replace: true,
              state: {
                name: response.user.name,
                email: response.user.email,
                from: "login",
              },
            });
          } else if (response.user.role === "admin") {
            navigate("/admin/dashboard", { replace: true });
          } else if (response.user.role === "seller") {
            navigate("/seller/dashboard", { replace: true });
          } else {
            navigate("/", { replace: true });
          }
        }
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Verification failed. Please check your code and try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-foreground transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <AuctionXLogo className="h-12 w-auto mx-auto" />
          </Link>
          <div className="mt-6 flex items-center justify-center space-x-2">
            <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
            Two-Factor Authentication
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            {useRecoveryCode
              ? "Enter one of your 8-character single-use recovery codes."
              : "Enter the 6-digit verification code generated by your authenticator app."}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-surface border border-border-subtle rounded-2xl shadow-card p-8 sm:p-10 backdrop-blur-sm">
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl bg-status-error/10 border border-status-error/20 flex items-start space-x-3 text-status-error text-sm animate-shake"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!useRecoveryCode ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-3 text-center">
                  6-Digit Authenticator Code
                </label>
                {/* 6 Digit Inputs */}
                <div className="flex justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      aria-label={`Digit ${index + 1} of verification code`}
                      disabled={isSubmitting}
                      className="w-12 h-14 sm:w-13 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl bg-surface-muted border border-border-subtle text-foreground focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all duration-150 disabled:opacity-50"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="recovery-code-input"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Emergency Recovery Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground-muted">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input
                    id="recovery-code-input"
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => {
                      setRecoveryCode(e.target.value.toUpperCase());
                      setErrorMessage("");
                    }}
                    placeholder="e.g. A1B2-C3D4"
                    maxLength={16}
                    disabled={isSubmitting}
                    className="w-full pl-11 pr-4 py-3 bg-surface-muted border border-border-subtle rounded-xl text-foreground font-mono uppercase tracking-wider focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all duration-150"
                  />
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  Recovery codes are single-use and become invalid after one successful login.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-all duration-150 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying code...</span>
                </>
              ) : (
                <span>Verify & Continue</span>
              )}
            </button>
          </form>

          {/* Toggle between TOTP and Recovery Code */}
          <div className="mt-6 pt-6 border-t border-border-subtle text-center space-y-3">
            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode(!useRecoveryCode);
                setErrorMessage("");
                setDigits(["", "", "", "", "", ""]);
                setRecoveryCode("");
              }}
              className="text-sm text-amber-500 hover:text-amber-400 font-medium transition-colors"
            >
              {useRecoveryCode
                ? "Use 6-digit authenticator code instead"
                : "Lost access to your authenticator? Use recovery code"}
            </button>

            <div>
              <Link
                to="/login"
                className="inline-flex items-center text-xs text-foreground-muted hover:text-foreground transition-colors space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to sign in</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyTwoFactorPage;
