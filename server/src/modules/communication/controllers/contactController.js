// controllers/UserControllers/contactController/contactController.js
const Contact = require("../models/Contact");
const { sendEmail } = require("../../../common/utilities/email");

const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        code: "ERROR",
        message: "All fields are required to send a message.",
        theme: "dark",
        timestamp: new Date().toISOString(),
      });
    }

    // Save to database
    const newContact = new Contact({ 
      name: String(name).trim(), 
      email: String(email).trim().toLowerCase(), 
      subject: String(subject).trim(), 
      message: String(message).trim() 
    });
    await newContact.save();

    // Send email (best effort, do not fail submission if email provider fails)
    try {
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
        text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nMessage: ${message}`,
        html: emailHTML,
        replyTo: email,
        category: "contact_submission",
      });
    } catch (mailErr) {
      console.warn("Contact form notification email failed:", mailErr.message);
    }

    res.status(201).json({
      code: "SUCCESS",
      message: "Your message was sent successfully! We'll get back to you soon.",
      theme: "dark",
      timestamp: new Date().toISOString(),
      contactId: newContact._id
    });
  } catch (error) {
    console.error("Error submitting contact form:", error);
    res.status(500).json({
      code: "ERROR",
      message: "Oops! An error occurred while sending your message. Please try again later.",
      theme: "dark",
      timestamp: new Date().toISOString(),
      errorDetail: error.message,
    });
  }
};

// @desc    Get all contact requests
// @route   GET /api/contact
// @access  Admin
const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// Get Contact Request by ID
const getContactById = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact request not found" });
    }

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Update Contact status (e.g., mark as in_progress or resolved)
const updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["new", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const updates = { status };
    if (status === "resolved") {
      updates.resolvedAt = new Date();
    }

    const contact = await Contact.findByIdAndUpdate(id, updates, { new: true });
    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact request not found" });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Contact Request
const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return res.status(404).json({ success: false, message: "Contact request not found" });
    }

    res.json({ success: true, message: "Contact request deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  submitContact, 
  getAllContacts, 
  getContactById,
  updateContactStatus,
  deleteContact
};
