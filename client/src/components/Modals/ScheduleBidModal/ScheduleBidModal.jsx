import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { FaClock, FaRupeeSign, FaTimes, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import toast from "react-hot-toast";
import soundManager from "../../../utils/soundManager";

const API_URL = import.meta.env.VITE_API_URL;

const ScheduleBidModal = ({
  isOpen,
  onClose,
  product,
  currentPrice,
  minIncrement = 50,
  isUpcoming = false,
  isAuctionActive = true,
  isEnded = false,
  userEmail = null,
  onSuccess = () => {},
}) => {
  const modalRef = useRef(null);
  const firstInputRef = useRef(null);

  const startPrice =
    product?.startingPrice !== undefined
      ? product.startingPrice
      : product?.biddingStartPrice || 0;
  const effectivePrice = currentPrice !== undefined ? currentPrice : startPrice;
  const minimumAllowed = product?.bidCount > 0 ? effectivePrice + minIncrement : startPrice;

  const [amount, setAmount] = useState(minimumAllowed);
  const [timingOption, setTimingOption] = useState(isUpcoming ? "START_TIME" : "CUSTOM");
  const [customTime, setCustomTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Sync minimum allowed when price changes
  useEffect(() => {
    setAmount(minimumAllowed);
  }, [minimumAllowed]);

  // Set default custom time to 15 minutes before auction end or 1 hour from now
  useEffect(() => {
    if (product?.endTime) {
      const end = new Date(product.endTime);
      const suggested = new Date(Math.max(Date.now() + 60000, end.getTime() - 15 * 60 * 1000));
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const localIso = new Date(suggested.getTime() - suggested.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCustomTime(localIso);
    }
  }, [product]);

  // Handle Escape key & focus management
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOwner =
    userEmail &&
    product?.email &&
    userEmail.toLowerCase() === product.email.toLowerCase();

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!userEmail) {
      setError("Please log in to schedule a bid");
      return;
    }

    if (isOwner) {
      setError("You cannot schedule a bid on your own auction listing");
      return;
    }

    if (isEnded) {
      setError("Cannot schedule bids for an auction that has already ended");
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < minimumAllowed) {
      setError(`Bid amount must be at least ₹${minimumAllowed}`);
      return;
    }

    let targetTime = null;
    if (timingOption === "CUSTOM") {
      if (!customTime) {
        setError("Please choose a valid execution date and time");
        return;
      }
      targetTime = new Date(customTime).toISOString();
      const parsedTarget = new Date(targetTime);

      if (parsedTarget.getTime() <= Date.now()) {
        setError("Execution time must be in the future");
        return;
      }

      if (product?.endTime && parsedTarget.getTime() >= new Date(product.endTime).getTime()) {
        setError("Scheduled execution time must be before the auction end time");
        return;
      }
    } else if (timingOption === "START_TIME") {
      targetTime = product?.startTime
        ? new Date(product.startTime).toISOString()
        : new Date().toISOString();
    }

    try {
      setSubmitting(true);
      const idempotencyKey = `sched_${product._id}_${Date.now()}`;

      const response = await axios.post(
        `${API_URL}/api/scheduled-bids`,
        {
          productId: product._id,
          amount: numAmount,
          targetTime,
          idempotencyKey,
        },
        { withCredentials: true }
      );

      if (response.data?.success) {
        setSuccess(true);
        soundManager.playSuccess();
        toast.success("Bid scheduled successfully!");
        onSuccess(response.data.scheduledBid);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        soundManager.playError();
        setError(response.data?.message || "Failed to schedule bid");
      }
    } catch (err) {
      soundManager.playError();
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "An error occurred while scheduling your bid.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }

  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-bid-title"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-surface border border-border-subtle rounded-2xl shadow-modal p-6 text-foreground overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-action-primary/10 text-action-primary">
              <FaClock className="text-lg" />
            </div>
            <div>
              <h3 id="schedule-bid-title" className="text-lg font-bold text-foreground">
                Schedule a Bid
              </h3>
              <p className="text-xs text-foreground-muted truncate max-w-xs">
                {product?.name || "Auction Item"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            aria-label="Close dialog"
            className="btn-canonical btn-canonical-icon-sm btn-canonical-ghost text-foreground-muted hover:text-foreground"
          >
            <FaTimes />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="py-8 text-center space-y-3">
            <FaCheckCircle className="text-4xl text-status-success mx-auto" />
            <h4 className="text-xl font-bold text-foreground">Bid Scheduled!</h4>
            <p className="text-sm text-foreground-muted">
              Your bid of ₹{Number(amount).toLocaleString()} will execute automatically according to server rules.
            </p>
          </div>
        ) : (
          <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4">
            {/* Status explanation */}
            <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle text-xs text-foreground-secondary leading-relaxed">
              {isUpcoming ? (
                <p>
                  <span className="font-semibold text-action-primary">Upcoming Auction:</span> This auction has not started yet. You can schedule your opening bid now, and it will execute automatically when the lot opens.
                </p>
              ) : isAuctionActive ? (
                <p>
                  <span className="font-semibold text-action-primary">Active Auction:</span> You can configure an automated bid to be placed at a specific target time before the auction closes.
                </p>
              ) : (
                <p className="text-status-danger">
                  This auction is not active. Scheduled bidding is unavailable.
                </p>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs flex items-start gap-2">
                <FaExclamationTriangle className="shrink-0 mt-0.5 text-sm" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount input */}
            <div>
              <label htmlFor="schedule-amount" className="block text-xs font-semibold text-foreground mb-1.5">
                Intended Bid Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted font-numeric">
                  ₹
                </span>
                <input
                  id="schedule-amount"
                  ref={firstInputRef}
                  type="number"
                  step="1"
                  min={minimumAllowed}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={submitting || isEnded || isOwner}
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-surface border border-border-default text-foreground font-numeric text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  placeholder={`Min: ₹${minimumAllowed}`}
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-foreground-muted">
                Minimum required: <span className="font-numeric font-semibold text-action-primary">₹{minimumAllowed.toLocaleString()}</span> (Current: ₹{effectivePrice.toLocaleString()})
              </p>
            </div>

            {/* Timing options */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Execution Time
              </label>
              <div className="space-y-2">
                {isUpcoming && (
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border-subtle bg-surface-subtle cursor-pointer hover:bg-surface-raised transition-colors">
                    <input
                      type="radio"
                      name="timing"
                      value="START_TIME"
                      checked={timingOption === "START_TIME"}
                      onChange={() => setTimingOption("START_TIME")}
                      className="text-action-primary focus:ring-action-primary"
                    />
                    <span className="text-xs font-medium text-foreground">
                      Execute at Auction Start Time
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border-subtle bg-surface-subtle cursor-pointer hover:bg-surface-raised transition-colors">
                  <input
                    type="radio"
                    name="timing"
                    value="CUSTOM"
                    checked={timingOption === "CUSTOM"}
                    onChange={() => setTimingOption("CUSTOM")}
                    className="text-action-primary focus:ring-action-primary"
                  />
                  <span className="text-xs font-medium text-foreground">
                    Custom Scheduled Timestamp
                  </span>
                </label>

                {timingOption === "CUSTOM" && (
                  <div className="pt-2">
                    <input
                      type="datetime-local"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      disabled={submitting || isEnded || isOwner}
                      className="w-full px-3 py-2 rounded-xl bg-surface border border-border-default text-foreground text-xs font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      required
                    />
                    <p className="mt-1 text-[11px] text-foreground-muted">
                      Time must be before auction concludes.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Invariant Note */}
            <p className="text-[11px] text-foreground-muted italic leading-normal">
              * Note: A scheduled bid executes on the server at the scheduled time. It will be validated against active market rules and does not guarantee a winning outcome.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  onClose();
                }}
                disabled={submitting}
                className="btn-canonical btn-canonical-md btn-canonical-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={() => soundManager.playClick()}
                disabled={submitting || isEnded || isOwner}
                className={`btn-canonical btn-canonical-md btn-canonical-primary ${
                  submitting ? "opacity-70 cursor-wait" : ""
                }`}
              >
                {submitting ? "Scheduling..." : "Confirm Schedule"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ScheduleBidModal;
