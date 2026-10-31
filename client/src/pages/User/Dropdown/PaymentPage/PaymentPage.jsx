import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchCsrfToken } from "../../../../redux/slices/csrfSecuritySlice";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import gpay from "../../../../assets/images/components/Payment/Gpay.png";
import phonepay from "../../../../assets/images/components/Payment/PhonePe.png";
import debit from "../../../../assets/images/components/Payment/debit.png";
import credit from "../../../../assets/images/components/Payment/credit.png";
import netbank from "../../../../assets/images/components/Payment/net-banking-icon.png";
import Coin from "../../../../assets/images/components/Payment/COIN IMAGE.png";
import { toast } from "react-hot-toast";
import {
  FaWallet,
  FaArrowDown,
  FaArrowUp,
  FaLock,
  FaCheck,
  FaShieldAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaHistory,
  FaClock,
} from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL;
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_API_KEY;

const PaymentPage = () => {
  const [totalBalance, setTotalBalance] = useState(0);
  const [reservedBalance, setReservedBalance] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [inputAmount, setInputAmount] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isWithdrawMode, setIsWithdrawMode] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const dispatch = useDispatch();

  // Get user & CSRF data from Redux
  const user = useSelector((state) => state.auth.user);
  const { token: csrfToken } = useSelector((state) => state.csrf);
  const email = user?.email;
  const name = user?.name;

  const handleAmountChange = (change) => {
    setInputAmount(change.toString());
    setErrorMessage("");
  };

  const handleInputAmountChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^[0-9]*$/.test(value)) {
      setInputAmount(value);
      setErrorMessage("");
    }
  };

  useEffect(() => {
    if (!csrfToken) {
      dispatch(fetchCsrfToken());
    }
  }, [dispatch, csrfToken]);

  const fetchAmount = async () => {
    if (!email) return;
    try {
      const response = await axiosWithAuth.get("/auth/get-amount");
      if (response.data) {
        const total = Number(response.data.totalBalance ?? response.data.amount) || 0;
        const reserved = Number(response.data.reservedBalance) || 0;
        const available = Number(response.data.availableBalance ?? (total - reserved)) || 0;
        setTotalBalance(total);
        setReservedBalance(reserved);
        setAvailableBalance(available);
      }
    } catch (error) {
      console.error("Error fetching amount from the server:", error);
    }
  };

  const fetchRecentTransactions = async () => {
    if (!email) return;
    setIsLoadingTransactions(true);
    try {
      const response = await axiosWithAuth.get(
        `/transactions?userEmail=${encodeURIComponent(email)}&limit=10`
      );
      if (response.data?.transactions) {
        setRecentTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  useEffect(() => {
    fetchAmount();
    fetchRecentTransactions();
  }, [email]);

  // Function to record transaction
  const recordTransaction = async (type, transactionAmount) => {
    try {
      await axiosWithAuth.post("/transactions", {
        userEmail: email,
        name: name,
        type: type,
        amount: transactionAmount,
      });
    } catch (error) {
      console.error("Error recording transaction:", error);
    }
  };

  const handleTransaction = async () => {
    if (!email) {
      setErrorMessage("Please log in to proceed.");
      return;
    }

    if (!isWithdrawMode && !selectedPaymentMethod) {
      setErrorMessage("Please select a payment method.");
      return;
    }

    const amountToProcess = parseInt(inputAmount, 10);
    if (isNaN(amountToProcess) || amountToProcess <= 0) {
      setErrorMessage("Please enter a valid amount.");
      return;
    }

    if (isWithdrawMode) {
      // Enforce invariant: Cannot withdraw funds reserved in active auction bids
      if (amountToProcess > availableBalance) {
        setErrorMessage(
          `Insufficient available balance. You can withdraw up to ₹${availableBalance.toLocaleString()}. ₹${reservedBalance.toLocaleString()} is currently locked in active auction bids.`
        );
        return;
      }

      const newTotal = totalBalance - amountToProcess;

      try {
        const response = await axiosWithAuth.patch("/auth/update-amount", {
          amount: newTotal,
        });

        if (response.data?.data) {
          const d = response.data.data;
          setTotalBalance(d.totalBalance ?? d.amount);
          setReservedBalance(d.reservedBalance ?? 0);
          setAvailableBalance(d.availableBalance ?? (d.totalBalance - (d.reservedBalance ?? 0)));
        } else {
          setTotalBalance(newTotal);
          setAvailableBalance(Math.max(0, newTotal - reservedBalance));
        }

        setInputAmount("");
        setErrorMessage("");
        await recordTransaction("withdrawal", amountToProcess);
        fetchRecentTransactions();
        toast.success("Withdrawal successful");
      } catch (error) {
        console.error("Error updating amount in database:", error);
        setErrorMessage(
          error.response?.data?.error || "Withdrawal failed. Please try again."
        );
      }
    } else {
      // Add money logic — Authoritative Server Flow
      const amountToPay = amountToProcess;

      try {
        const orderRes = await axiosWithAuth.post("/payment/wallet/create-order", {
          amount: amountToPay,
        });

        if (!orderRes.data || !orderRes.data.razorpayOrderId) {
          setErrorMessage("Failed to initiate payment with gateway. Please try again.");
          return;
        }

        const { razorpayOrderId, keyId, amount: amountPaise, paymentId } = orderRes.data;
        const effectiveKey = keyId || RAZORPAY_KEY;

        if (!effectiveKey) {
          setErrorMessage("Payment gateway public key is not configured. Please contact support.");
          return;
        }

        var options = {
          key: effectiveKey,
          amount: amountPaise,
          currency: "INR",
          name: "AuctionX Payment",
          description: "Wallet Add Funds",
          order_id: razorpayOrderId,
          image:
            "https://res.cloudinary.com/dszvpb3q5/image/upload/v1738092417/xohxoosm3tnn0jjvquuv.png",
          handler: async function (response) {
            try {
              const verifyRes = await axiosWithAuth.post("/payment/wallet/verify", {
                paymentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });

              if (verifyRes.data && verifyRes.data.success) {
                fetchAmount();
                fetchRecentTransactions();
                setInputAmount("");
                setErrorMessage("");
                toast.success("Funds added successfully!");
              } else if (verifyRes.data && verifyRes.data.status === "REQUIRES_RECONCILIATION") {
                setErrorMessage(
                  "Payment verified, but wallet balance requires reconciliation. Do NOT pay again. Ref ID: " +
                    paymentId
                );
              } else {
                setErrorMessage("Payment verification failed. Please contact support.");
              }
            } catch (verifyErr) {
              console.error("Verification error:", verifyErr);
              const errData = verifyErr.response?.data;
              if (errData?.code === "WALLET_UPDATE_FAILED" || errData?.details?.recoverable) {
                setErrorMessage(
                  "Payment captured, but wallet update is pending reconciliation. Do NOT pay again. Ref ID: " +
                    paymentId
                );
              } else {
                setErrorMessage(
                  errData?.message ||
                    "Payment verification failed. If your account was debited, it will be automatically reconciled."
                );
              }
            }
          },
          prefill: {
            name: name || "User",
            email: email || "user@example.com",
            contact: "9999999999",
          },
        };

        var rzp1 = new window.Razorpay(options);
        rzp1.open();
      } catch (initErr) {
        console.error("Error initiating payment:", initErr);
        setErrorMessage(
          initErr.response?.data?.message || "Failed to initialize payment. Please try again."
        );
      }
    }
  };

  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    };

    loadScript("https://checkout.razorpay.com/v1/checkout.js");
  }, []);

  const paymentOptions = [
    {
      id: "phonepay",
      name: "PhonePe",
      icon: phonepay,
      description: "Fast and secure UPI payments",
    },
    {
      id: "gpay",
      name: "GPay",
      icon: gpay,
      description: "Instant Google Pay transfers",
    },
    {
      id: "credit",
      name: "Credit Card",
      icon: credit,
      description: "Visa, Mastercard, Rupay",
    },
    {
      id: "debit",
      name: "Debit Card",
      icon: debit,
      description: "Direct debit from bank account",
    },
    {
      id: "netbank",
      name: "Net Banking",
      icon: netbank,
      description: "Connect with 100+ supported banks",
    },
  ];

  const getLedgerBadge = (type) => {
    switch (type) {
      case "BID_RESERVATION":
        return { label: "Bid Escrow Hold", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", sign: "-" };
      case "BID_RESERVATION_INCREASE":
        return { label: "Bid Hold Increase", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", sign: "-" };
      case "BID_RESERVATION_RELEASE":
        return { label: "Hold Released (Outbid)", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", sign: "+" };
      case "AUCTION_WIN_CAPTURE":
        return { label: "Auction Win Capture", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", sign: "-" };
      case "WALLET_TOPUP":
      case "deposit":
        return { label: "Wallet Top-Up", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", sign: "+" };
      case "withdrawal":
        return { label: "Withdrawal", color: "bg-red-500/10 text-red-400 border-red-500/20", sign: "-" };
      default:
        return { label: type || "Transaction", color: "bg-slate-700/30 text-slate-300 border-slate-700", sign: "" };
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-foreground font-sans pt-8 pb-16 transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="pb-6 border-b border-border-subtle">
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
            {isWithdrawMode ? "Withdraw Funds" : "AuctionX Wallet"}
          </h1>
          <p className="text-xs sm:text-sm text-foreground-muted mt-1">
            {isWithdrawMode
              ? "Transfer your available wallet balance to your bank account"
              : "Wallet-backed escrow bidding: Available funds are reserved when placing bids and captured upon winning"}
          </p>
        </div>

        {/* 3-Pill Authoritative Financial Snapshot */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Available Balance */}
          <div className="p-4 rounded-2xl bg-surface border border-action-primary/30 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-action-primary uppercase tracking-wider">
                Available to Bid
              </span>
              <FaWallet className="w-4 h-4 text-action-primary" />
            </div>
            <div className="mt-2 text-2xl font-black font-display text-foreground tracking-tight">
              ₹{availableBalance.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-foreground-muted">
              Usable for new bids and instant withdrawals
            </p>
          </div>

          {/* 2. Reserved Escrow Hold */}
          <div className="p-4 rounded-2xl bg-surface border border-amber-500/30 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                Locked in Escrow
              </span>
              <FaLock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-black font-display text-amber-400 tracking-tight">
              ₹{reservedBalance.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-foreground-muted">
              Held for active bids; released immediately if outbid
            </p>
          </div>

          {/* 3. Total Balance */}
          <div className="p-4 rounded-2xl bg-surface border border-border-default shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground-muted uppercase tracking-wider">
                Total Balance
              </span>
              <FaShieldAlt className="w-4 h-4 text-foreground-muted" />
            </div>
            <div className="mt-2 text-2xl font-black font-display text-foreground tracking-tight">
              ₹{totalBalance.toLocaleString()}
            </div>
            <p className="mt-1 text-[11px] text-foreground-muted">
              Combined Available + Escrow funds
            </p>
          </div>
        </div>

        {/* Mode Segmented Switch (Add Funds vs Withdraw) */}
        <div className="mt-6 flex justify-start">
          <div className="inline-flex p-1 rounded-xl bg-surface-subtle border border-border-subtle">
            <button
              type="button"
              onClick={() => {
                setIsWithdrawMode(false);
                setSelectedPaymentMethod(null);
                setErrorMessage("");
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                !isWithdrawMode
                  ? "bg-action-primary text-white shadow-xs"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface/50"
              }`}
            >
              <FaArrowDown className="text-xs" />
              <span>Add Funds</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsWithdrawMode(true);
                setSelectedPaymentMethod(null);
                setErrorMessage("");
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isWithdrawMode
                  ? "bg-action-primary text-white shadow-xs"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface/50"
              }`}
            >
              <FaArrowUp className="text-xs" />
              <span>Withdraw Money</span>
            </button>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="mt-6 relative rounded-2xl bg-surface border border-border-default p-6 sm:p-10 shadow-sm overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-action-primary/5 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 right-0 w-64 h-64 opacity-5 dark:opacity-[0.03] bg-contain bg-no-repeat bg-right-bottom"
            style={{ backgroundImage: `url(${Coin})` }}
          />

          <div className="relative z-10 max-w-lg mx-auto text-center">
            <h2 className="text-lg sm:text-xl font-bold font-display text-foreground">
              {isWithdrawMode ? "Enter Amount to Withdraw" : "Enter Amount to Add"}
            </h2>
            <p className="text-xs sm:text-sm text-foreground-muted mt-1">
              {isWithdrawMode
                ? `Max available to withdraw: ₹${availableBalance.toLocaleString()}`
                : "Funds will be credited immediately to your available balance"}
            </p>

            {/* Amount Input */}
            <div className="mt-6 relative flex items-center justify-center">
              <div className="relative flex items-center w-full max-w-xs sm:max-w-sm rounded-xl border border-border-default bg-surface-subtle focus-within:border-action-primary focus-within:ring-2 focus-within:ring-ring-focus transition-all">
                <span className="pl-4 pr-2 text-lg sm:text-xl font-bold text-foreground-muted select-none">
                  ₹
                </span>
                <input
                  type="text"
                  value={inputAmount}
                  onChange={handleInputAmountChange}
                  placeholder={isWithdrawMode ? "0" : "500"}
                  className="w-full py-3.5 pr-4 bg-transparent text-xl sm:text-2xl font-bold font-display text-foreground placeholder:text-foreground-muted/50 focus:outline-none"
                />
                {inputAmount && (
                  <button
                    type="button"
                    onClick={() => setInputAmount("")}
                    className="pr-3 text-xs text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick Amount Suggestion Chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[500, 1000, 1500, 2500, 5000].map((quickVal) => (
                <button
                  key={quickVal}
                  type="button"
                  onClick={() => handleAmountChange(quickVal)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    inputAmount === quickVal.toString()
                      ? "bg-action-primary/10 border-action-primary text-action-primary shadow-xs"
                      : "bg-surface border-border-subtle text-foreground-secondary hover:text-foreground hover:bg-surface-subtle hover:border-border-default"
                  }`}
                >
                  +₹{quickVal.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="mt-6 p-3.5 rounded-xl border border-action-destructive/40 bg-status-error-bg/40 text-action-destructive text-xs sm:text-sm font-medium flex items-center justify-center gap-2 animate-in fade-in"
              >
                <FaExclamationCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Payment Method Selection (Add Funds mode only) */}
          {!isWithdrawMode && (
            <div className="mt-10 pt-8 border-t border-border-subtle relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted flex items-center gap-2">
                  <FaLock className="w-3.5 h-3.5 text-action-primary" />
                  <span>Select Payment Method</span>
                </h3>
                <span className="text-[11px] text-foreground-muted">256-Bit SSL Encrypted</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {paymentOptions.map((option) => {
                  const isSelected = selectedPaymentMethod === option.id;
                  return (
                    <div
                      key={option.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedPaymentMethod(option.id);
                        setErrorMessage("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedPaymentMethod(option.id);
                          setErrorMessage("");
                        }
                      }}
                      className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none flex items-center gap-3.5 ${
                        isSelected
                          ? "bg-action-primary/5 border-action-primary ring-2 ring-ring-focus shadow-xs"
                          : "bg-surface-subtle/50 hover:bg-surface-subtle border-border-subtle hover:border-border-default"
                      }`}
                    >
                      <div className="w-11 h-11 rounded-lg bg-surface border border-border-subtle p-2 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={option.icon}
                          alt={option.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {option.name}
                        </p>
                        <p className="text-[11px] text-foreground-muted truncate">
                          {option.description}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "border-action-primary bg-action-primary text-white"
                            : "border-border-default"
                        }`}
                      >
                        {isSelected && <FaCheck className="text-[9px]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Button Section */}
          <div className="mt-8 pt-6 border-t border-border-subtle text-center relative z-10">
            <button
              type="button"
              disabled={
                inputAmount === "" ||
                parseInt(inputAmount, 10) <= 0 ||
                (!isWithdrawMode && !selectedPaymentMethod)
              }
              onClick={handleTransaction}
              className={`w-full sm:w-auto min-w-[240px] px-8 py-3.5 rounded-xl text-sm sm:text-base font-semibold tracking-wide transition-all duration-200 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus ${
                inputAmount === "" ||
                parseInt(inputAmount, 10) <= 0 ||
                (!isWithdrawMode && !selectedPaymentMethod)
                  ? "bg-surface-subtle border border-border-subtle text-foreground-muted cursor-not-allowed opacity-60"
                  : "bg-action-primary hover:bg-action-primary-hover text-white active:scale-95 cursor-pointer shadow-md hover:shadow-lg"
              }`}
            >
              {isWithdrawMode ? "Withdraw Money" : "Proceed to Payment"}
            </button>

            {/* Security Badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground-muted">
              <span className="flex items-center gap-1.5">
                <FaShieldAlt className="text-action-primary text-xs" />
                <span>RBI Authorized</span>
              </span>
              <span className="flex items-center gap-1.5">
                <FaLock className="text-action-primary text-xs" />
                <span>End-to-End SSL</span>
              </span>
              <span className="flex items-center gap-1.5">
                <FaCheckCircle className="text-status-success text-xs" />
                <span>Instant Settlement</span>
              </span>
            </div>
          </div>
        </div>

        {/* Recent Wallet & Escrow Ledger */}
        <div className="mt-10 rounded-2xl bg-surface border border-border-default p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
            <h3 className="text-base font-bold font-display text-foreground flex items-center gap-2">
              <FaHistory className="w-4 h-4 text-action-primary" />
              <span>Recent Wallet & Escrow Ledger</span>
            </h3>
            <button
              onClick={() => {
                fetchAmount();
                fetchRecentTransactions();
              }}
              className="text-xs text-action-primary hover:underline font-semibold cursor-pointer"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {isLoadingTransactions ? (
              <div className="py-8 text-center text-xs text-foreground-muted">
                Loading transaction records...
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-foreground-muted">
                No wallet transactions recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-foreground-muted uppercase tracking-wider border-b border-border-subtle">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {recentTransactions.map((tx) => {
                    const badge = getLedgerBadge(tx.type);
                    const isPositive = badge.sign === "+";
                    return (
                      <tr key={tx._id} className="hover:bg-surface-subtle/50 transition-colors">
                        <td className="py-3 px-3 text-foreground-muted whitespace-nowrap">
                          {tx.date ? new Date(tx.date).toLocaleDateString() : "Recent"}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-foreground-secondary max-w-xs truncate">
                          {tx.reference || tx.type}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold font-display whitespace-nowrap ${
                            isPositive ? "text-emerald-400" : "text-foreground"
                          }`}
                        >
                          {badge.sign}₹{(tx.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
