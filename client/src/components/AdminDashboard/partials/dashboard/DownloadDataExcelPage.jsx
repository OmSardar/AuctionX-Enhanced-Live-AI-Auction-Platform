import React, { useState } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { toast } from "react-hot-toast";
import { Download, FileSpreadsheet, CheckCircle2, ShieldAlert, Users, Package, ShoppingCart, DollarSign, MessageSquare } from "lucide-react";

const DATASETS = [
  {
    id: "users",
    name: "User & Seller Accounts",
    description: "Export registered accounts with roles, verification state, store names, and activity timestamps.",
    endpoint: "/admin/users",
    icon: Users,
    dataKey: "users",
  },
  {
    id: "listings",
    name: "Auction Listings",
    description: "Export all products with starting prices, reserve prices, categories, and moderation status.",
    endpoint: "/admin/listings",
    icon: Package,
    dataKey: "listings",
  },
  {
    id: "orders",
    name: "Orders & Settlements",
    description: "Export orders with buyer/seller emails, final settlement amounts, and fulfillment states.",
    endpoint: "/admin/orders",
    icon: ShoppingCart,
    dataKey: "orders",
  },
  {
    id: "transactions",
    name: "Financial Transactions",
    description: "Export wallet deposits, withdrawals, payment IDs, transaction status, and timestamps.",
    endpoint: "/transactions",
    icon: DollarSign,
    dataKey: "transactions",
  },
  {
    id: "audit_logs",
    name: "Administrative Audit Trail",
    description: "Export administrative action logs with acting administrator, target, state transitions, and reasons.",
    endpoint: "/admin/users/audit-logs",
    icon: ShieldAlert,
    dataKey: "auditLogs",
  },
  {
    id: "feedback",
    name: "Customer Feedback Submissions",
    description: "Export customer feedback submissions, ratings, and user comments.",
    endpoint: "/feedback/user",
    icon: MessageSquare,
    dataKey: null, // returns array directly
  },
];

export default function DownloadDataExcelPage() {
  const [selectedDataset, setSelectedDataset] = useState("users");
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const convertToCSV = (objArray) => {
    if (!Array.isArray(objArray) || objArray.length === 0) return "";
    
    // Extract headers (flatten primitive keys)
    const sample = objArray[0];
    const headers = Object.keys(sample).filter(
      (k) => typeof sample[k] !== "object" || sample[k] === null
    );

    const csvRows = [headers.join(",")];

    for (const row of objArray) {
      const values = headers.map((header) => {
        const val = row[header];
        if (val === null || val === undefined) return '""';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      });
      csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
  };

  const handleExport = async () => {
    const datasetInfo = DATASETS.find((d) => d.id === selectedDataset);
    if (!datasetInfo) return;

    setIsExporting(true);
    try {
      const response = await axiosWithAuth.get(datasetInfo.endpoint, {
        params: { limit: 500 },
      });

      let rawData = [];
      if (datasetInfo.dataKey && response.data?.[datasetInfo.dataKey]) {
        rawData = response.data[datasetInfo.dataKey];
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        rawData = response.data.data;
      } else if (Array.isArray(response.data)) {
        rawData = response.data;
      }

      if (rawData.length === 0) {
        toast.error(`No records found to export for ${datasetInfo.name}`);
        setIsExporting(false);
        return;
      }

      const csvContent = convertToCSV(rawData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.setAttribute("href", url);
      link.setAttribute("download", `AuctionX_${datasetInfo.id}_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setLastExport({
        name: datasetInfo.name,
        rows: rawData.length,
        time: new Date().toLocaleTimeString(),
      });
      toast.success(`Exported ${rawData.length} records successfully!`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error(err.response?.data?.message || "Failed to export data from server");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-100 dark:border-gray-700/60 p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="pb-5 border-b border-gray-100 dark:border-gray-700/60 mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
          <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          Administrative Data Export Console
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Export authoritative database tables directly into standard CSV/Excel format for compliance, offline analysis, and record-keeping.
        </p>
      </div>

      {/* Dataset Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mb-8">
        {DATASETS.map((ds) => {
          const isSelected = selectedDataset === ds.id;
          const IconComponent = ds.icon;
          return (
            <div
              key={ds.id}
              onClick={() => setSelectedDataset(ds.id)}
              className={`p-4 rounded-xl border transition cursor-pointer select-none flex flex-col justify-between ${
                isSelected
                  ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs ring-1 ring-amber-500/30"
                  : "border-gray-200 dark:border-gray-700/60 bg-gray-50/40 dark:bg-gray-800/40 hover:bg-gray-100/50 dark:hover:bg-gray-700/30"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : "bg-gray-200/60 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 mb-1">
                  {ds.name}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {ds.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Box */}
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            Selected Dataset:{" "}
            <span className="text-amber-700 dark:text-amber-400">
              {DATASETS.find((d) => d.id === selectedDataset)?.name}
            </span>
          </h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Exports live MongoDB records into structured CSV with UTF-8 character encoding.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-medium text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${isExporting ? "animate-bounce" : ""}`} />
          <span>{isExporting ? "Extracting Data..." : "Export to CSV"}</span>
        </button>
      </div>

      {/* Last Export Notice */}
      {lastExport && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <span>
            Last export: <strong className="font-semibold">{lastExport.name}</strong> ({lastExport.rows} records downloaded at {lastExport.time}).
          </span>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">✓ Ready</span>
        </div>
      )}
    </div>
  );
}