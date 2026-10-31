const { sendEmail, getEmailConfig } = require("./email");

const handleContactSubmission = async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Validate form fields
  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      code: "ERROR",
      message: "All fields are required to send a message.",
      theme: "dark",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const config = getEmailConfig();

    // Create the HTML content for a professional-looking dark theme email
    const emailHTML = `
      <div style="background-color: #1a1a1a; padding: 20px; font-family: Arial, sans-serif; color: #f1f1f1; border-radius: 10px;">
        <h2 style="color: #e2b714;">New Contact Form Submission</h2>
        <hr style="border-top: 1px solid #333;">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #f1f1f1; text-decoration: underline;">${email}</a></p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <div style="background-color: #333; padding: 15px; border-radius: 5px; color: #d3d3d3;">
          ${message.replace(/\n/g, "<br>")}
        </div>
        <hr style="border-top: 1px solid #333;">
        <p style="font-size: 12px; color: #666;">This message was sent from your website contact form.</p>
      </div>
    `;

    const recipientAddress =
      process.env.EMAIL_USER ||
      process.env.EMAIL_REPLY_TO ||
      "support@mail.omslabs.tech";

    await sendEmail({
      to: recipientAddress,
      subject: `Contact Form Submission: ${subject}`,
      html: emailHTML,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`,
      replyTo: email,
      category: "contact_us",
    });

    // Respond with a success message
    res.status(200).json({
      code: "SUCCESS",
      message:
        "Your message was sent successfully! We’ll get back to you soon.",
      theme: "dark",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error sending contact email:", error.message);
    res.status(500).json({
      code: "ERROR",
      message:
        "Oops! An error occurred while sending your message. Please try again later.",
      theme: "dark",
      timestamp: new Date().toISOString(),
      errorDetail: error.message,
    });
  }
};

module.exports = handleContactSubmission;
