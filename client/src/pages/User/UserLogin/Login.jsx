import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import {
  faFacebookF,
  faTwitter,
  faGoogle,
  faLinkedinIn,
} from "@fortawesome/free-brands-svg-icons";
import { toast } from "react-hot-toast"; // Assuming you're using react-hot-toast for notifications
import logImage from "../../../assets/images/Pages/Login/log.svg";
import registerImage from "../../../assets/images/Pages/Login/register.svg";
import {
  setUser,
  setLoginType,
} from "../../../features/auth/state/authSlice";
import authService from "../../../services/authService";
import { AuctionXLogo } from "../../../components/ui/AuctionXLogo";
import { ShieldCheck } from "lucide-react";

const Login = ({ initialSignUp = false }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // UI State: dedicated user authentication (no flip toggle)
  const [isSignUpMode, setSignUpMode] = useState(
    initialSignUp || location.pathname === "/signup"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronize route changes (/login vs /signup)
  useEffect(() => {
    if (location.pathname === "/signup") {
      setSignUpMode(true);
    } else if (location.pathname === "/login") {
      setSignUpMode(false);
    }
  }, [location.pathname]);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  // 2FA Challenge State
  const [mfaData, setMfaData] = useState(null); // { mfaToken, email }
  const [mfaCode, setMfaCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  // Error and success messages
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [success, setSuccess] = useState("");

  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (!mfaCode.trim()) {
      toast.error("Please enter the verification code");
      return;
    }

    setIsVerifyingMfa(true);
    try {
      const response = await authService.verify2faLogin({
        mfaToken: mfaData.mfaToken,
        code: useRecoveryCode ? undefined : mfaCode.trim(),
        recoveryCode: useRecoveryCode ? mfaCode.trim() : undefined,
      });

      if (response.success && response.user) {
        dispatch(setUser(response.user));
        dispatch(setLoginType("normal"));

        const isVerified = response.user.isVerified || response.user.verified;
        if (!isVerified) {
          navigate("/verifyprofile", {
            state: {
              name: response.user.name,
              email: response.user.email,
            },
          });
        } else {
          navigate(response.user.role === "admin" ? "/admin/dashboard" : "/");
          toast.success("Two-Factor Authentication verified!");
        }
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || err.message || "Invalid two-factor code";
      toast.error(errMsg);
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleToggle = () => {
    setSignUpMode(!isSignUpMode);
    setFormData({ name: "", email: "", password: "" });
    setError("");
    setErrorCode("");
    setSuccess("");
  };


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Fix for handleSubmit function in Login component
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Handle Sign Up
      if (isSignUpMode) {
        const { name, email, password } = formData;

        if (!name || !email || !password) {
          throw new Error("All fields are required");
        }

        const response = await authService.userRegister({
          name,
          email,
          password,
        });

        // Set user in Redux state
        dispatch(setUser(response.newUser));
        dispatch(setLoginType("normal"));

        // Navigate to verification or dashboard
        const isVerified = response.newUser.isVerified || response.newUser.verified;
        if (!isVerified) {
          navigate("/verifyprofile", {
            state: {
              name: response.newUser.name,
              email: response.newUser.email,
            },
          });
          return; // ✅ IMPORTANT: Stop execution here
        } else {
          navigate("/");
          toast.success("Registration successful!");
          return; // ✅ IMPORTANT: Stop execution here
        }
      }
      // Handle Sign In
      else {
        const { email, password } = formData;

        if (!email || !password) {
          throw new Error("Email and password are required");
        }

        const response = await authService.userLogin(email, password);

        // Check if 2FA is required and navigate to dedicated responsive challenge page
        if (response.mfaRequired) {
          if (response.stage === "AWAITING_EMAIL_OTP") {
            navigate("/verify-login-otp", {
              state: {
                challengeToken: response.challengeToken || response.mfaToken,
                email,
              },
            });
            return;
          }
          // Default to authenticator 2FA challenge page
          navigate("/verify-2fa", {
            state: {
              challengeToken: response.challengeToken || response.mfaToken,
              email,
              requiresEmailOtp: response.requiresEmailOtp,
            },
          });
          return;
        }

        // Set user in Redux state
        dispatch(setUser(response.user));
        dispatch(setLoginType("normal"));

        // Navigate based on user status
        const isVerified = response.user.isVerified || response.user.verified;
        if (!isVerified) {
          navigate("/verifyprofile", {
            state: {
              name: response.user.name,
              email: response.user.email,
            },
          });
        } else {
          // Only navigate to home/dashboard if user is verified
          navigate(response.user.role === "admin" ? "/admin/dashboard" : "/");
          toast.success("Login successful!");
        }
      }
    } catch (error) {
      const errData = error.response?.data;
      const errorMessage =
        errData?.message || error.message || "An error occurred";
      setError(errorMessage);
      setErrorCode(errData?.code || "");
      // Suppress duplicate toast notification for Google-only guidance since inline notice is shown
      if (errData?.code !== "GOOGLE_AUTH_ONLY" && !errorMessage.includes("uses Google sign-in")) {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };



  const { isAuthenticated, user: currentUser } = useSelector(
    (state) => state.auth
  );

  // If already authenticated and not currently processing an OAuth callback, redirect safely
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasAuthParams = params.has("authToken") || params.has("email");
    if (isAuthenticated && currentUser && !hasAuthParams) {
      const isVerified = Boolean(currentUser.isVerified ?? currentUser.verified);
      const isNewUser = Boolean(currentUser.isNewUser);
      const isProfileIncomplete = isNewUser && (!currentUser.phoneNo || !currentUser.address);
      if (!isVerified || isProfileIncomplete) {
        navigate("/verifyprofile", {
          replace: true,
          state: {
            name: currentUser.name,
            email: currentUser.email,
            from: "login",
          },
        });
      } else if (currentUser.role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (currentUser.role === "seller") {
        navigate("/seller/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [isAuthenticated, currentUser, navigate]);

  const handleGoogleLogin = () => {
    dispatch(setLoginType("google"));
    authService.userGoogleLogin();
  };

  // Handle Google auth callback
  useEffect(() => {
    const handleGoogleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hasAuthToken = urlParams.has("authToken");
      const hasEmail = urlParams.has("email");

      if (!hasAuthToken && !hasEmail) return;

      try {
        // 1. Verify session with backend using HTTP-only cookie
        const res = await authService.checkAuth();
        if (res && res.authenticated && res.user) {
          const userObj = res.user;
          if (userObj.role === "seller") {
            dispatch(setSeller(userObj));
          } else {
            dispatch(setUser(userObj));
          }
          dispatch(setLoginType("google"));
          toast.success("Google login successful!");

          const isNewUser = urlParams.get("isNewUser") === "true";
          const isVerified = Boolean(userObj.isVerified ?? userObj.verified);
          const isProfileIncomplete = isNewUser && (!userObj.phoneNo || !userObj.address);

          if (isNewUser || !isVerified || isProfileIncomplete) {
            navigate("/verifyprofile", {
              replace: true,
              state: {
                name: userObj.name,
                email: userObj.email,
                from: "googleLogin",
              },
            });
          } else if (userObj.role === "admin") {
            navigate("/admin/dashboard", { replace: true });
          } else if (userObj.role === "seller") {
            navigate("/seller/dashboard", { replace: true });
          } else {
            navigate("/", { replace: true });
          }
          return;
        }
      } catch (err) {
        console.warn("checkAuth on Google callback failed, trying URL fallback:", err);
      }

      // 2. Fallback: Parse URL parameters directly if cookie handshake took longer
      if (hasEmail) {
        const name = urlParams.get("name") || "";
        const email = urlParams.get("email") || "";
        const profilePic = urlParams.get("profilePic");
        const isNewUser = urlParams.get("isNewUser") === "true";
        const role = urlParams.get("role") || "user";
        const verified = urlParams.get("verified") === "true";
        const googlePhoto = urlParams.get("googlePhoto") || "";
        const selectedAvatar = urlParams.get("selectedAvatar") || "";

        let parsedPic = null;
        try {
          parsedPic = profilePic ? JSON.parse(profilePic) : null;
        } catch {
          parsedPic = profilePic;
        }

        const fallbackUser = {
          name,
          email,
          role,
          profilePic: parsedPic,
          googlePhoto,
          selectedAvatar,
          verified,
          isVerified: verified,
        };

        if (role === "seller") {
          dispatch(setSeller(fallbackUser));
        } else {
          dispatch(setUser(fallbackUser));
        }
        dispatch(setLoginType("google"));
        toast.success("Google login successful!");

        const isProfileIncomplete = !fallbackUser.phoneNo || !fallbackUser.address;

        if (isNewUser || !verified || isProfileIncomplete) {
          navigate("/verifyprofile", {
            replace: true,
            state: {
              name,
              email,
              from: "googleLogin",
            },
          });
        } else if (role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        } else if (role === "seller") {
          navigate("/seller/dashboard", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      }
    };

    handleGoogleCallback();
  }, [dispatch, navigate]);

  return (
    <>
      <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body, html {
            height: 100%;
            overflow: hidden;
            font-family: 'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          .container-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #C65D3A 0%, #B04E2E 35%, #7F3828 70%, #542B21 100%);
            position: relative;
          }

          .container-wrapper::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(198, 93, 58, 0.15), rgba(176, 78, 46, 0.15), rgba(84, 43, 33, 0.15));
            animation: gradientShift 8s ease-in-out infinite;
          }

          @keyframes gradientShift {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 0.3; }
          }

          .container {
            position: relative;
            width: 750px;
            height: 450px;
            background-color: rgba(255, 249, 240, 0.96);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(84, 43, 33, 0.25), 0 15px 25px rgba(198, 93, 58, 0.2);
            overflow: hidden;
            border: 1px solid rgba(232, 216, 195, 0.4);
          }

          .forms-container {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
          }

          .signin-signup {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            left: 75%;
            width: 50%;
            transition: 1s 0.7s ease-in-out;
            display: grid;
            grid-template-columns: 1fr;
            z-index: 5;
          }

          form {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            padding: 0 2rem;
            transition: all 0.2s 0.7s;
            overflow: hidden;
            grid-column: 1 / 2;
            grid-row: 1 / 2;
          }

          form.sign-up-form {
            opacity: 0;
            z-index: 1;
          }

          form.sign-in-form {
            z-index: 2;
          }

          .title {
            font-size: 2rem;
            color: #542B21;
            margin-bottom: 10px;
            font-weight: 700;
            font-family: 'DM Sans', sans-serif;
            background: linear-gradient(45deg, #C65D3A, #7F3828);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .input-field {
            max-width: 320px;
            width: 100%;
            background-color: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(10px);
            margin: 8px 0;
            height: 45px;
            border-radius: 45px;
            display: grid;
            grid-template-columns: 15% 85%;
            padding: 0 0.4rem;
            position: relative;
            border: 1px solid rgba(198, 93, 58, 0.25);
            transition: all 0.3s ease;
          }

          .input-field:focus-within {
            border-color: #C65D3A;
            box-shadow: 0 0 0 3px rgba(198, 93, 58, 0.15);
            background-color: rgba(255, 255, 255, 0.95);
          }

          .input-field i, .input-field .login-icons {
            text-align: center;
            line-height: 45px;
            color: #C65D3A;
            transition: 0.5s;
            font-size: 1rem;
          }

          .input-field input {
            background: none;
            outline: none;
            border: none;
            line-height: 1;
            font-weight: 600;
            font-size: 0.95rem;
            color: #542B21;
          }

          .input-field input::placeholder {
            color: #A89080;
            font-weight: 500;
          }

          .social-text {
            padding: 0.5rem 0;
            font-size: 0.9rem;
            color: #7A5C4D;
          }

          .social-media {
            display: flex;
            justify-content: center;
          }

          .social-icon {
            height: 40px;
            width: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 0 0.35rem;
            color: #C65D3A;
            border-radius: 50%;
            border: 1px solid rgba(198, 93, 58, 0.35);
            text-decoration: none;
            font-size: 1rem;
            transition: 0.3s;
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.6);
          }

          .social-icon:hover {
            background: linear-gradient(45deg, #C65D3A, #7F3828);
            color: white;
            border-color: transparent;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(198, 93, 58, 0.35);
          }

          .btn {
            width: 130px;
            background: linear-gradient(45deg, #C65D3A, #B04E2E, #7F3828);
            border: none;
            outline: none;
            height: 40px;
            border-radius: 40px;
            color: #fff;
            text-transform: uppercase;
            font-weight: 600;
            margin: 8px 0;
            cursor: pointer;
            transition: 0.5s;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 14px rgba(198, 93, 58, 0.25);
          }

          .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
          }

          .btn:hover::before {
            left: 100%;
          }

          .btn:hover {
            background: linear-gradient(45deg, #B04E2E, #9C4223, #542B21);
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(198, 93, 58, 0.35);
          }

          .btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          .panels-container {
            position: absolute;
            height: 100%;
            width: 100%;
            top: 0;
            left: 0;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }

          .container:before {
            content: "";
            position: absolute;
            height: 2000px;
            width: 2000px;
            top: -10%;
            right: 48%;
            transform: translateY(-50%);
            background: linear-gradient(-45deg, #C65D3A 0%, #B04E2E 50%, #542B21 100%);
            transition: 1.8s ease-in-out;
            border-radius: 50%;
            z-index: 6;
          }

          .image {
            width: 100%;
            transition: transform 1.1s ease-in-out;
            transition-delay: 0.4s;
            filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
          }

          .panel {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: space-around;
            text-align: center;
            z-index: 6;
          }

          .left-panel {
            pointer-events: all;
            padding: 2rem 12% 2rem 8%;
          }

          .right-panel {
            pointer-events: none;
            padding: 3rem 12% 2rem 17%;
          }

          .panel .content {
            color: #fff;
            transition: transform 0.9s ease-in-out;
            transition-delay: 0.6s;
          }

          .panel h3 {
            font-weight: 700;
            line-height: 1.2;
            font-size: 1.5rem;
            font-family: 'DM Sans', sans-serif;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
          }

          .panel p {
            font-size: 0.95rem;
            padding: 0.7rem 0;
            opacity: 0.95;
          }

          .btn.transparent {
            margin: 0;
            background: none;
            border: 2px solid #fff;
            width: 130px;
            height: 41px;
            font-weight: 600;
            font-size: 0.8rem;
            backdrop-filter: blur(10px);
          }

          .btn.transparent:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(255, 255, 255, 0.2);
          }

          .right-panel .image,
          .right-panel .content {
            transform: translateX(800px);
          }

          .login-icons {
            margin-top: 14px;
          }

          /* ANIMATION */

          .container.sign-up-mode:before {
            transform: translate(100%, -50%);
            right: 52%;
          }

          .container.sign-up-mode .left-panel .image,
          .container.sign-up-mode .left-panel .content {
            transform: translateX(-800px);
          }

          .container.sign-up-mode .signin-signup {
            left: 25%;
          }

          .container.sign-up-mode form.sign-up-form {
            opacity: 1;
            z-index: 2;
          }

          .container.sign-up-mode form.sign-in-form {
            opacity: 0;
            z-index: 1;
          }

          .container.sign-up-mode .right-panel .image,
          .container.sign-up-mode .right-panel .content {
            transform: translateX(0%);
          }

          .container.sign-up-mode .left-panel {
            pointer-events: none;
          }

          .container.sign-up-mode .right-panel {
            pointer-events: all;
          }

          @media (max-width: 870px) {
            .container {
              width: 100%;
              height: 100%;
              border-radius: 0;
              box-shadow: none;
            }

            .signin-signup {
              width: 100%;
              top: 95%;
              transform: translate(-50%, -100%);
              transition: 1s 0.8s ease-in-out;
            }

            .signin-signup,
            .container.sign-up-mode .signin-signup {
              left: 50%;
            }

            .panels-container {
              grid-template-columns: 1fr;
              grid-template-rows: 1fr 2fr 1fr;
            }

            .panel {
              flex-direction: row;
              justify-content: space-around;
              align-items: center;
              padding: 2.5rem 8%;
              grid-column: 1 / 2;
            }

            .right-panel {
              grid-row: 3 / 4;
            }

            .left-panel {
              grid-row: 1 / 2;
            }

            .image {
              width: 200px;
              transition: transform 0.9s ease-in-out;
              transition-delay: 0.6s;
            }

            .panel .content {
              padding-right: 15%;
              transition: transform 0.9s ease-in-out;
              transition-delay: 0.8s;
            }

            .panel h3 {
              font-size: 1.2rem;
            }

            .panel p {
              font-size: 0.7rem;
              padding: 0.5rem 0;
            }

            .btn.transparent {
              width: 110px;
              height: 35px;
              font-size: 0.7rem;
            }

            .container:before {
              width: 1500px;
              height: 1500px;
              transform: translateX(-50%);
              left: 30%;
              bottom: 68%;
              right: initial;
              top: initial;
              transition: 2s ease-in-out;
            }

            .container.sign-up-mode:before {
              transform: translate(-50%, 100%);
              bottom: 32%;
              right: initial;
            }

            .container.sign-up-mode .left-panel .image,
            .container.sign-up-mode .left-panel .content {
              transform: translateY(-300px);
            }

            .container.sign-up-mode .right-panel .image,
            .container.sign-up-mode .right-panel .content {
              transform: translateY(0px);
            }

            .right-panel .image,
            .right-panel .content {
              transform: translateY(300px);
            }

            .container.sign-up-mode .signin-signup {
              top: 5%;
              transform: translate(-50%, 0);
            }
          }

          @media (max-width: 570px) {
            form {
              padding: 0 1.5rem;
            }

            .image {
              display: none;
            }

            .panel .content {
              padding: 0.5rem 1rem;
            }

            .container {
              padding: 1.5rem;
            }

            .container:before {
              bottom: 72%;
              left: 50%;
            }

            .container.sign-up-mode:before {
              bottom: 28%;
              left: 50%;
            }
          }

          .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 8px;
            width: 100%;
            max-width: 320px;
            text-align: center;
            backdrop-filter: blur(10px);
            font-size: 0.875rem;
            font-weight: 500;
          }

          .error-message {
            background-color: rgba(220, 38, 38, 0.1);
            border: 1px solid rgba(220, 38, 38, 0.4);
            color: #B91C1C;
          }

          .success-message {
            background-color: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.4);
            color: #15803D;
          }

          .forgot-password {
            margin: 4px 0;
            text-align: center;
            width: 100%;
            max-width: 320px;
          }

          .google-auth-notice {
            margin: 8px 0 12px 0;
            padding: 12px 14px;
            border-radius: 12px;
            width: 100%;
            max-width: 320px;
            box-sizing: border-box;
            background: #FFF5EE;
            border: 1px solid rgba(198, 93, 58, 0.35);
            box-shadow: 0 2px 8px rgba(198, 93, 58, 0.08);
            text-align: left;
          }

          .dark .google-auth-notice {
            background: rgba(44, 24, 16, 0.85);
            border-color: rgba(198, 93, 58, 0.45);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          }

          .google-auth-notice-btn {
            width: 100%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 8px;
            background: linear-gradient(45deg, #C65D3A, #B04E2E);
            color: #FFFFFF;
            font-size: 0.75rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(198, 93, 58, 0.25);
            transition: all 0.2s ease;
          }

          .google-auth-notice-btn:hover {
            background: linear-gradient(45deg, #B04E2E, #7F3828);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(198, 93, 58, 0.35);
          }

          .google-auth-notice-btn:focus-visible {
            outline: 2px solid #C65D3A;
            outline-offset: 2px;
          }

          .forgot-password a {
            color: #C65D3A;
            font-size: 0.875rem;
            text-decoration: none;
            transition: color 0.3s ease;
            font-weight: 500;
          }

          .forgot-password a:hover {
            color: #7F3828;
            text-decoration: underline;
          }
        `}
      </style>

      {/* 2FA Challenge Modal */}
      {mfaData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface text-foreground rounded-2xl border border-border-default shadow-2xl p-6 sm:p-8 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-action-primary/10 text-action-primary flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold font-display text-foreground">Two-Factor Authentication</h3>
                <p className="text-xs text-foreground-muted">AuctionX Account Security</p>
              </div>
            </div>

            <p className="text-sm text-foreground-secondary mb-5 leading-relaxed">
              {useRecoveryCode
                ? "Enter one of your 8-character single-use recovery codes to sign in to your account."
                : "Enter the 6-digit verification code from your authenticator app (Google Authenticator, Authy, 1Password, etc.)."}
            </p>

            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-foreground-secondary block mb-1.5">
                  {useRecoveryCode ? "Emergency Recovery Code" : "6-Digit Authenticator Code"}
                </label>
                <input
                  type="text"
                  autoFocus
                  autoComplete="one-time-code"
                  placeholder={useRecoveryCode ? "XXXX-XXXX" : "123456"}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  maxLength={useRecoveryCode ? 10 : 6}
                  className="w-full px-3.5 py-2.5 text-center text-lg tracking-widest font-mono bg-surface text-foreground border border-border-default rounded-lg focus:outline-none focus:border-action-primary focus:ring-2 focus:ring-ring-focus transition-all"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setMfaCode("");
                  }}
                  className="text-action-primary hover:underline cursor-pointer"
                >
                  {useRecoveryCode
                    ? "← Use authenticator app code"
                    : "Lost your device? Use recovery code"}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMfaData(null)}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-border-default text-foreground hover:bg-canvas-subtle transition-colors text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingMfa || !mfaCode.trim()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-action-primary text-white hover:bg-action-primary-hover disabled:opacity-50 transition-colors text-sm font-medium shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {isVerifyingMfa ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Verifying...
                    </>
                  ) : (
                    "Verify & Sign In"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand Header: AuctionX Logo linking back to Home */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50">
        <Link
          to="/"
          className="inline-flex items-center gap-2 group transition-opacity hover:opacity-85 focus:outline-hidden"
          title="Return to AuctionX Home"
        >
          <AuctionXLogo className="h-8 sm:h-9 w-auto" />
        </Link>
      </div>

      <div className="container-wrapper">
              <div
                className={`container ${isSignUpMode ? "sign-up-mode" : ""}`}
              >
                <div className="forms-container">
                  <div className="signin-signup">
                    {/* User Sign In Form */}
                    <form onSubmit={handleSubmit} className="sign-in-form">
                      <h2 className="title">Sign in</h2>

                      {error && (
                        errorCode === "GOOGLE_AUTH_ONLY" || error.includes("uses Google sign-in") ? (
                          <div
                            role="alert"
                            aria-live="polite"
                            className="google-auth-notice"
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <FontAwesomeIcon
                                icon={faGoogle}
                                className="text-[#C65D3A] dark:text-[#E88A68] text-xs flex-shrink-0"
                                aria-hidden="true"
                              />
                              <h4 className="font-semibold text-xs tracking-tight text-[#542B21] dark:text-[#FDE8DF] m-0">
                                Continue with Google
                              </h4>
                            </div>
                            <p className="text-[11px] leading-relaxed text-[#7A4B3A] dark:text-[#E3C2B4] mb-2.5 m-0">
                              This account uses Google sign-in and does not have a local password set. Sign in with Google to access your account.
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleGoogleLogin();
                              }}
                              aria-label="Continue with Google sign-in"
                              className="google-auth-notice-btn"
                            >
                              <FontAwesomeIcon icon={faGoogle} className="text-white text-xs" aria-hidden="true" />
                              <span>Continue with Google</span>
                            </button>
                          </div>
                        ) : (
                          <div className="message error-message">{error}</div>
                        )
                      )}
                      {success && (
                        <div className="message success-message">{success}</div>
                      )}

                      <div className="input-field">
                        <FontAwesomeIcon
                          className="login-icons"
                          icon={faEnvelope}
                        />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="input-field">
                        <FontAwesomeIcon
                          className="login-icons"
                          icon={faLock}
                        />
                        <input
                          type="password"
                          name="password"
                          placeholder="Password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="forgot-password ">
                        <Link to="/passwordforget">Forget Password</Link>
                      </div>
                      <button
                        type="submit"
                        className="btn solid"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Logging in..." : "Login"}
                      </button>

                      <p className="social-text">
                        Or Sign in with social platforms
                      </p>
                      <div className="social-media">
                        <a href="#" className="social-icon">
                          <FontAwesomeIcon icon={faFacebookF} />
                        </a>
                        <a href="#" className="social-icon">
                          <FontAwesomeIcon icon={faTwitter} />
                        </a>
                        <a
                          href="#"
                          className="social-icon"
                          onClick={(e) => {
                            e.preventDefault();
                            handleGoogleLogin();
                          }}
                        >
                          <FontAwesomeIcon icon={faGoogle} />
                        </a>
                        <a href="#" className="social-icon">
                          <FontAwesomeIcon icon={faLinkedinIn} />
                        </a>
                      </div>
                      <p className="seller-portal-link text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                        Are you an auction seller?{" "}
                        <Link to="/seller/login" className="text-[#C65D3A] font-semibold hover:underline">
                          Sign in to Seller Portal
                        </Link>
                      </p>
                    </form>

                    {/* User Sign Up Form */}
                    <form onSubmit={handleSubmit} className="sign-up-form">
                      <h2 className="title">Sign up</h2>

                      {error && (
                        <div className="message error-message">{error}</div>
                      )}
                      {success && (
                        <div className="message success-message">{success}</div>
                      )}

                      <div className="input-field">
                        <FontAwesomeIcon
                          className="login-icons"
                          icon={faUser}
                        />
                        <input
                          type="text"
                          name="name"
                          placeholder="Username"
                          value={formData.name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="input-field">
                        <FontAwesomeIcon
                          className="login-icons"
                          icon={faEnvelope}
                        />
                        <input
                          type="email"
                          name="email"
                          placeholder="Email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="input-field">
                        <FontAwesomeIcon
                          className="login-icons"
                          icon={faLock}
                        />
                        <input
                          type="password"
                          name="password"
                          placeholder="Password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Signing up..." : "Sign up"}
                      </button>
                      <p className="social-text">
                        Or Sign up with social platforms
                      </p>
                      <div className="social-media">
                        <a href="#" className="social-icon">
                          <FontAwesomeIcon icon={faFacebookF} />
                        </a>
                        <a href="#" className="social-icon">
                          <FontAwesomeIcon icon={faTwitter} />
                        </a>
                        <a
                          href="#"
                          className="social-icon"
                          onClick={(e) => {
                            e.preventDefault();
                            handleGoogleLogin();
                          }}
                        >
                          <FontAwesomeIcon icon={faGoogle} />
                        </a>
                        <a href="#" className="social-icon">
                          <FontAwesomeIcon icon={faLinkedinIn} />
                        </a>
                      </div>
                      <p className="seller-portal-link text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                        Want to sell items on AuctionX?{" "}
                        <Link to="/seller/signup" className="text-[#C65D3A] font-semibold hover:underline">
                          Register as a Seller
                        </Link>
                      </p>
                    </form>
                  </div>
                </div>

                {/* Panels Section */}
                <div className="panels-container">
                  <div className="panel left-panel">
                    <div className="content">
                      <h3>New here?</h3>
                      <p>Enter your details and start your journey with us</p>
                      <button
                        className="btn transparent"
                        onClick={handleToggle}
                        type="button"
                      >
                        Sign up
                      </button>
                    </div>
                    <img
                      src={logImage}
                      className="image"
                      alt="Login Illustration"
                    />
                  </div>

                  <div className="panel right-panel">
                    <div className="content">
                      <h3>One of us?</h3>
                      <p>
                        To keep connected with us, please log in with your
                        personal info
                      </p>
                      <button
                        className="btn transparent"
                        onClick={handleToggle}
                      >
                        Sign in
                      </button>
                    </div>
                    <img
                      src={registerImage}
                      className="image"
                      alt="Register Illustration"
                    />
                  </div>
                </div>
              </div>
            </div>
    </>
  );
};

export default Login;
