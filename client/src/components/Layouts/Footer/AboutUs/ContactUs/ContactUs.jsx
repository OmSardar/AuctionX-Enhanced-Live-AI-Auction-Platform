import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useThemeProvider } from "../../../../AdminDashboard/utils/ThemeContext";
import { useSelector, useDispatch } from "react-redux";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";

const ContactUs = () => {
  const { currentTheme } = useThemeProvider();
  const user = useSelector((state) => state.auth.user);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });
  const API_URL = import.meta.env.VITE_API_URL;
  const [status, setStatus] = useState({ submitted: false, error: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token: csrfToken, loading } = useSelector((state) => state.csrf);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Only allow changes to subject and message if user is logged in
    if (!user || (name !== "name" && name !== "email")) {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.name ||
      !formData.email ||
      !formData.subject ||
      !formData.message
    ) {
      toast.error("All fields are required to send a message.");
      return;
    }

    setStatus({ submitted: false, error: false });
    setIsSubmitting(true);

    try {
      const response = await axios.post(`${API_URL}/api/contact/`, formData, {
        headers: {
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json",
        },
        withCredentials: true,
      });

      if (response.data.code === "SUCCESS") {
        setStatus({ submitted: true, error: false });
        toast.success(response.data.message);
        setFormData((prev) => ({ ...prev, subject: "", message: "" }));
      } else {
        throw new Error(response.data.message || "Failed to send message");
      }
    } catch (error) {
      setStatus({ submitted: true, error: true });
      const errorMessage =
        error.response?.data?.message ||
        "Oops! An error occurred while sending your message. Please try again later.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-canvas text-foreground py-24 transition-colors">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground">
            Contact Us
          </h1>
          <p className="mt-3 text-base text-foreground-secondary max-w-xl mx-auto">
            Have questions about live bidding, verified listings, or seller accounts? Our support team is ready to help.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Contact Form */}
          <div className="w-full lg:w-1/2">
            <form
              onSubmit={handleSubmit}
              className="bg-surface p-8 rounded-xl shadow-warm-lg border border-border-subtle transition-colors"
            >
              <div className="mb-6">
                <label htmlFor="contact-name" className="block text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-2">
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  placeholder="Your Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  readOnly={!!user} // Make read-only if user is logged in
                  className={`w-full p-3.5 rounded-lg border border-border-subtle ${
                    user
                      ? "bg-surface-subtle cursor-not-allowed opacity-80"
                      : "bg-surface-subtle"
                  } text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent transition-colors`}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="contact-email" className="block text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-2">
                  Your Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  placeholder="Your Email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  readOnly={!!user} // Make read-only if user is logged in
                  className={`w-full p-3.5 rounded-lg border border-border-subtle ${
                    user
                      ? "bg-surface-subtle cursor-not-allowed opacity-80"
                      : "bg-surface-subtle"
                  } text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent transition-colors`}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="contact-subject" className="block text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-2">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  placeholder="Subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full p-3.5 rounded-lg border border-border-subtle bg-surface-subtle text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent transition-colors"
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="contact-message" className="block text-xs font-semibold text-foreground-secondary uppercase tracking-wider mb-2">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  placeholder="Tell us how we can help..."
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full p-3.5 rounded-lg border border-border-subtle bg-surface-subtle text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring-focus focus:border-transparent transition-colors resize-y"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center bg-action-primary hover:bg-action-primary-hover disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-lg transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-ring-focus"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          </div>

          {/* Google Map and Contact Info */}
          <div className="w-full lg:w-1/2 flex flex-col justify-between">
            <div className="w-full h-80 rounded-xl overflow-hidden shadow-warm-lg border border-border-subtle">
              <iframe
                title="AuctionX Office Location"
                src="https://www.google.com/maps/d/embed?mid=13RYCmCKJ3-Rzs6hzfnXwT-tsJrkZubw&ehbc=2E312F"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>

            <div className="mt-8 p-8 bg-surface rounded-xl shadow-warm-lg border border-border-subtle transition-colors">
              <h3 className="text-lg font-bold text-foreground mb-4">Direct Communication</h3>
              <p className="flex items-center mb-4 text-foreground-secondary">
                <i className="fas fa-map-marker-alt mr-3 text-action-primary"></i>
                Pailan College of Technology and Management, West Bengal, India
              </p>
              <p className="flex items-center mb-4 text-foreground-secondary">
                <i className="fas fa-envelope mr-3 text-action-primary"></i>
                support@auctionx.com
              </p>
              <p className="flex items-center text-foreground-secondary">
                <i className="fas fa-phone mr-3 text-action-primary"></i>
                +91 98765 43210
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
