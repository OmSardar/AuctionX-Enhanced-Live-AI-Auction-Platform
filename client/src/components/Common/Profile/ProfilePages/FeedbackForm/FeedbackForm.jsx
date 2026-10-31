import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

function FeedbackForm() {
  const [displayForm, setDisplayForm] = useState(true);
  const [phValue, setPhValue] = useState("");
  const [checkedVal, setCheckedVal] = useState([]);
  const [errorMsg, setErrorMsg] = useState(
    "Please enter the value for the above field"
  );
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

  // Get user data from Redux store
  const { user } = useSelector((state) => state.auth || {});
  const emValue = user?.email || "";
  const nmValue = user?.name || "";

  const handleOnChange = (isChecked, value) => {
    let temp = [...checkedVal];
    const pre = value.split("_")[0];
    if (isChecked) {
      temp = temp.filter((item) => item.split("_")[0] !== pre);
      temp.push(value);
      setCheckedVal(temp);
    } else {
      setCheckedVal(temp.filter((item) => item !== value));
    }
  };

  const validateForm = () => {
    setErrorMsg("Please enter the value for the required fields");
    setShowErrors(true);

    if (!nmValue) return false;
    if (!emValue || !emValue.includes("@")) {
      setErrorMsg("Please enter a valid email address");
      return false;
    }
    if (!phValue || phValue.length < 10) {
      setErrorMsg("Please enter a valid phone number (at least 10 digits)");
      return false;
    }
    if (checkedVal.length < Object.keys(feedbackType).length) {
      setErrorMsg("Please answer all feedback questions below");
      return false;
    }

    return true;
  };

  const formSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const entry = {
        email: emValue,
        name: nmValue,
        phone: phValue,
        checkbox_values: checkedVal,
      };

      await axios.post(
        `${API_URL}/api/feedback/user`,
        entry,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      toast.success("Feedback sent successfully");
      setDisplayForm(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      const errorMessage =
        error.response?.data?.message ||
        "There was an error submitting your feedback. Please try again later.";

      setErrorMsg(errorMessage);
      toast.error(`Failed to submit feedback: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const feedbackType = {
    qos: "How easy was it to place a bid on items?",
    qob: "How would you rate the support you received from our team?",
    roc: "Was it easy to find the items you were looking for?",
    exp: "Please rate your overall marketplace experience.",
  };

  const feedbackOpts = ["Excellent", "Good", "Needs Improvement"];

  return (
    <div className="min-h-screen bg-canvas text-foreground py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-4xl mx-auto">
        {displayForm ? (
          <div className="bg-surface shadow-warm-md rounded-2xl border border-border-subtle overflow-hidden">
            {/* Header */}
            <div className="bg-surface-dark p-6 sm:p-8 text-foreground-inverse">
              <span className="inline-block text-xs uppercase tracking-wider font-semibold text-action-primary bg-action-primary/20 px-3 py-1 rounded-full mb-3">
                Continuous Improvement
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display mb-2">
                Your Feedback Matters
              </h1>
              <p className="text-muted text-sm sm:text-base max-w-xl">
                We are committed to providing you with the best auction experience possible. Your perspective shapes our upcoming platform releases.
              </p>
            </div>

            {/* Form */}
            <div className="p-6 sm:p-8">
              <form onSubmit={formSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-semibold text-foreground mb-1 after:content-['*'] after:ml-0.5 after:text-status-error"
                    >
                      Customer Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      required
                      readOnly={!!nmValue}
                      value={nmValue}
                      placeholder={nmValue ? "" : "Please log in to submit feedback"}
                      className={`w-full rounded-lg border border-border-subtle bg-surface px-4 py-2.5 text-foreground text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20 ${
                        nmValue ? "opacity-75 cursor-not-allowed bg-surface-subtle" : ""
                      }`}
                    />
                    {showErrors && !nmValue && (
                      <p className="mt-1.5 text-xs text-status-error">
                        ⓘ You must be logged in with a valid account name
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-foreground mb-1 after:content-['*'] after:ml-0.5 after:text-status-error"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      readOnly={!!emValue}
                      value={emValue}
                      placeholder={emValue ? "" : "Please log in with your email"}
                      className={`w-full rounded-lg border border-border-subtle bg-surface px-4 py-2.5 text-foreground text-sm shadow-warm-xs focus:border-action-primary focus:ring-2 focus:ring-action-primary/20 ${
                        emValue ? "opacity-75 cursor-not-allowed bg-surface-subtle" : ""
                      }`}
                    />
                    {showErrors && (!emValue || !emValue.includes("@")) && (
                      <p className="mt-1.5 text-xs text-status-error">
                        ⓘ Valid email address is required
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-semibold text-foreground mb-1 after:content-['*'] after:ml-0.5 after:text-status-error"
                  >
                    Contact Phone Number
                  </label>
                  <div className="relative">
                    <PhoneInput
                      placeholder="Enter phone number"
                      value={phValue}
                      onChange={setPhValue}
                      className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-foreground text-sm shadow-warm-xs focus-within:border-action-primary focus-within:ring-2 focus-within:ring-action-primary/20 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:text-foreground [&_.PhoneInputInput]:outline-none"
                    />
                  </div>
                  {showErrors && (!phValue || phValue.length < 10) && (
                    <p className="mt-1.5 text-xs text-status-error" id="phone-error">
                      ⓘ Valid phone number is required (at least 10 digits)
                    </p>
                  )}
                </div>

                {/* Rating Questions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {Object.keys(feedbackType).map((ty) => (
                    <div
                      key={ty}
                      className="bg-surface-subtle border border-border-subtle p-5 rounded-xl shadow-warm-xs"
                    >
                      <label className="block text-sm font-semibold text-foreground mb-3 after:content-['*'] after:ml-0.5 after:text-status-error">
                        {feedbackType[ty]}
                      </label>
                      <div className="space-y-2.5">
                        {feedbackOpts.map((opt, key) => (
                          <div
                            key={`${ty}_${key}`}
                            className="flex items-center cursor-pointer"
                          >
                            <input
                              id={`${ty}_${key}`}
                              name={`${ty}_feedback_opts`}
                              type="checkbox"
                              checked={checkedVal.includes(`${ty}_${opt}`)}
                              onChange={(e) =>
                                handleOnChange(e.target.checked, `${ty}_${opt}`)
                              }
                              className="h-4.5 w-4.5 rounded border-border-subtle text-action-primary accent-action-primary focus:ring-action-primary/20 cursor-pointer"
                            />
                            <label
                              htmlFor={`${ty}_${key}`}
                              className="ml-2.5 text-sm text-foreground cursor-pointer font-medium"
                            >
                              {opt}
                            </label>
                          </div>
                        ))}
                      </div>
                      {showErrors &&
                        !checkedVal.some((val) => val.startsWith(ty)) && (
                          <p
                            className="mt-2 text-xs text-status-error font-medium"
                            id={`er_${ty}`}
                          >
                            ⓘ Please select an option for this question
                          </p>
                        )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-center pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-8 py-3 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors cursor-pointer inline-flex items-center gap-2 ${
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
                      "Submit Feedback"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Thank You Screen */
          <div className="bg-surface shadow-warm-md rounded-2xl border border-border-subtle text-center p-8 sm:p-12">
            <div className="flex justify-center my-4">
              <div className="w-16 h-16 rounded-full bg-status-success/15 border border-status-success/30 flex items-center justify-center text-status-success">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-foreground mb-3">
              Thank You for Your Feedback!
            </h2>
            <p className="text-muted mb-8 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
              We appreciate you taking the time to share your perspective. Every submission is reviewed directly by our product management team.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="px-6 py-2.5 bg-action-primary hover:bg-action-primary-hover text-white font-medium text-sm rounded-lg shadow-warm-xs transition-colors cursor-pointer"
            >
              Return to Marketplace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FeedbackForm;
