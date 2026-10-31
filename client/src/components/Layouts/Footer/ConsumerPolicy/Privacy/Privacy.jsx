import React, { useState, useEffect } from "react";
import axios from "axios";
import { useThemeProvider } from "../../../../AdminDashboard/utils/ThemeContext";
import { fetchCsrfToken } from "../../../../../redux/slices/csrfSecuritySlice";
import { useSelector, useDispatch } from "react-redux";

const Privacy = () => {
  const { currentTheme, changeCurrentTheme } = useThemeProvider();
  const [activeSection, setActiveSection] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    category: "privacy", // Default category
    requestType: "",
    details: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const { token: csrfToken, loading } = useSelector((state) => state.csrf);
  const dispatch = useDispatch();

  const API_URL = import.meta.env.VITE_API_URL;
  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  // Function to handle PDF download
  const handleDownloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    // Set the title
    doc.setFontSize(18);
    doc.text("Privacy Policy", 10, 20);

    // Set the last updated date
    doc.setFontSize(12);
    doc.text("Last Updated: February 28, 2025", 10, 30);

    // Add the introductory paragraph
    doc.setFontSize(12);
    const introText =
      "At Auction X, we respect your privacy and are committed to protecting your personal information. " +
      "This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website " +
      "or use our auction platform. Please read this policy carefully to understand our practices regarding your personal data.";
    const introLines = doc.splitTextToSize(introText, 180); // Split text to fit within page width
    doc.text(introLines, 10, 40);
    let yOffset = 40 + introLines.length * 7 + 10; // Adjust yOffset based on the number of lines

    // Loop through sections and add them to the PDF
    sections.forEach((section, index) => {
      if (yOffset > 280) {
        doc.addPage(); // Add a new page if content exceeds the current page
        yOffset = 20; // Reset yOffset for the new page
      }

      // Add section title
      doc.setFontSize(14);
      doc.text(section.title, 10, yOffset);
      yOffset += 10;

      // Add section content
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(section.content, 180); // Split text to fit within page width
      doc.text(lines, 10, yOffset);
      yOffset += lines.length * 7 + 10; // Adjust yOffset based on the number of lines
    });

    // Save the PDF
    doc.save("privacy-policy.pdf");
  };

  // Function to handle privacy request submissions
  const handlePrivacyRequest = () => {
    setShowRequestForm(true);
  };

  // Function to close the request form modal
  const closeRequestForm = () => {
    setShowRequestForm(false);
    setSubmitStatus(null);
  };

  // Function to handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Convert form field names to match our data model
    const fieldMapping = {
      "request-name": "fullName",
      "request-email": "email",
      "request-type": "requestType",
      "request-details": "details",
    };

    setFormData({
      ...formData,
      [fieldMapping[name] || name]: value,
    });
  };

  // Handle form submission
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await axios.post(`${API_URL}/api/privacy`, formData, {
        headers: {
          "X-CSRF-Token": csrfToken,
        },
        withCredentials: true,
      });

      setSubmitStatus({
        success: true,
        message: "Your request has been submitted successfully.",
      });

      setFormData({
        fullName: "",
        email: "",
        category: "privacy",
        requestType: "",
        details: "",
      });

      setTimeout(() => {
        setShowRequestForm(false);
        setSubmitStatus(null);
      }, 3000);
    } catch (error) {
      setSubmitStatus({
        success: false,
        message: error.response?.data?.message || "Failed to submit request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle mobile sections
  const toggleSection = (index) => {
    setActiveSection(activeSection === index ? null : index);
  };

  // Scroll to a section (desktop view)
  const scrollToSection = (index) => {
    setActiveSection(index);
    const element = document.getElementById(`section-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Initialize the first section to be active on desktop
  useEffect(() => {
    // Only set if no section is active yet
    if (activeSection === null && window.innerWidth >= 1024) {
      setActiveSection(0);
    }
  }, []);

  const sections = [
    {
      title: "Information We Collect",
      content: `We collect personal information that you voluntarily provide to us when you register on our auction platform, express an interest in obtaining information about us or our products and services, participate in activities on the platform, or otherwise contact us.

      The personal information that we collect depends on the context of your interactions with us and the platform, the choices you make, and the products and features you use. The personal information we collect may include names, email addresses, phone numbers, mailing addresses, usernames, passwords, payment information, and demographic information.
      
      We also automatically collect certain information when you visit, use, or navigate our platform. This information does not reveal your specific identity but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our platform, and other technical information.`,
    },
    {
      title: "How We Use Your Information",
      content: `We use personal information collected via our platform for a variety of business purposes, including:
      • To facilitate account creation and authentication
      • To process your transactions and send transaction confirmations
      • To send administrative information regarding your account, our services, or changes to our terms and policies
      • To personalize your experience and deliver content relevant to your interests
      • To respond to your inquiries and provide customer service
      • To send promotional communications in accordance with your preferences
      • To protect our platform, troubleshoot issues, and detect fraudulent or illegal activity
      • To analyze usage patterns and optimize auction functionality
      • To improve our bidding systems and recommendation algorithms
      • To maintain accurate records of auction history and transactions`,
    },
    {
      title: "Sharing Your Information",
      content: `We may share your information with third parties in the following situations:
      • With service providers who perform services for us (such as payment processors, shipping providers, and customer support tools)
      • To comply with legal obligations (such as tax reporting requirements and responses to legal requests)
      • To protect and defend our rights and property (including detecting and preventing fraud)
      • With business partners with your consent
      • With other users when you share information publicly on the platform (such as your bidding activity or seller reviews)
      • In connection with a merger, sale, or acquisition of all or a portion of our company
      
      We require all third parties to respect the security of your personal information and to treat it in accordance with applicable laws.`,
    },
    {
      title: "Your Privacy Rights",
      content: `Depending on your location, you may have certain rights regarding your personal information, including:
      • The right to access information we have about you
      • The right to request we correct any inaccurate information
      • The right to request we delete your personal information
      • The right to opt-out of marketing communications
      • The right to withdraw consent at any time
      • The right to request we transfer your data to another entity (data portability)
      • The right to object to our processing of your personal data
      • The right to lodge a complaint with a data protection authority
      
      To exercise these rights, please contact us using the information provided in the "Contact Us" section. We will respond to all legitimate requests within the timeframes required by applicable law.`,
    },
    {
      title: "Security Measures",
      content: `We use administrative, technical, and physical security measures to protect your personal information. These measures include:
      
      • Encryption of sensitive data both in transit and at rest
      • Regular security assessments and penetration testing
      • Strict access controls and authentication procedures
      • Regular security training for all staff
      • 24/7 monitoring for suspicious activities
      • Secure data centers with physical access restrictions
      
      While we work to protect the security of your information, no transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.`,
    },
    {
      title: "Cookies Policy",
      content: `We use cookies and similar tracking technologies to collect and use information about you, including to:
      
      • Remember your preferences and settings
      • Understand how you interact with our platform
      • Analyze and improve our services
      • Serve interest-based advertising
      • Facilitate secure authentication
      • Prevent fraudulent activity
      
      You can control cookies through your browser settings and other tools. However, if you block certain cookies, you may not be able to register, login, or access certain parts of the platform.
      
      We use the following types of cookies:
      • Essential cookies: Necessary for the basic functions of the website
      • Functional cookies: Remember your preferences and settings
      • Analytics cookies: Help us understand how visitors interact with our website
      • Advertising cookies: Used to deliver relevant advertisements and track campaign performance`,
    },
    {
      title: "International Data Transfers",
      content: `We may process, store, and transfer your personal information in countries other than your own. Our servers may be located outside your state, province, or country, where data protection laws may differ from those in your jurisdiction.
      
      By submitting your personal information, you consent to this transfer, storing, and processing. We will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy, and no transfer of your personal information will take place to an organization or a country unless there are adequate controls in place.`,
    },
    {
      title: "Children's Privacy",
      content: `Our platform is not intended for individuals under the age of 18. We do not knowingly collect or solicit personal information from children. If we learn that we have collected personal information from a child under 18, we will promptly delete that information.
      
      If you believe we might have any information from or about a child under 18, please contact us using the information provided in the "Contact Us" section.`,
    },
    {
      title: "Changes to This Policy",
      content: `We may update this privacy policy from time to time. The updated version will be indicated by an updated "Revised" date and the updated version will be effective as soon as it is accessible.
      
      We will notify you of any significant changes by posting a notice on our platform or sending you an email. We encourage you to review this privacy policy frequently to be informed of how we are protecting your information.`,
    },
  ];

  return (
    <div className="min-h-screen mt-20 bg-canvas text-foreground transition-colors duration-200">
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl shadow-warm-lg overflow-hidden bg-surface border border-border-subtle">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Sidebar navigation for desktop */}
            <div className="hidden lg:block lg:col-span-1 border-r border-border-subtle p-6 bg-surface-subtle/50">
              <h3 className="text-lg font-semibold mb-4 text-foreground">
                Contents
              </h3>
              <nav className="space-y-2">
                {sections.map((section, index) => (
                  <button
                    key={`nav-${index}`}
                    onClick={() => scrollToSection(index)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      activeSection === index
                        ? "bg-action-primary/10 text-action-primary font-semibold border-l-2 border-action-primary"
                        : "text-foreground-secondary hover:bg-surface-subtle hover:text-foreground"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>

              <div className="mt-8 pt-6 border-t border-border-subtle">
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-foreground-muted">
                  Need Help?
                </h4>
                <a
                  href="mailto:privacy@auctionx.com"
                  className="text-sm flex items-center text-action-primary hover:underline transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                  </svg>
                  Email our Privacy Team
                </a>
              </div>
            </div>

            {/* Main content */}
            <div className="lg:col-span-4 px-6 py-8">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold mb-2 text-foreground">
                    Privacy Policy
                  </h1>
                  <p className="mb-6 text-sm text-foreground-secondary">
                    Last Updated: February 28, 2025
                  </p>
                </div>
                <div className="hidden lg:block">
                  <button
                    onClick={handleDownloadPDF}
                    className="bg-action-primary hover:bg-action-primary-hover text-white font-medium py-2.5 px-4 rounded-lg shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="prose max-w-none">
                <p
                  className={
                    currentTheme === "dark" ? "text-gray-300" : "text-gray-700"
                  }
                >
                  At Auction X, we respect your privacy and are committed to
                  protecting your personal information. This Privacy Policy
                  explains how we collect, use, disclose, and safeguard your
                  information when you visit our website or use our auction
                  platform. Please read this policy carefully to understand our
                  practices regarding your personal data.
                </p>
              </div>

              {/* Mobile version of contents (collapsible sections) */}
              <div className="lg:hidden mt-8 space-y-4">
                {sections.map((section, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg overflow-hidden ${
                      currentTheme === "dark"
                        ? "border-gray-600"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      onClick={() => toggleSection(index)}
                      className="w-full px-6 py-4 text-left flex justify-between items-center focus:outline-none"
                    >
                      <span
                        className={`text-lg font-medium ${
                          currentTheme === "dark"
                            ? "text-white"
                            : "text-gray-900"
                        }`}
                      >
                        {section.title}
                      </span>
                      <span
                        className={
                          currentTheme === "dark"
                            ? "text-gray-400"
                            : "text-gray-500"
                        }
                      >
                        {activeSection === index ? (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        )}
                      </span>
                    </button>

                    {activeSection === index && (
                      <div
                        className={`px-6 py-4 border-t ${
                          currentTheme === "dark"
                            ? "border-gray-600 bg-[#303030]"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div
                          className={`prose max-w-none whitespace-pre-line ${
                            currentTheme === "dark"
                              ? "text-gray-300"
                              : "text-gray-700"
                          }`}
                        >
                          {section.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop version of contents (always expanded) */}
              <div className="hidden lg:block mt-8 space-y-8">
                {sections.map((section, index) => (
                  <div
                    key={`desktop-${index}`}
                    id={`section-${index}`}
                    className="scroll-mt-20"
                  >
                    <h2
                      className={`text-xl font-semibold mb-4 pb-2 border-b ${
                        currentTheme === "dark"
                          ? "text-white border-gray-600"
                          : "text-gray-900 border-gray-200"
                      }`}
                    >
                      {section.title}
                    </h2>
                    <div
                      className={`prose max-w-none whitespace-pre-line ${
                        currentTheme === "dark"
                          ? "text-gray-300"
                          : "text-gray-700"
                      }`}
                    >
                      {section.content}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`mt-10 pt-6 border-t ${
                  currentTheme === "dark"
                    ? "border-gray-600"
                    : "border-gray-200"
                }`}
              >
                <h2
                  className={`text-xl font-semibold mb-4 ${
                    currentTheme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  Privacy Request
                </h2>
                <p
                  className={
                    currentTheme === "dark" ? "text-gray-300" : "text-gray-700"
                  }
                >
                  If you have questions or comments about this policy, you may
                  contact us at:
                </p>
                <div
                  className={`mt-4 rounded-lg p-6 border ${
                    currentTheme === "dark"
                      ? "bg-[#303030] border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p
                        className={`font-medium ${
                          currentTheme === "dark"
                            ? "text-white"
                            : "text-gray-900"
                        }`}
                      >
                        Auction X, Inc.
                      </p>
                      <p
                        className={
                          currentTheme === "dark"
                            ? "text-gray-300"
                            : "text-gray-700"
                        }
                      >
                        123 Auction Avenue, Suite 100
                      </p>
                      <p
                        className={
                          currentTheme === "dark"
                            ? "text-gray-300"
                            : "text-gray-700"
                        }
                      >
                        Bidders City, BC 12345
                      </p>
                    </div>
                    <div>
                      <p
                        className={`flex items-center ${
                          currentTheme === "dark"
                            ? "text-gray-300"
                            : "text-gray-700"
                        }`}
                      >
                        <svg
                          className={`h-5 w-5 mr-2 ${
                            currentTheme === "dark"
                              ? "text-gray-400"
                              : "text-gray-500"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <a
                          href="mailto:privacy@auctionx.com"
                          className={`transition-colors ${
                            currentTheme === "dark"
                              ? "hover:text-blue-400"
                              : "hover:text-blue-600"
                          }`}
                        >
                          privacy@auctionx.com
                        </a>
                      </p>
                      <p
                        className={`flex items-center ${
                          currentTheme === "dark"
                            ? "text-gray-300"
                            : "text-gray-700"
                        }`}
                      >
                        <svg
                          className={`h-5 w-5 mr-2 ${
                            currentTheme === "dark"
                              ? "text-gray-400"
                              : "text-gray-500"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <a
                          href="tel:5551234567"
                          className={`transition-colors ${
                            currentTheme === "dark"
                              ? "hover:text-blue-400"
                              : "hover:text-blue-600"
                          }`}
                        >
                          (555) 123-4567
                        </a>
                      </p>
                      <button
                        onClick={handlePrivacyRequest}
                        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Submit Privacy Request
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`mt-10 pt-6 border-t text-center text-sm ${
                  currentTheme === "dark"
                    ? "border-gray-600 text-gray-400"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                <p>© 2025 Auction X, Inc. All rights reserved.</p>
                <div className="mt-2 flex justify-center space-x-6">
                  <a
                    href="/terms"
                    className={`transition-colors ${
                      currentTheme === "dark"
                        ? "text-gray-500 hover:text-gray-400"
                        : "text-gray-400 hover:text-gray-500"
                    }`}
                  >
                    Terms of Service
                  </a>
                  <a
                    href="/privacy"
                    className={`transition-colors ${
                      currentTheme === "dark"
                        ? "text-gray-500 hover:text-gray-400"
                        : "text-gray-400 hover:text-gray-500"
                    }`}
                  >
                    Privacy Policy
                  </a>
                  <a
                    href="/cookies"
                    className={`transition-colors ${
                      currentTheme === "dark"
                        ? "text-gray-500 hover:text-gray-400"
                        : "text-gray-400 hover:text-gray-500"
                    }`}
                  >
                    Cookie Policy
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Request Modal */}
        {showRequestForm && (
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity"
                aria-hidden="true"
              >
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span
                className="hidden sm:inline-block sm:align-middle sm:h-screen"
                aria-hidden="true"
              >
                &#8203;
              </span>
              <div
                className={`inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${
                  currentTheme === "dark" ? "bg-[#404040]" : "bg-white"
                }`}
              >
                <div
                  className={`px-4 pt-5 pb-4 sm:p-6 sm:pb-4 ${
                    currentTheme === "dark" ? "bg-[#404040]" : "bg-white"
                  }`}
                >
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3
                        className={`text-lg leading-6 font-medium ${
                          currentTheme === "dark"
                            ? "text-white"
                            : "text-gray-900"
                        }`}
                        id="modal-title"
                      >
                        Submit Privacy Request
                      </h3>
                      <div className="mt-2">
                        <p
                          className={`text-sm ${
                            currentTheme === "dark"
                              ? "text-gray-400"
                              : "text-gray-500"
                          }`}
                        >
                          Please fill out this form to submit a privacy-related
                          request. Our team will respond within 30 days.
                        </p>
                      </div>

                      {submitStatus && (
                        <div
                          className={`mt-4 p-3 rounded ${
                            submitStatus.success
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {submitStatus.message}
                        </div>
                      )}

                      <form
                        onSubmit={handleSubmitRequest}
                        className="mt-4 space-y-4"
                      >
                        <div>
                          <label
                            htmlFor="request-name"
                            className={`block text-sm font-medium ${
                              currentTheme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Full Name
                          </label>
                          <input
                            type="text"
                            name="request-name"
                            id="request-name"
                            required
                            value={formData.fullName}
                            onChange={handleChange}
                            className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                              currentTheme === "dark"
                                ? "bg-[#303030] border-gray-600 text-white"
                                : "border-gray-300"
                            }`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="request-email"
                            className={`block text-sm font-medium ${
                              currentTheme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Email Address
                          </label>
                          <input
                            type="email"
                            name="request-email"
                            id="request-email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                              currentTheme === "dark"
                                ? "bg-[#303030] border-gray-600 text-white"
                                : "border-gray-300"
                            }`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="request-type"
                            className={`block text-sm font-medium ${
                              currentTheme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Request Type
                          </label>
                          <select
                            id="request-type"
                            name="request-type"
                            required
                            value={formData.requestType}
                            onChange={handleChange}
                            className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                              currentTheme === "dark"
                                ? "bg-[#303030] border-gray-600 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            <option value="">Select a request type</option>
                            <option value="access">Access My Data</option>
                            <option value="delete">Delete My Data</option>
                            <option value="correct">Correct My Data</option>
                            <option value="optout">Opt-Out of Marketing</option>
                            <option value="other">Other Request</option>
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="request-details"
                            className={`block text-sm font-medium ${
                              currentTheme === "dark"
                                ? "text-gray-300"
                                : "text-gray-700"
                            }`}
                          >
                            Request Details
                          </label>
                          <textarea
                            id="request-details"
                            name="request-details"
                            rows={4}
                            required
                            value={formData.details}
                            onChange={handleChange}
                            className={`mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                              currentTheme === "dark"
                                ? "bg-[#303030] border-gray-600 text-white"
                                : "border-gray-300"
                            }`}
                            placeholder="Please provide details about your request..."
                          ></textarea>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse bg-surface-subtle border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={handleSubmitRequest}
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-lg shadow-xs px-4 py-2 bg-action-primary text-sm font-semibold text-white hover:bg-action-primary-hover focus:outline-none focus:ring-2 focus:ring-ring-focus sm:ml-3 sm:w-auto transition-colors cursor-pointer"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                  <button
                    type="button"
                    onClick={closeRequestForm}
                    className="mt-3 w-full inline-flex justify-center rounded-lg border border-border-subtle shadow-xs px-4 py-2 text-sm font-medium bg-surface text-foreground hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-ring-focus sm:mt-0 sm:ml-3 sm:w-auto transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Privacy;
