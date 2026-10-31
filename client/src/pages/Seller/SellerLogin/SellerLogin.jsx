import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faLock, faUser, faStore, faArrowRight, faShieldAlt } from "@fortawesome/free-solid-svg-icons";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { toast } from "react-hot-toast";
import { setSeller, setLoginType } from "../../../features/auth/state/authSlice";
import authService from "../../../services/authService";
import { AuctionXLogo } from "../../../components/ui/AuctionXLogo";

/**
 * Dedicated AuctionX Seller Portal Authentication Component.
 * Supports explicit, independently addressable routes:
 * - /seller/login  -> Seller Sign In
 * - /seller/signup -> Seller Registration & Onboarding
 */
const SellerLogin = ({ initialSignUp = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSignUpMode, setSignUpMode] = useState(
    initialSignUp || location.pathname === "/seller/signup"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    storeName: "",
  });

  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const { isAuthenticated, user, isSeller } = useSelector((state) => state.auth);

  // If already authenticated as seller, redirect straight to seller dashboard
  useEffect(() => {
    if (isAuthenticated && isSeller && user?.role === "seller") {
      navigate("/seller/dashboard", { replace: true });
    }
  }, [isAuthenticated, isSeller, user, navigate]);

  // Synchronize route changes (/seller/login vs /seller/signup)
  useEffect(() => {
    if (location.pathname === "/seller/signup") {
      setSignUpMode(true);
    } else if (location.pathname === "/seller/login") {
      setSignUpMode(false);
    }
  }, [location.pathname]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleModeSwitch = (signUp) => {
    setSignUpMode(signUp);
    setError("");
    setErrorCode("");
    if (signUp) {
      navigate("/seller/signup", { replace: true });
    } else {
      navigate("/seller/login", { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setErrorCode("");

    try {
      if (isSignUpMode) {
        const { name, email, password } = formData;
        if (!name?.trim() || !email?.trim() || !password) {
          throw new Error("All registration fields are required");
        }

        const response = await authService.sellerRegister({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });

        const registeredUser = response.newUser || response.user;
        dispatch(setSeller(registeredUser));
        dispatch(setLoginType("normal"));

        const isVerified = registeredUser.isVerified || registeredUser.verified;
        if (!isVerified) {
          toast.success("Seller account created. Please complete profile verification.");
          navigate("/verifysellerprofile", {
            state: {
              name: registeredUser.name,
              email: registeredUser.email,
            },
          });
        } else {
          toast.success("Registration successful! Welcome to AuctionX Seller Portal.");
          navigate("/seller/dashboard");
        }
      } else {
        const { email, password } = formData;
        if (!email?.trim() || !password) {
          throw new Error("Email and password are required");
        }

        const response = await authService.sellerLogin(
          email.trim().toLowerCase(),
          password
        );

        if (!response.user) {
          throw new Error("Invalid authentication response");
        }

        dispatch(setSeller(response.user));
        dispatch(setLoginType("normal"));

        const isVerified = response.user.isVerified || response.user.verified;
        if (!isVerified) {
          toast.info("Please verify your seller profile to access the dashboard.");
          navigate("/verifysellerprofile", {
            state: {
              name: response.user.name,
              email: response.user.email,
            },
          });
        } else {
          toast.success("Welcome back to Seller Portal!");
          navigate("/seller/dashboard");
        }
      }
    } catch (err) {
      const errData = err.response?.data;
      const errorMessage =
        errData?.message || err.message || "An authentication error occurred";
      setError(errorMessage);
      setErrorCode(errData?.code || "");
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-lenis-prevent="true"
      className="min-h-screen bg-canvas text-foreground flex flex-col justify-between selection:bg-action-primary/20 selection:text-action-primary"
    >
      {/* Top Navigation Bar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-border-subtle bg-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 group transition-opacity hover:opacity-85 focus:outline-hidden"
            title="Return to AuctionX Home"
          >
            <AuctionXLogo className="h-8 sm:h-9 w-auto" />
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-action-primary/10 text-action-primary border border-action-primary/20">
            <FontAwesomeIcon icon={faShieldAlt} className="text-[10px]" />
            Seller Portal
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-foreground-muted hidden md:inline">
            Looking to bid or buy?
          </span>
          <Link
            to="/login"
            className="font-medium text-action-primary hover:text-action-primary-hover hover:underline transition-colors"
          >
            Buyer Login &rarr;
          </Link>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl border border-border-default p-6 sm:p-8 transition-all">
          {/* Card Header & Mode Switcher */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
              {isSignUpMode ? "Create Seller Account" : "Seller Portal Login"}
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              {isSignUpMode
                ? "Start listing auctions and reach verified global buyers"
                : "Manage your live auctions, pending bids, orders, and sales"}
            </p>

            {/* Mode Switch Tabs */}
            <div className="mt-6 p-1 bg-canvas rounded-xl flex items-center border border-border-subtle">
              <button
                type="button"
                onClick={() => handleModeSwitch(false)}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  !isSignUpMode
                    ? "bg-surface text-foreground shadow-xs border border-border-default"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch(true)}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  isSignUpMode
                    ? "bg-surface text-foreground shadow-xs border border-border-default"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-status-error/10 border border-status-error/20 text-status-error text-xs sm:text-sm flex items-start gap-2 animate-fadeIn"
            >
              <span className="font-semibold shrink-0">Error:</span>
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUpMode && (
              <div>
                <label
                  htmlFor="seller-name"
                  className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5"
                >
                  Full Name / Legal Contact
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground-subtle">
                    <FontAwesomeIcon icon={faUser} className="text-xs" />
                  </div>
                  <input
                    id="seller-name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                    autoComplete="name"
                    className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-border-default rounded-xl text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-action-primary/30 focus:border-action-primary transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="seller-email"
                className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5"
              >
                Seller Email Address
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground-subtle">
                  <FontAwesomeIcon icon={faEnvelope} className="text-xs" />
                </div>
                <input
                  id="seller-email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="seller@domain.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-border-default rounded-xl text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-action-primary/30 focus:border-action-primary transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="seller-password"
                  className="block text-xs font-semibold text-foreground-muted uppercase tracking-wider"
                >
                  Password
                </label>
                {!isSignUpMode && (
                  <Link
                    to="/passwordforget"
                    className="text-xs text-action-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-foreground-subtle">
                  <FontAwesomeIcon icon={faLock} className="text-xs" />
                </div>
                <input
                  id="seller-password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  autoComplete={isSignUpMode ? "new-password" : "current-password"}
                  className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-border-default rounded-xl text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-action-primary/30 focus:border-action-primary transition-all"
                />
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-action-primary hover:bg-action-primary-hover active:scale-[0.99] shadow-md shadow-action-primary/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {isSignUpMode ? "Create Seller Account" : "Access Seller Dashboard"}
                  </span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-border-subtle text-center text-xs text-foreground-muted">
            <p>
              By accessing AuctionX Seller Portal, you agree to our{" "}
              <Link to="/terms" className="text-action-primary hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-action-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-foreground-subtle border-t border-border-subtle">
        &copy; {new Date().getFullYear()} AuctionX Inc. Enterprise Auction Ecosystem.
      </footer>
    </div>
  );
};

export default SellerLogin;
