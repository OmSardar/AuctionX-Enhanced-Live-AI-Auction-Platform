import React, { useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

const Report = () => {
  // Get user info from Redux
  const { user } = useSelector((state) => state.auth || {});

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    orderNumber: "",
    reportType: "",
    details: "",
    attachments: [],
  });
  const API_URL = import.meta.env.VITE_API_URL;
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreviews, setImagePreviews] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (error) setError("");
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    // Restrict to maximum 2 files
    if (files.length > 2) {
      setError("You can only upload a maximum of 2 files.");
      return;
    }

    const validFiles = [];
    const previews = [];

    for (let file of files) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        setError("Only image files (PNG, JPG, JPEG) and PDF files are allowed.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB.");
        return;
      }

      validFiles.push(file);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previews.push({
            file: file,
            url: e.target.result,
            type: "image",
          });
          if (
            previews.length ===
            files.filter((f) => f.type.startsWith("image/")).length
          ) {
            setImagePreviews((prev) => [
              ...prev.filter((p) => p.type !== "image"),
              ...previews,
            ]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        previews.push({
          file: file,
          url: null,
          type: "pdf",
        });
      }
    }

    setError("");
    setFormData({
      ...formData,
      attachments: validFiles,
    });

    const nonImagePreviews = files
      .filter((f) => !f.type.startsWith("image/"))
      .map((file) => ({
        file: file,
        url: null,
        type: "pdf",
      }));

    if (nonImagePreviews.length > 0) {
      setImagePreviews((prev) => [
        ...prev.filter((p) => p.type !== "pdf"),
        ...nonImagePreviews,
      ]);
    }

    if (files.every((f) => f.type.startsWith("image/"))) {
      setImagePreviews([]);
    }
  };

  const removeFile = (index) => {
    const newAttachments = formData.attachments.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);

    setFormData({
      ...formData,
      attachments: newAttachments,
    });
    setImagePreviews(newPreviews);
  };

  const validateForm = () => {
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedDetails = formData.details.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return false;
    }

    if (!trimmedEmail) {
      setError("Email is required.");
      return false;
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return false;
    }

    if (!formData.reportType) {
      setError("Please select an issue type.");
      return false;
    }

    if (!trimmedDetails) {
      setError("Please provide details about your issue.");
      return false;
    }

    if (trimmedDetails.length < 10) {
      setError("Please provide at least 10 characters describing your issue.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (!validateForm()) {
      setIsSubmitting(false);
      return;
    }

    try {
      const submitData = new FormData();
      submitData.append("name", formData.name.trim());
      submitData.append("email", formData.email.trim());
      submitData.append("reportType", formData.reportType);
      submitData.append("details", formData.details.trim());

      const trimmedOrderNumber = formData.orderNumber.trim();
      if (trimmedOrderNumber) {
        submitData.append("orderNumber", trimmedOrderNumber);
      }

      formData.attachments.forEach((file) => {
        submitData.append("attachments", file);
      });

      const response = await fetch(`${API_URL}/api/admin/reports`, {
        method: "POST",
        body: submitData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            result.errors?.join(", ") ||
            "Failed to submit report"
        );
      }

      setIsSubmitted(true);

      setFormData({
        name: user?.name || "",
        email: user?.email || "",
        orderNumber: "",
        reportType: "",
        details: "",
        attachments: [],
      });
      setImagePreviews([]);

      const fileInput = document.getElementById("file-upload");
      if (fileInput) fileInput.value = "";
    } catch (err) {
      console.error("Error submitting report:", err);
      setError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reportTypes = [
    { id: "delivery", label: "Product Delivery Issues" },
    { id: "illegal", label: "Counterfeit or Prohibited Items" },
    { id: "payment-deposit", label: "Payment Issues - Deposit or Card Charge" },
    { id: "payment-withdraw", label: "Payment Issues - Payout or Withdrawal" },
    { id: "other", label: "Other Marketplace Concerns" },
  ];

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/10 px-3 py-1 rounded-full mb-3">
            Trust & Safety Support
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground mb-3">
            Report an Issue
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-xl mx-auto">
            We investigate every report swiftly to ensure a fair, transparent, and secure marketplace.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-status-error/10 border border-status-error/30 rounded-lg p-4 text-status-error text-sm flex items-center gap-3">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {isSubmitted ? (
          /* Success Screen */
          <div className="bg-surface border border-status-success/30 rounded-2xl p-8 sm:p-12 text-center shadow-warm-md">
            <div className="inline-flex justify-center items-center w-14 h-14 rounded-full bg-status-success/15 text-status-success mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold font-display text-foreground mb-2">
              Report Submitted Successfully
            </h2>
            <p className="text-muted text-sm sm:text-base max-w-md mx-auto mb-6">
              Thank you for keeping AuctionX safe. Our compliance team will review your report and follow up within 24–48 hours.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="px-5 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white text-sm font-medium rounded-lg shadow-warm-xs transition-colors"
              >
                Submit Another Report
              </button>
              <Link
                to="/"
                className="px-5 py-2.5 bg-surface border border-border-subtle hover:bg-surface-subtle text-foreground text-sm font-medium rounded-lg shadow-warm-xs transition-colors"
              >
                Back to Marketplace
              </Link>
            </div>
          </div>
        ) : (
          /* Report Form */
          <div className="bg-surface rounded-2xl shadow-warm-md border border-border-subtle overflow-hidden">
            <div className="px-6 py-5 border-b border-border-subtle bg-surface-subtle">
              <h2 className="text-lg font-semibold text-foreground">
                Report Incident Details
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Provide as much context as possible to help us investigate effectively.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                    Your Name <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    readOnly={!!user?.name}
                    className={`block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground placeholder-muted text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20 ${
                      user?.name ? "opacity-75 cursor-not-allowed bg-surface-subtle" : ""
                    }`}
                    placeholder="Enter your full name"
                  />
                  {user?.name && (
                    <p className="text-xs text-muted mt-1">Pre-filled from your authenticated account</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                    Email Address <span className="text-status-error">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    readOnly={!!user?.email}
                    className={`block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground placeholder-muted text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20 ${
                      user?.email ? "opacity-75 cursor-not-allowed bg-surface-subtle" : ""
                    }`}
                    placeholder="Enter your email address"
                  />
                  {user?.email && (
                    <p className="text-xs text-muted mt-1">Pre-filled from your authenticated account</p>
                  )}
                </div>

                {/* Order Number */}
                <div className="sm:col-span-2">
                  <label htmlFor="orderNumber" className="block text-sm font-medium text-foreground mb-1">
                    Order / Auction Item ID <span className="text-xs text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="orderNumber"
                    id="orderNumber"
                    value={formData.orderNumber}
                    onChange={handleChange}
                    className="block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground placeholder-muted text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                    placeholder="e.g. ORD-10924 or Item Listing #881"
                  />
                </div>

                {/* Report Type */}
                <div className="sm:col-span-2">
                  <label htmlFor="reportType" className="block text-sm font-medium text-foreground mb-1">
                    Category of Issue <span className="text-status-error">*</span>
                  </label>
                  <select
                    id="reportType"
                    name="reportType"
                    required
                    value={formData.reportType}
                    onChange={handleChange}
                    className="block w-full rounded-lg border border-border-subtle bg-surface px-3.5 py-2.5 text-foreground text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                  >
                    <option value="">Select an issue category</option>
                    {reportTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Details */}
                <div className="sm:col-span-2">
                  <label htmlFor="details" className="block text-sm font-medium text-foreground mb-1">
                    Description of Incident <span className="text-status-error">*</span>
                  </label>
                  <textarea
                    id="details"
                    name="details"
                    rows={4}
                    required
                    value={formData.details}
                    onChange={handleChange}
                    className="block w-full rounded-lg border border-border-subtle bg-surface p-3 text-foreground placeholder-muted text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20"
                    placeholder="Describe what occurred, any communication with the other party, and relevant dates... (min. 10 characters)"
                    minLength={10}
                  />
                  <div className="flex justify-between items-center text-xs text-muted mt-1">
                    <span>Be specific with names, timestamps, and tracking codes</span>
                    <span>{formData.details.length} characters (10 minimum)</span>
                  </div>
                </div>

                {/* File Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Supporting Documents / Images <span className="text-xs text-muted font-normal">(Max 2 files, up to 10MB each)</span>
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-border-subtle rounded-xl bg-surface-subtle hover:border-action-primary/50 transition-colors">
                    <div className="space-y-2 text-center">
                      <svg className="mx-auto h-10 w-10 text-muted" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex text-sm text-muted justify-center">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded font-medium text-action-primary hover:text-action-primary-hover focus-within:outline-none"
                        >
                          <span>Select files</span>
                          <input
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            className="sr-only"
                            multiple
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                          />
                        </label>
                        <span className="pl-1">or drag and drop</span>
                      </div>
                      <p className="text-xs text-muted">PNG, JPG, or PDF formats</p>
                    </div>
                  </div>

                  {/* Previews */}
                  {imagePreviews.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase text-muted tracking-wider mb-2">
                        Attached Files ({imagePreviews.length}/2):
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative rounded-lg border border-border-subtle p-2 bg-surface flex items-center gap-3">
                            {preview.type === "image" ? (
                              <img src={preview.url} alt={`Upload preview ${index + 1}`} className="w-12 h-12 object-cover rounded-md" />
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-status-error/10 text-status-error flex items-center justify-center font-bold text-xs">
                                PDF
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{preview.file.name}</p>
                              <p className="text-xs text-muted">{(preview.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="w-7 h-7 rounded-full bg-surface-subtle hover:bg-status-error hover:text-white flex items-center justify-center text-muted transition-colors text-xs"
                              aria-label="Remove attachment"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-border-subtle flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      name: user?.name || "",
                      email: user?.email || "",
                      orderNumber: "",
                      reportType: "",
                      details: "",
                      attachments: [],
                    });
                    setImagePreviews([]);
                    setError("");
                    const fileInput = document.getElementById("file-upload");
                    if (fileInput) fileInput.value = "";
                  }}
                  className="px-4 py-2.5 border border-border-subtle rounded-lg text-sm font-medium text-foreground hover:bg-surface-subtle transition-colors"
                >
                  Clear Form
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-action-primary hover:bg-action-primary-hover shadow-warm-xs transition-colors inline-flex items-center justify-center gap-2 ${
                    isSubmitting ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    "Submit Report"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Immediate Assistance Box */}
        <div className="mt-10 bg-surface rounded-xl p-6 border border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Need Immediate Assistance?
            </h3>
            <p className="text-xs text-muted mt-0.5">
              For urgent account lockouts or unauthorized transactions, reach our safety line.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <a href="tel:+18001234567" className="text-action-primary hover:underline flex items-center gap-1.5">
              <span>📞</span> +1 (800) 123-4567
            </a>
            <a href="mailto:support@auctionx.com" className="text-action-primary hover:underline flex items-center gap-1.5">
              <span>✉️</span> support@auctionx.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;
