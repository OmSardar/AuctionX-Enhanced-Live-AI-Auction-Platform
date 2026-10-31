import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-hot-toast";
import { Mail, ArrowLeft, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { AuctionXLogo } from "../../../components/ui/AuctionXLogo";
import authService from "../../../services/authService";
import { setUser, setLoginType } from "../../../features/auth/state/authSlice";

const maskEmail = (email = "") => {
  if (!email || !email.includes("@")) return "your email address";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
};

const VerifyLoginEmailOtpPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const stateData = location.state || {};
  const [challengeToken, setChallengeToken] = useState(
    stateData.challengeToken || stateData.mfaToken || ""
  );
  const email = stateData.email || "";

  // 6-digit input state
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);

  // Validate presence of challenge token
  useEffect(() => {
    if (!challengeToken) {
      toast.error("Email verification session missing or expired. Please sign in again.");
      navigate("/login", { replace: true });
    } else {
      inputRefs.current[0]?.focus();
    }
  }, [challengeToken, navigate]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = char;
    setDigits(newDigits);
    setErrorMessage("");

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

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage("");

    try {
      const res = await authService.resendLoginEmailOtp({
        challengeToken,
        mfaToken: challengeToken,
      });
      toast.success(res.message || "A new code has been sent to your email.");
      setResendCooldown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to resend code. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const otpCode = digits.join("");
    if (otpCode.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.verifyEmailOtpLogin({
        challengeToken,
        mfaToken: challengeToken,
        otp: otpCode,
      });

      if (response.success && response.user) {
        dispatch(setUser(response.user));
        dispatch(setLoginType("normal"));

        toast.success("Identity verified successfully!");

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
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Invalid or expired verification code.";
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
            <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Mail className="w-7 h-7" />
            </div>
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
            Verify Your Email
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            We sent a 6-digit login verification code to{" "}
            <span className="font-semibold text-foreground">{maskEmail(email)}</span>.
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-3 text-center">
                6-Digit Security Code
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
                    className="w-12 h-14 sm:w-13 sm:h-16 text-center text-2xl font-bold font-mono rounded-xl bg-surface-muted border border-border-subtle text-foreground focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-150 disabled:opacity-50"
                  />
                ))}
              </div>
            </div>

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
                <span>Verify & Complete Sign In</span>
              )}
            </button>
          </form>

          {/* Resend Cooldown Section */}
          <div className="mt-6 pt-6 border-t border-border-subtle text-center space-y-3">
            <div className="text-sm text-foreground-muted flex items-center justify-center space-x-1.5">
              <span>Didn't receive the code?</span>
              {resendCooldown > 0 ? (
                <span className="text-foreground font-mono text-xs font-semibold">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending}
                  className="text-amber-500 hover:text-amber-400 font-medium inline-flex items-center space-x-1 transition-colors"
                >
                  {isResending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : null}
                  <span>Resend code</span>
                </button>
              )}
            </div>

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

export default VerifyLoginEmailOtpPage;
