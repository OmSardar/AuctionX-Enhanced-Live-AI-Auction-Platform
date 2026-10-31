import React, { useState } from "react";
import { jsPDF } from "jspdf";

const DownloadInvoice = ({ id, order }) => {
  const [generating, setGenerating] = useState(false);

  const generatePDFInvoice = (orderData) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const invoiceNo = `AX-INV-${orderData._id.slice(-8).toUpperCase()}`;
    const invoiceDate = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const orderDate = new Date(orderData.createdAt || Date.now()).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const winningPrice = orderData.finalPrice ?? orderData.highestBid ?? 0;
    const startPrice = orderData.biddingStartPrice ?? 0;

    // Header Background Accent
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 40, "F");

    // AuctionX Brand
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(200, 98, 42); // AuctionX orange #C8622A
    doc.text("AuctionX", 18, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Premium Digital Auction Marketplace", 18, 25);
    doc.text("Tax Invoice & Auction Settlement Record", 18, 30);

    // Invoice Meta Right Aligned
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("INVOICE", 192, 18, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`Invoice No: ${invoiceNo}`, 192, 24, { align: "right" });
    doc.text(`Invoice Date: ${invoiceDate}`, 192, 29, { align: "right" });
    doc.text(`Status: ${orderData.status || "CONFIRMED"}`, 192, 34, { align: "right" });

    // Buyer & Seller Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Billed To (Winner):", 18, 52);
    doc.text("Sold By (Seller):", 115, 52);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    // Buyer Info
    const buyerName = orderData.name || "Valued Bidder";
    const buyerAddress = orderData.address || "Address on file";
    const buyerPhone = orderData.phoneNo || "N/A";
    const buyerEmail = orderData.userEmail || "N/A";

    doc.text(buyerName, 18, 58);
    const splitAddress = doc.splitTextToSize(buyerAddress, 85);
    doc.text(splitAddress, 18, 64);
    const addressOffset = 64 + splitAddress.length * 5;
    doc.text(`Phone: ${buyerPhone}`, 18, addressOffset);
    doc.text(`Email: ${buyerEmail}`, 18, addressOffset + 5);

    // Seller Info
    const sellerContact = orderData.sellerEmail || "support@auctionx.internal";
    doc.text("Verified AuctionX Merchant", 115, 58);
    doc.text(`Contact: ${sellerContact}`, 115, 64);
    doc.text(`Order Date: ${orderDate}`, 115, 70);
    doc.text(`Order Reference: #${orderData._id}`, 115, 76);

    // Divider Line
    const tableTop = Math.max(addressOffset + 14, 88);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(18, tableTop - 3, 192, tableTop - 3);

    // Table Header
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(18, tableTop, 174, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text("ITEM DESCRIPTION & LOT DETAILS", 22, tableTop + 6);
    doc.text("START RESERVE", 125, tableTop + 6, { align: "right" });
    doc.text("WINNING BID", 188, tableTop + 6, { align: "right" });

    // Table Row
    const rowTop = tableTop + 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(orderData.title || "Auction Lot Item", 95);
    doc.text(titleLines, 22, rowTop);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const detailY = rowTop + titleLines.length * 5;
    doc.text(`Lot Reference: ${orderData.productId || orderData._id}`, 22, detailY);
    doc.text(`Condition: Verified Original | Settlement: Closed`, 22, detailY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Rs. ${Number(startPrice).toLocaleString("en-IN")}`, 125, rowTop, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 98, 42);
    doc.text(`Rs. ${Number(winningPrice).toLocaleString("en-IN")}`, 188, rowTop, { align: "right" });

    // Divider
    const summaryTop = detailY + 14;
    doc.setDrawColor(226, 232, 240);
    doc.line(18, summaryTop, 192, summaryTop);

    // Financial Breakdown Section
    const colLabelX = 135;
    const colValueX = 188;
    let currY = summaryTop + 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);

    doc.text("Reserve Start Bid:", colLabelX, currY);
    doc.text(`Rs. ${Number(startPrice).toLocaleString("en-IN")}`, colValueX, currY, { align: "right" });

    currY += 6;
    doc.text("Winning Final Bid:", colLabelX, currY);
    doc.text(`Rs. ${Number(winningPrice).toLocaleString("en-IN")}`, colValueX, currY, { align: "right" });

    currY += 6;
    doc.text("Shipping & Delivery:", colLabelX, currY);
    doc.text("Rs. 0.00 (Free)", colValueX, currY, { align: "right" });

    currY += 6;
    doc.text("Taxes (GST 18%):", colLabelX, currY);
    doc.text("Included", colValueX, currY, { align: "right" });

    // Total Highlight Box
    currY += 5;
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(colLabelX - 5, currY, 62, 12, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("TOTAL DUE:", colLabelX, currY + 8);
    doc.setTextColor(251, 146, 60); // light orange
    doc.text(`INR ${Number(winningPrice).toLocaleString("en-IN")}`, colValueX, currY + 8, { align: "right" });

    // Payment Audit Box
    const auditTop = currY + 22;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(18, auditTop, 174, 24, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("PAYMENT AUDIT INFORMATION", 24, auditTop + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Payment Status: ${orderData.status === "PAID" ? "VERIFIED & CONFIRMED" : "AWAITING PAYMENT"}`,
      24,
      auditTop + 13
    );
    doc.text(
      `Transaction Gateway: Razorpay Smart Routing | Txn ID: ${orderData.razorpayPaymentId || "N/A (Pending)"}`,
      24,
      auditTop + 18
    );

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "This is an electronically generated invoice valid without physical signature.",
      105,
      275,
      { align: "center" }
    );
    doc.text(
      `AuctionX Marketplace | Support: support@auctionx.internal | Generated ${new Date().toLocaleString("en-IN")}`,
      105,
      280,
      { align: "center" }
    );

    doc.save(`Invoice-AX-${orderData._id.slice(-8).toUpperCase()}.pdf`);
  };

  const handleDownload = async () => {
    if (!order) return;
    setGenerating(true);
    try {
      generatePDFInvoice(order);
    } catch (err) {
      console.error("PDF generation error, falling back to printable view:", err);
      // Fallback printable window
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(`
          <html>
            <head>
              <title>Invoice - ${order._id}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; }
                .header { border-bottom: 2px solid #C8622A; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
                .brand { font-size: 28px; font-weight: 800; color: #C8622A; }
                .meta { text-align: right; font-size: 14px; color: #64748b; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
                .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                .total { font-size: 20px; font-weight: bold; color: #C8622A; }
              </style>
            </head>
            <body>
              <div class="header">
                <div>
                  <div class="brand">AuctionX</div>
                  <div>Premium Digital Auction Marketplace</div>
                </div>
                <div class="meta">
                  <h3>TAX INVOICE</h3>
                  <div>Ref: AX-INV-${order._id.slice(-8).toUpperCase()}</div>
                  <div>Date: ${new Date().toLocaleDateString("en-IN")}</div>
                </div>
              </div>
              <div class="card">
                <h3>Auction Settlement Details</h3>
                <div class="row"><span>Item</span><strong>${order.title}</strong></div>
                <div class="row"><span>Buyer</span><span>${order.name} (${order.userEmail})</span></div>
                <div class="row"><span>Address</span><span>${order.address}</span></div>
                <div class="row"><span>Reserve Start Price</span><span>₹${order.biddingStartPrice}</span></div>
                <div class="row"><span>Winning Accepted Bid</span><span>₹${order.highestBid || order.finalPrice}</span></div>
                <div class="row total"><span>Total Payable</span><span>₹${order.finalPrice || order.highestBid}</span></div>
              </div>
              <p style="text-align:center; color: #94a3b8; font-size: 12px; margin-top: 40px;">
                Computer generated invoice by AuctionX. All amounts in Indian Rupees (INR).
              </p>
              <script>window.print();</script>
            </body>
          </html>
        `);
        printWin.document.close();
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={!order || generating}
      className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
      title="Download Official Tax Invoice PDF"
    >
      {generating ? (
        <>
          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Generating PDF...</span>
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5 transition-transform duration-200 group-hover:translate-y-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Download Invoice (PDF)</span>
        </>
      )}
    </button>
  );
};

export default DownloadInvoice;
