const SellerModel = require("../models/seller");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const JWT_SECRET = process.env.JWT_SECRET;

const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      address = "",
      phoneNo = "",
      gender = "",
      alternativePhoneNo = "",
      city = "",
      state = "",
      pinCode = "",
      country = "",
    } = req.body;

    console.log("Request body:", req.body);

    // Check if user already exists
    const existUser = await SellerModel.findOne({ email });
    if (existUser) {
      return res
        .status(409)
        .json({ success: false, message: "User already exists" });
    }

    console.log("User does not exist, proceeding to register.");

    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 10);
    console.log("Password hashed:", hashedPassword);

    // Create new user with isVerified: false
    const newUser = new SellerModel({
      name,
      email,
      password: hashedPassword,
      address,
      phoneNo,
      gender,
      alternativePhoneNo,
      city,
      state,
      pinCode,
      country,
      isVerified: false, // Explicitly set verification status
    });

    // Save the new user
    await newUser.save();
    console.log("User registered successfully:", newUser);

    // Normalize email
    const normalizedEmail = (email || "").trim().toLowerCase();

    // Generate a JWT token with explicit seller role and session purpose
    const token = jwt.sign(
      {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role || "seller",
        purpose: "seller_session",
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Set the token in HTTP-only cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
    };
    res.cookie("token", token, cookieOptions);
    res.cookie("sellerToken", token, cookieOptions);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      newUser: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role || "seller",
        isVerified: newUser.isVerified, // Include verification status
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.error("Email and password are required");
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    const user = await SellerModel.findOne({ email: normalizedEmail });
    if (!user) {
      console.error("User not found for email:", email);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const hasLocalPassword = Boolean(user.password && user.password.length > 0);
    const isGoogleAccount = Boolean(user.isOAuthUser || (user.googlePhoto && user.googlePhoto.length > 0));

    if (!hasLocalPassword && isGoogleAccount) {
      return res.status(400).json({
        success: false,
        code: "GOOGLE_AUTH_ONLY",
        message:
          "This account uses Google sign-in and does not have a password set. Please continue with Google to access your account.",
      });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password || "");
    if (!isPasswordValid) {
      console.error("Invalid password for user:", email);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({
        success: false,
        message: `Your seller account has been suspended. Reason: ${user.suspensionReason || "Violation of platform policies"}`,
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role || "seller",
        purpose: "seller_session",
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
    };
    res.cookie("token", token, cookieOptions);
    res.cookie("sellerToken", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePic: user.profilePic,
        googlePhoto: user.googlePhoto || "",
        selectedAvatar: user.selectedAvatar || "",
        role: user.role,
        isVerified: user.isVerified, // Changed from 'verified' to 'isVerified'
        hasPassword: true,
        isOAuthUser: isGoogleAccount,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// authController.js
const Logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "None" : "Lax",
      path: "/",
    };

    res.clearCookie("token", cookieOptions);
    res.clearCookie("adminToken", cookieOptions);
    res.clearCookie("sellerToken", cookieOptions);
    res.clearCookie("seller_token", cookieOptions);
    res.clearCookie("token");
    res.clearCookie("adminToken");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  Login,
  Logout,
};
