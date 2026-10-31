import React from "react";

const ProgressBar = ({
  currentStep: propStep,
  totalSteps: propTotalSteps = 4,
  steps: propSteps,
  status = "PAID",
  orderDate,
  paidAt,
}) => {
  const isCancelled = status === "CANCELLED" || status === "EXPIRED";
  const isRefunded = status === "REFUNDED";
  const isPending = status === "PENDING";

  const defaultPaidSteps = [
    "Payment Confirmed",
    "Processing & Packed",
    "Shipped & In Transit",
    "Delivered",
  ];

  const defaultPendingSteps = [
    "Awaiting Payment",
    "Order Processing",
    "Shipped & In Transit",
    "Delivered",
  ];

  const stepLabels =
    propSteps && propSteps.length > 0
      ? propSteps
      : isPending
      ? defaultPendingSteps
      : defaultPaidSteps;

  const totalSteps = propTotalSteps || stepLabels.length;
  // If pending, step 1 is active. If paid, step 1 is done, step is at least 2.
  const activeStep = propStep !== undefined && propStep > 0
    ? propStep
    : isPending
    ? 1
    : 2;

  // Render dedicated card for terminal cancelled/expired status
  if (isCancelled) {
    return (
      <div className="w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-2xl shrink-0">
            ⚠️
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              {status === "EXPIRED" ? "Order Expired" : "Order Cancelled"}
            </h3>
            <p className="text-sm text-slate-400">
              {status === "EXPIRED"
                ? "The 24-hour settlement window for this won auction expired before payment was completed."
                : "This order has been cancelled. If payment was deducted, a refund will be initiated automatically."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render dedicated card for refunded status
  if (isRefunded) {
    return (
      <div className="w-full bg-slate-900/90 border border-purple-500/30 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-2xl shrink-0">
            ↩️
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              Payment Refunded
            </h3>
            <p className="text-sm text-slate-400">
              The full settlement amount has been returned to your original payment source or wallet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal progression width
  const progressWidth =
    totalSteps > 1
      ? Math.max(0, Math.min(100, ((activeStep - 1) / (totalSteps - 1)) * 100))
      : 0;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-700/60 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md mb-8">
      {/* Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPending
                ? "bg-amber-400 animate-pulse"
                : "bg-emerald-400"
            }`}
          />
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-300">
            {isPending ? "Awaiting Settlement" : "Fulfillment in Progress"}
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Step {activeStep} of {totalSteps}
        </span>
      </div>

      <div className="w-full relative px-2 sm:px-6">
        {/* Track Line */}
        <div className="absolute top-5 sm:top-6 left-6 right-6 h-1 sm:h-1.5 bg-slate-800 rounded-full z-0 -translate-y-1/2">
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Steps */}
        <div className="w-full flex justify-between relative z-10">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const isCompleted = activeStep > stepNumber;
            const isCurrent = activeStep === stepNumber;

            return (
              <div
                key={index}
                className="flex flex-col items-center text-center max-w-[90px] sm:max-w-[140px]"
              >
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-500 text-slate-950 shadow-[0_0_14px_rgba(16,185,129,0.4)] border-2 border-emerald-400"
                      : isCurrent
                      ? "bg-slate-950 text-orange-400 border-2 border-orange-500 ring-4 ring-orange-500/20 shadow-[0_0_16px_rgba(200,98,42,0.4)]"
                      : "bg-slate-800 text-slate-500 border-2 border-slate-700"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5 text-slate-950"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>

                <span
                  className={`mt-3 text-xs sm:text-sm font-medium transition-colors leading-tight ${
                    isCompleted
                      ? "text-slate-200"
                      : isCurrent
                      ? "text-orange-400 font-bold"
                      : "text-slate-500"
                  }`}
                >
                  {label}
                </span>

                {index === 0 && (orderDate || paidAt) && (
                  <span className="mt-1 text-[10px] text-slate-400 hidden sm:block">
                    {paidAt
                      ? new Date(paidAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : orderDate
                      ? new Date(orderDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : null}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
