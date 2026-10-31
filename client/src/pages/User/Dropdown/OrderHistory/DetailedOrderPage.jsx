import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import toast from "react-hot-toast";

import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import DownloadInvoice from "../../../../components/User/DownloadInvoice/DownloadInvoice";
import ProgressBar from "../../../../components/User/ProgressBar/ProgressBar";
import { fetchCsrfToken } from "../../../../redux/slices/csrfSecuritySlice";
import { formatCurrency } from "../../../../lib/utils";

const API_URL = import.meta.env.VITE_API_URL;
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_API_KEY;

const DetailedOrderPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  // Redux state
  const { token: csrfToken } = useSelector((state) => state.csrf);
  const user = useSelector((state) => state.auth?.user);
  const userEmail = user?.email;

  // Payment states
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [pendingVerificationPayload, setPendingVerificationPayload] = useState(null);

  // Review & rating states
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Modals state
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState(null);

  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Fetch CSRF token if missing
  useEffect(() => {
    if (!csrfToken && !loading) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken, loading]);

  // Fetch order details
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        if (!id) {
          setError("Invalid Order ID");
          setLoading(false);
          return;
        }

        const response = await axiosWithAuth.get(`/orders/${id}`);
        setOrder(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching order details:", err);
        setError("Failed to fetch order details");
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [id]);

  // Helper to determine active step number for tracker
  const calculateCurrentStep = (orderData) => {
    if (!orderData) return 1;
    if (orderData.status === "PENDING") return 1;
    if (orderData.status === "CANCELLED" || orderData.status === "EXPIRED" || orderData.status === "REFUNDED") return 1;
    if (orderData.deliveredAt || orderData.status === "DELIVERED") return 4;
    if (orderData.shippedAt || orderData.status === "SHIPPED") return 3;
    if (orderData.status === "PAID") return 2;
    return 1;
  };

  // Gracefully format address (resolving single-letter placeholders like "A")
  const formatDeliveryAddress = (orderData) => {
    if (!orderData) return "";
    const rawAddress = (orderData.address || "").trim();

    const isPlaceholder = !rawAddress || rawAddress.length < 5;
    if (isPlaceholder) {
      const parts = [
        rawAddress ? `Street Address: ${rawAddress}` : null,
        user?.city ? `City: ${user.city}` : null,
        user?.state ? `State: ${user.state}` : null,
        user?.pinCode ? `PIN: ${user.pinCode}` : null,
        "India",
      ].filter(Boolean);

      return {
        formatted: parts.length > 1 ? parts.join(", ") : "Incomplete address on file",
        isIncomplete: true,
        raw: rawAddress,
      };
    }

    return {
      formatted: rawAddress,
      isIncomplete: false,
      raw: rawAddress,
    };
  };

  // Payment Handler
  const handlePayNow = async () => {
    if (!order || isPaying || isVerifying) return;
    setIsPaying(true);
    setPaymentError(null);
    try {
      const res = await axiosWithAuth.post("/payment/create-order", {
        orderId: order._id,
      });
      const { razorpayOrderId, amount, currency, keyId } = res.data;

      const effectiveKey = keyId || RAZORPAY_KEY;
      if (!effectiveKey) {
        setPaymentError("Payment gateway public key is not configured. Please contact support.");
        setIsPaying(false);
        return;
      }

      const options = {
        key: effectiveKey,
        amount,
        currency: currency || "INR",
        name: "AuctionX",
        description: `Payment for ${order.title}`,
        order_id: razorpayOrderId,
        handler: async (response) => {
          setIsVerifying(true);
          setPaymentError(null);
          const payload = {
            orderId: order._id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          };
          setPendingVerificationPayload(payload);

          try {
            const verifyRes = await axiosWithAuth.post("/payment/verify", payload);
            if (verifyRes.data.success) {
              setPendingVerificationPayload(null);
              toast.success("Payment verified successfully!");
              const refreshed = await axiosWithAuth.get(`/orders/${id}`);
              setOrder(refreshed.data);
            }
          } catch (verifyErr) {
            console.error("[PaymentVerification] Verification request failed:", verifyErr);
            const errMsg =
              verifyErr.response?.data?.message ||
              "Payment verification request failed. If money was deducted, click 'Re-check Payment Status'.";
            setPaymentError(errMsg);
          } finally {
            setIsVerifying(false);
            setIsPaying(false);
          }
        },
        prefill: {
          name: order.name,
          email: order.userEmail,
          contact: order.phoneNo,
        },
        theme: { color: "#C8622A" },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
          },
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (failedRes) => {
          setIsPaying(false);
          setPaymentError(
            failedRes.error?.description || "Payment was declined or failed by bank/gateway."
          );
        });
        rzp.open();
      } else {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", (failedRes) => {
            setIsPaying(false);
            setPaymentError(
              failedRes.error?.description || "Payment was declined or failed by bank/gateway."
            );
          });
          rzp.open();
        };
        script.onerror = () => {
          setIsPaying(false);
          setPaymentError("Failed to load Razorpay checkout script. Check your internet connection.");
        };
        document.body.appendChild(script);
      }
    } catch (err) {
      setIsPaying(false);
      setPaymentError(
        err.response?.data?.message || "Failed to initiate payment"
      );
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!order?._id || isVerifying) return;
    setIsVerifying(true);
    setPaymentError(null);
    try {
      if (pendingVerificationPayload) {
        try {
          const verifyRes = await axiosWithAuth.post(
            "/payment/verify",
            pendingVerificationPayload
          );
          if (verifyRes.data.success) {
            setPendingVerificationPayload(null);
            const refreshed = await axiosWithAuth.get(`/orders/${id}`);
            setOrder(refreshed.data);
            setIsVerifying(false);
            toast.success("Payment status confirmed: PAID");
            return;
          }
        } catch (_) {
          // Fall through
        }
      }

      const statusRes = await axiosWithAuth.get(`/payment/order/${order._id}`);
      if (statusRes.data?.orderStatus === "PAID") {
        const refreshed = await axiosWithAuth.get(`/orders/${id}`);
        setOrder(refreshed.data);
        toast.success("Payment confirmed!");
      } else {
        setPaymentError("Payment has not been confirmed yet. If payment was completed, please allow a moment for gateway webhook confirmation.");
      }
    } catch (err) {
      setPaymentError(
        err.response?.data?.message || "Unable to check payment status at this moment."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // Support Modal Handlers
  const handleOpenSupportModal = () => {
    setSupportSubject(`Inquiry regarding Order #${order._id.slice(-8).toUpperCase()} - ${order.title}`);
    setSupportMessage("");
    setSupportSuccess(false);
    setSupportError(null);
    setIsSupportModalOpen(true);
  };

  const handleSendSupport = async (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) {
      setSupportError("Please enter your message or question.");
      return;
    }

    setIsSendingSupport(true);
    setSupportError(null);

    try {
      const payload = {
        name: order.name || user?.name || "AuctionX Winner",
        email: order.userEmail || user?.email || "support-request@auctionx.internal",
        subject: supportSubject,
        message: supportMessage,
      };

      await axios.post(`${API_URL}/api/contact`, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        withCredentials: true,
      });

      setSupportSuccess(true);
      toast.success("Support inquiry sent successfully! A representative will contact you shortly.");
      setTimeout(() => {
        setIsSupportModalOpen(false);
      }, 2000);
    } catch (err) {
      console.error("Support submission error:", err);
      setSupportError(
        err.response?.data?.message || "Failed to submit inquiry. Please try again or email support directly."
      );
    } finally {
      setIsSendingSupport(false);
    }
  };

  // Copy tracking number handler
  const handleCopyTracking = () => {
    const trackingCode = `AX-TRK-${order._id.slice(-8).toUpperCase()}`;
    navigator.clipboard.writeText(trackingCode);
    setCopiedTracking(true);
    toast.success("Tracking number copied to clipboard!");
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  // Review Submissions
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter((file) => {
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        setSubmitError("Only JPG, PNG, GIF, or WEBP images are allowed");
        return false;
      }
      if (file.size > maxSize) {
        setSubmitError("Image size must be less than 5MB");
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;
    if (uploadedImages.length + validFiles.length > 5) {
      setSubmitError("You can upload a maximum of 5 images");
      return;
    }

    const imagePromises = validFiles.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            preview: e.target.result,
            name: file.name,
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then((images) => {
      setUploadedImages((prev) => [...prev, ...images]);
    });
  };

  const removeImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReviewSubmit = async () => {
    if (rating === 0) {
      setSubmitError("Please provide a star rating");
      return;
    }
    if (!review.trim()) {
      setSubmitError("Please write your review");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!userEmail) {
        throw new Error("User email not available. Please ensure you are logged in.");
      }

      const formData = new FormData();
      formData.append("productName", order.title);
      formData.append("rating", rating);
      formData.append("reviewText", review);
      formData.append("orderId", order._id);
      formData.append("userEmail", userEmail);
      formData.append("sellerEmail", order.sellerEmail || "seller@auctionx.internal");

      if (uploadedImages.length > 0) {
        formData.append("productImage", uploadedImages[0].file);
      } else if (order.images?.[0]?.secure_url) {
        formData.append("productImageUrl", order.images[0].secure_url);
      }

      uploadedImages.slice(1).forEach((image) => {
        formData.append("additionalPhotos", image.file);
      });

      const response = await axios.post(
        `${API_URL}/api/product-feedback/add`,
        formData,
        {
          headers: {
            "X-CSRF-Token": csrfToken,
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );

      if (response.data.success) {
        setSubmitSuccess(true);
        toast.success("Thank you! Your product review has been submitted.");
        setRating(0);
        setReview("");
        setUploadedImages([]);
      } else {
        setSubmitError(response.data.message || "Failed to submit feedback");
      }
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError(
        err.response?.data?.message || err.message || "Failed to submit feedback"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-12 text-center backdrop-blur-md shadow-2xl">
            <div className="relative inline-block mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-700 border-t-orange-500 mx-auto"></div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Loading Order Details
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Synchronizing auction settlement and delivery records...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 sm:p-12 text-center shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-3xl flex items-center justify-center mx-auto mb-6">
              ⚠️
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Unable to Retrieve Order
            </h2>
            <p className="text-slate-400 text-base mb-8">{error}</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all border border-slate-700"
              >
                Try Again
              </button>
              <Link
                to="/orders"
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-semibold transition-all shadow-lg"
              >
                Back to Orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-3xl">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center shadow-2xl">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-white mb-2">Order Not Found</h2>
            <p className="text-slate-400 mb-6">
              The requested auction order reference does not exist or has been removed.
            </p>
            <Link
              to="/orders"
              className="inline-flex px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold transition"
            >
              Return to Your Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const deliveryAddress = formatDeliveryAddress(order);
  const totalAmountDue = order.finalPrice !== undefined ? order.finalPrice : order.highestBid;
  const priceAppreciation = (totalAmountDue || 0) - (order.biddingStartPrice || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-orange-400 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Orders
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Order Reference:</span>
            <span className="text-slate-200 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
              #{order._id}
            </span>
          </div>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
                  Auction Settlement Record
                </span>
                <span
                  className={`text-xs uppercase font-bold px-3 py-1 rounded-full border ${
                    order.status === "PAID"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : order.status === "PENDING"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
                >
                  {order.status === "PAID" ? "✓ Paid & Confirmed" : order.status}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Order #{order._id.slice(-8).toUpperCase()}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Won on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>

            {/* Quick Invoice Button in Header */}
            <div className="shrink-0">
              <DownloadInvoice id={order._id} order={order} />
            </div>
          </div>
        </div>

        {/* Multi-Stage Order Progress Tracker */}
        <ProgressBar
          currentStep={calculateCurrentStep(order)}
          totalSteps={4}
          status={order.status}
          orderDate={order.createdAt}
          paidAt={order.paidAt}
        />

        {/* Main 3-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Card 1: Delivery Address & Buyer Info */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl">
                  📍
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delivery Address</h3>
                  <p className="text-xs text-slate-400">Recipient destination details</p>
                </div>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Recipient</span>
                  <span className="text-white font-semibold text-base">{order.name || "Valued Winner"}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Shipping Address</span>
                  <p className="text-slate-200 mt-0.5 leading-relaxed font-medium">
                    {deliveryAddress.formatted}
                  </p>

                  {deliveryAddress.isIncomplete && (
                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                      <p className="font-semibold mb-1">⚠️ Incomplete Address Notice</p>
                      <p className="text-amber-200/90 mb-2">
                        Your registered shipping address appears brief ({deliveryAddress.raw || "blank"}). Please ensure your full delivery address with PIN code is updated before dispatch.
                      </p>
                      <Link
                        to="/profilesettings"
                        className="inline-flex items-center text-xs font-bold text-orange-400 hover:text-orange-300 underline"
                      >
                        Update Profile Shipping Address →
                      </Link>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Contact Phone</span>
                  <span className="text-slate-200 font-medium">{order.phoneNo || "Not provided"}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">Notification Email</span>
                  <span className="text-slate-200 font-medium break-all">{order.userEmail}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Carrier: BlueDart Express (Simulated Partner)</span>
              <span className="text-emerald-400 font-semibold">Standard Insured</span>
            </div>
          </div>

          {/* Card 2: Won Product & Auction Context */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-xl">
                  🏆
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Won Lot Details</h3>
                  <p className="text-xs text-slate-400">Authentic auction listing</p>
                </div>
              </div>

              {/* Product Photo */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 mb-5 group">
                <img
                  src={order.images?.[0]?.secure_url || "/lot-placeholder.svg"}
                  alt={order.title}
                  className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/lot-placeholder.svg";
                  }}
                />
                <div className="absolute top-3 right-3">
                  <span className="bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2.5 py-1 rounded-lg">
                    Winning Lot
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xl font-bold text-white line-clamp-2">
                  {order.title}
                </h4>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700">
                    ID: {order.productId || order._id.slice(-6)}
                  </span>
                  <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700">
                    Seller: {order.sellerEmail || "Verified Merchant"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800">
              {order.productId ? (
                <Link
                  to={`/product/${order.productId}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition border border-slate-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Original Listing
                </Link>
              ) : null}
            </div>
          </div>

          {/* Card 3: Financial Settlement & Quick Actions */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">
                  💳
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Financial Breakdown</h3>
                  <p className="text-xs text-slate-400">Complete transaction reconciliation</p>
                </div>
              </div>

              {/* Financial Itemization */}
              <div className="space-y-3 text-sm pb-5 border-b border-slate-800">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Starting Reserve Price</span>
                  <span className="font-mono text-slate-300">
                    {formatCurrency(order.biddingStartPrice)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Winning Accepted Bid</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {formatCurrency(order.highestBid)}
                  </span>
                </div>

                {priceAppreciation > 0 && (
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span className="text-slate-400">Auction Competition Gain</span>
                    <span className="font-mono text-orange-400 font-medium">
                      +{formatCurrency(priceAppreciation)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-400">
                  <span>Shipping & Handling</span>
                  <span className="text-emerald-400 font-medium">₹0 (Free)</span>
                </div>

                <div className="flex justify-between items-center text-slate-400">
                  <span>Platform Fee & GST</span>
                  <span className="text-slate-300">Included</span>
                </div>
              </div>

              {/* Total Settlement Amount */}
              <div className="py-4 flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-400 block font-semibold">
                    Total Amount
                  </span>
                  <span className="text-2xl font-black text-white">
                    {formatCurrency(totalAmountDue)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Status</span>
                  <span
                    className={`text-sm font-bold ${
                      order.status === "PAID"
                        ? "text-emerald-400"
                        : order.status === "PENDING"
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {order.status === "PAID" ? "Settled & Paid" : order.status}
                  </span>
                </div>
              </div>

              {order.status === "PAID" && (
                <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    {order.paymentMethod === "WALLET" || order.walletSettled
                      ? "Paid via AuctionX Wallet Escrow — No second payment required"
                      : "Paid via Online Payment Gateway"}
                  </span>
                </div>
              )}

              {/* Payment Verification / Error Feedback */}
              {isVerifying && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-3 text-xs text-blue-300">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full shrink-0"></div>
                  <span>Verifying transaction with Razorpay... Please wait.</span>
                </div>
              )}

              {paymentError && !isVerifying && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  {paymentError}
                </div>
              )}
            </div>

            {/* Quick Actions Stack */}
            <div className="space-y-3 mt-6 pt-4 border-t border-slate-800">
              {/* Action 1: Pay Now (Only for PENDING) */}
              {order.status === "PENDING" && (
                <>
                  <button
                    onClick={handlePayNow}
                    disabled={isPaying || isVerifying}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl transition shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isPaying
                      ? "Opening Razorpay..."
                      : isVerifying
                      ? "Verifying Payment..."
                      : `Pay ${formatCurrency(totalAmountDue)} Now`}
                  </button>

                  {(paymentError || pendingVerificationPayload) && (
                    <button
                      onClick={handleCheckPaymentStatus}
                      disabled={isVerifying}
                      className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Re-check Payment Status
                    </button>
                  )}
                </>
              )}

              {/* Action 2: Track Package */}
              <button
                onClick={() => setIsTrackModalOpen(true)}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-750 text-white font-semibold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2.5 shadow-md group"
              >
                <svg className="w-5 h-5 text-blue-400 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Track Package
              </button>

              {/* Action 3: Contact Support */}
              <button
                onClick={handleOpenSupportModal}
                className="w-full py-3 px-4 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold rounded-xl border border-slate-750 transition flex items-center justify-center gap-2.5 group"
              >
                <svg className="w-5 h-5 text-purple-400 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.444l-3.448 1.724a1.009 1.009 0 01-1.413-1.413l1.724-3.448A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                </svg>
                Contact Support
              </button>
            </div>
          </div>
        </div>

        {/* Rate & Review Section */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl backdrop-blur-md mb-12">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl">
              ⭐
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Rate & Review Your Experience</h3>
              <p className="text-slate-400 text-sm">
                Share verified feedback with the seller and the AuctionX community.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Column: Star Rating & Review Text */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
                  Your Overall Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-3xl focus:outline-none transition-transform hover:scale-125"
                    >
                      <span
                        className={
                          star <= (hoverRating || rating)
                            ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                            : "text-slate-700"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                  <span className="ml-3 text-sm font-semibold text-slate-400 self-center">
                    {rating > 0 ? `${rating} of 5 Stars` : "Select a rating"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
                  Write Your Review
                </label>
                <div className="relative">
                  <textarea
                    value={review}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setReview(e.target.value);
                      }
                    }}
                    rows={5}
                    placeholder="Describe item condition, packaging quality, seller communication, or delivery speed..."
                    className="w-full bg-slate-950/70 border border-slate-700 rounded-2xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition resize-none text-sm"
                  />
                  <span className="absolute bottom-3 right-4 text-xs text-slate-400">
                    {review.length}/500
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Image Uploads & Submit */}
            <div className="space-y-6">
              <div>
                <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-3">
                  Add Photos (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center hover:border-orange-500/50 transition">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="review-images"
                  />
                  <label
                    htmlFor="review-images"
                    className="cursor-pointer inline-flex flex-col items-center gap-2"
                  >
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-semibold text-orange-400">
                      Click to upload photos
                    </span>
                    <span className="text-xs text-slate-400">
                      PNG, JPG up to 5MB (max 5 images)
                    </span>
                  </label>
                </div>

                {uploadedImages.length > 0 && (
                  <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                        <img src={img.preview} alt="Upload" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 rounded-bl-lg text-xs flex items-center justify-center font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                  {submitError}
                </div>
              )}

              {submitSuccess ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                  <p className="text-sm font-bold text-emerald-400 mb-1">
                    ✓ Feedback Received!
                  </p>
                  <p className="text-xs text-slate-400">
                    Thank you for contributing to the AuctionX buyer community.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleReviewSubmit}
                  disabled={isSubmitting || rating === 0}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-2xl transition shadow-lg hover:shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Submitting Feedback...</span>
                    </>
                  ) : (
                    <span>Submit Verified Review</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TRACK PACKAGE MODAL */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsTrackModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xl">
                🚚
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">Order Tracking</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
                    Simulated Demo
                  </span>
                </div>
                <p className="text-xs text-slate-400">Carrier: BlueDart Express (Simulated Preview)</p>
              </div>
            </div>

            {/* AWB Code Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 block">AWB Tracking Number (Simulated)</span>
                <span className="font-mono text-base font-bold text-orange-400">
                  AX-TRK-{order._id.slice(-8).toUpperCase()}
                </span>
              </div>
              <button
                onClick={handleCopyTracking}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                {copiedTracking ? "Copied! ✓" : "Copy"}
              </button>
            </div>

            {/* Truthful Carrier Notice */}
            <div className="mb-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5">
              <span className="text-blue-400 text-sm mt-0.5">ℹ️</span>
              <p>
                <span className="text-slate-300 font-semibold">Simulated Tracking Notice:</span> Live carrier dispatch tracking requires production 3PL logistics API integration. When live carrier tracking is unavailable, milestone events reflect simulated order progress.
              </p>
            </div>

            {/* Tracking Milestones */}
            <div className="space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 mb-6">
              <div className="relative">
                <span className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900"></span>
                <h4 className="text-sm font-bold text-white">Auction Won & Order Generated</h4>
                <p className="text-xs text-slate-400">
                  {new Date(order.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              <div className="relative">
                <span
                  className={`absolute -left-6 top-0 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    order.status === "PAID" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                ></span>
                <h4 className="text-sm font-bold text-white">Payment Settlement</h4>
                <p className="text-xs text-slate-400">
                  {order.paidAt
                    ? `Confirmed on ${new Date(order.paidAt).toLocaleDateString("en-IN")}`
                    : "Awaiting settlement"}
                </p>
              </div>

              <div className="relative">
                <span
                  className={`absolute -left-6 top-0 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    order.status === "PAID" ? "bg-blue-500" : "bg-slate-700"
                  }`}
                ></span>
                <h4 className="text-sm font-bold text-white">Shipment & Carrier Handover</h4>
                <p className="text-xs text-slate-400">
                  {order.status === "PAID"
                    ? "Live carrier tracking unavailable for this test order (Simulated Preview: Queued for seller dispatch)"
                    : "Scheduled upon settlement"}
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-6 top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-900"></span>
                <h4 className="text-sm font-bold text-slate-400">Delivered to Destination</h4>
                <p className="text-xs text-slate-400">
                  {order.status === "PAID"
                    ? `Estimated 2–4 business days post-dispatch to ${deliveryAddress.formatted}`
                    : "Estimated upon dispatch"}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
              <span>Insured Transit Guarantee</span>
              <button
                onClick={() => setIsTrackModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT SUPPORT MODAL */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsSupportModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-white text-xl font-bold w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center transition"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl">
                💬
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Contact Order Support</h3>
                <p className="text-xs text-slate-400">
                  Direct ticket for Order #{order._id.slice(-8).toUpperCase()}
                </p>
              </div>
            </div>

            {supportSuccess ? (
              <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center">
                <div className="text-3xl mb-2">✓</div>
                <h4 className="text-lg font-bold text-emerald-400 mb-1">
                  Ticket Submitted Successfully
                </h4>
                <p className="text-xs text-slate-300">
                  Our customer desk has received your ticket. A support agent will email you at{" "}
                  <strong>{order.userEmail}</strong>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendSupport} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={supportSubject}
                    onChange={(e) => setSupportSubject(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-100 text-sm focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-1.5">
                    How can we help you?
                  </label>
                  <textarea
                    rows={4}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Provide details about shipping, seller questions, payment reconciliation, or cancellation requests..."
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-slate-100 text-sm focus:border-orange-500 focus:outline-none resize-none"
                    required
                  />
                </div>

                {supportError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                    {supportError}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSupportModalOpen(false)}
                    className="w-1/2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingSupport}
                    className="w-1/2 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSendingSupport ? "Sending..." : "Submit Ticket"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailedOrderPage;
