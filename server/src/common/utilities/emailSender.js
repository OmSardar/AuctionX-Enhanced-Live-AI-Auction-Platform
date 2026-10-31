const express = require("express");
const cors = require("cors");

const app = express(); // Initialize the app with express
app.use(cors()); // Now use cors

const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail", // Gmail service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ccc; border-radius: 8px; background-color: #000; color: #fff;">
        <h2 style="text-align: center; color: #fae570;">Your OTP Code</h2>
        <p style="font-size: 18px; text-align: center; color: #ddd;">
          Use the OTP below to complete your verification process. The OTP is valid for the next 10 minutes.
        </p>
        <div style="margin: 20px auto; text-align: center; font-size: 24px; font-weight: bold; color: #fae570; padding: 10px; border: 2px dashed #fae570; width: fit-content;">
          ${otp}
        </div>
        <p style="font-size: 16px; text-align: center; color: #aaa;">
          If you did not request this, please ignore this email.
        </p>
        <footer style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
          © ${new Date().getFullYear()} Auction X. All rights reserved.
        </footer>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(`Error sending email: ${error.message}`);
  }
};


module.exports = sendOtpEmail;
