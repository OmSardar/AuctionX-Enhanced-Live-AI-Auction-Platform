import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { formatCurrency } from "../../../../lib/utils";
import { toast } from "react-hot-toast";

function SellerPage() {
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sellers, setSellers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusCounts, setStatusCounts] = useState({});
  const sellersPerPage = 5;

  // Fetch sellers from the backend
  useEffect(() => {
    const fetchSellers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosWithAuth.get("/sellers", {
          params: {
            page: currentPage,
            status: statusFilter !== "all" ? statusFilter : undefined,
            search: searchTerm || undefined,
          },
        });

        if (response.data && response.data.success) {
          setSellers(response.data.sellers);
          setTotalPages(response.data.totalPages || 1);
          setStatusCounts(response.data.statusCounts || {});
        } else {
          setError("Failed to fetch sellers data");
          setSellers([]);
        }
      } catch (err) {
        console.error("Error fetching sellers:", err);
        setError(err.response?.data?.message || "Network error occurred");
        setSellers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSellers();
  }, [currentPage, statusFilter, searchTerm]);

  // Function to handle "View" button click
  const handleViewDetails = (sellerId) => {
    const fetchSellerDetails = async () => {
      try {
        const response = await axiosWithAuth.get(`/sellers/${sellerId}`);
        if (response.data && response.data.success) {
          setSelectedSeller({
            ...response.data.seller,
            recentOrders: response.data.recentOrders || [],
            salesStats: response.data.salesStats || {},
          });
        } else {
          toast.error("Failed to fetch seller details");
        }
      } catch (err) {
        console.error("Error fetching seller details:", err);
        toast.error(err.response?.data?.message || "Failed to fetch seller details");
      }
    };

    fetchSellerDetails();
  };

  // Function to close the modal
  const handleCloseModal = () => {
    setSelectedSeller(null);
  };

  // Function to change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Function to update seller status
  const handleUpdateStatus = async (sellerId, newStatus) => {
    try {
      const response = await axiosWithAuth.patch(`/sellers/${sellerId}/status`, {
        status: newStatus,
      });

      if (response.data && response.data.success) {
        setSellers(
          sellers.map((seller) =>
            seller._id === sellerId ? { ...seller, status: newStatus } : seller
          )
        );

        if (selectedSeller && selectedSeller._id === sellerId) {
          setSelectedSeller({ ...selectedSeller, status: newStatus });
        }

        toast.success(`Seller status updated to ${newStatus}`);
        fetchStatusCounts();
      }
    } catch (err) {
      console.error("Error updating seller status:", err);
      toast.error(err.response?.data?.message || "Failed to update seller status");
    }
  };

  // Function to verify seller
  const handleVerifySeller = async (sellerId) => {
    try {
      const response = await axiosWithAuth.patch(`/sellers/${sellerId}/verify`);

      if (response.data && response.data.success) {
        setSellers(
          sellers.map((seller) =>
            seller._id === sellerId
              ? { ...seller, isVerified: true, status: "active" }
              : seller
          )
        );

        if (selectedSeller && selectedSeller._id === sellerId) {
          setSelectedSeller({
            ...selectedSeller,
            isVerified: true,
            status: "active",
          });
        }

        toast.success("Seller successfully verified");
        fetchStatusCounts();
      }
    } catch (err) {
      console.error("Error verifying seller:", err);
      toast.error(err.response?.data?.message || "Failed to verify seller");
    }
  };

  // Fetch status counts
  const fetchStatusCounts = async () => {
    try {
      const response = await axiosWithAuth.get("/sellers/stats");
      if (response.data && response.data.success) {
        setStatusCounts(response.data.statusCounts || {});
      }
    } catch (err) {
      console.error("Error fetching status counts:", err);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle search form submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  // Format date
  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "long", day: "numeric" };
    return new Date(dateString).toLocaleDateString("en-US", options);
  };

  // Inline styles for ellipsis
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "130px",
  };

  // Status badge style
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pending_approval":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "suspended":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  // Status display text
  const getStatusDisplayText = (status) => {
    switch (status) {
      case "active":
        return "Active";
      case "pending_approval":
        return "Pending Approval";
      case "suspended":
        return "Suspended";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Verification badge
  const getVerificationBadge = (isVerified) => {
    return isVerified ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <svg
          className="w-3 h-3 mr-1"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          ></path>
        </svg>
        Verified
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        Unverified
      </span>
    );
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Seller Management
        </h2>
      </header>

      {/* Filters and Search */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-xs rounded-md ${
                statusFilter === "all"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              All (
              {(statusCounts.active || 0) +
                (statusCounts.pending_approval || 0) +
                (statusCounts.suspended || 0) || 0}
              )
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1 text-xs rounded-md ${
                statusFilter === "active"
                  ? "bg-green-500 text-white"
                  : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800"
              }`}
            >
              Active ({statusCounts.active || 0})
            </button>
            <button
              onClick={() => setStatusFilter("pending_approval")}
              className={`px-3 py-1 text-xs rounded-md ${
                statusFilter === "pending_approval"
                  ? "bg-yellow-500 text-white"
                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-800"
              }`}
            >
              Pending ({statusCounts.pending_approval || 0})
            </button>
            <button
              onClick={() => setStatusFilter("suspended")}
              className={`px-3 py-1 text-xs rounded-md ${
                statusFilter === "suspended"
                  ? "bg-red-500 text-white"
                  : "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800"
              }`}
            >
              Suspended ({statusCounts.suspended || 0})
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex">
            <input
              type="text"
              placeholder="Search sellers..."
              className="px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 transition duration-200"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="p-3">
        {/* Error message */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 dark:bg-red-900 dark:text-red-200">
            <p>{error}</p>
          </div>
        )}

        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading sellers...
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                {/* Table header */}
                <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Seller</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Store Name</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Email</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Join Date</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Status</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">
                        Verification
                      </div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Actions</div>
                    </th>
                  </tr>
                </thead>
                {/* Table body */}
                <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
                  {sellers && sellers.length > 0 ? (
                    sellers.map((seller) => (
                      <tr key={seller._id}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 shrink-0 mr-2 sm:mr-3">
                              <img
                                className="w-full h-full object-cover rounded-full"
                                src={
                                  seller.profilePic &&
                                  seller.profilePic.length > 0
                                    ? seller.profilePic[0].secure_url
                                    : "/default-profile.png"
                                }
                                width="40"
                                height="40"
                                alt={seller.name}
                              />
                            </div>
                            <div className="font-medium text-gray-800 dark:text-gray-100">
                              {seller.name}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>
                              {seller.storeName || "No store name"}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <div style={ellipsisStyle}>{seller.email}</div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left text-gray-700 dark:text-gray-300">
                            {formatDate(seller.createdAt)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                                seller.status
                              )}`}
                            >
                              {getStatusDisplayText(seller.status)}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            {getVerificationBadge(seller.isVerified)}
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewDetails(seller._id)}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition duration-200"
                            >
                              View
                            </button>
                            {seller.status !== "active" && (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(seller._id, "active")
                                }
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition duration-200"
                              >
                                Activate
                              </button>
                            )}
                            {seller.status !== "suspended" && (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(seller._id, "suspended")
                                }
                                className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition duration-200"
                              >
                                Suspend
                              </button>
                            )}
                            {!seller.isVerified && (
                              <button
                                onClick={() => handleVerifySeller(seller._id)}
                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition duration-200"
                              >
                                Verify
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-2 whitespace-nowrap">
                        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                          No sellers found.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <nav
                  className="inline-flex rounded-md shadow-sm -space-x-px"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() =>
                      paginate(currentPage > 1 ? currentPage - 1 : 1)
                    }
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 
                      ${
                        currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""
                      }
                      dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600`}
                  >
                    Previous
                  </button>
                  {[...Array(totalPages).keys()].map((number) => (
                    <button
                      key={number}
                      onClick={() => paginate(number + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium
                        ${
                          currentPage === number + 1
                            ? "bg-blue-50 border-blue-500 text-blue-600 z-10"
                            : "text-gray-500 hover:bg-gray-50"
                        }
                        dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600
                        ${
                          currentPage === number + 1
                            ? "dark:bg-blue-900 dark:border-blue-500 dark:text-blue-300"
                            : ""
                        }`}
                    >
                      {number + 1}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      paginate(
                        currentPage < totalPages ? currentPage + 1 : totalPages
                      )
                    }
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50
                      ${
                        currentPage === totalPages
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }
                      dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>

      {/* Seller Detail Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Seller Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                    Basic Information
                  </h4>
                  <div className="flex items-center mb-4">
                    <div className="w-16 h-16 shrink-0 mr-4">
                      <img
                        className="w-full h-full object-cover rounded-full"
                        src={
                          selectedSeller.profilePic
                            ? selectedSeller.profilePic
                            : "/default-profile.png"
                        }
                        alt={selectedSeller.name}
                      />
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-800 dark:text-gray-100">
                        {selectedSeller.name}
                      </h5>
                      <p className="text-gray-500 dark:text-gray-400">
                        {selectedSeller.email}
                      </p>
                      <div className="mt-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                            selectedSeller.status
                          )}`}
                        >
                          {getStatusDisplayText(selectedSeller.status)}
                        </span>
                        <span className="ml-2">
                          {getVerificationBadge(selectedSeller.isVerified)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Store Name
                      </p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">
                        {selectedSeller.storeName || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Phone
                      </p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">
                        {selectedSeller.phone || "Not provided"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Joined On
                      </p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">
                        {formatDate(selectedSeller.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sales Stats */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                    Sales Statistics
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                      <p className="text-gray-500 dark:text-gray-300 text-sm">
                        Total Orders
                      </p>
                      <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                        {selectedSeller.salesStats?.totalOrders || 0}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                      <p className="text-gray-500 dark:text-gray-300 text-sm">
                        Total Revenue
                      </p>
                      <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                        {formatCurrency(
                          selectedSeller.salesStats?.totalRevenue || 0
                        )}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                      <p className="text-gray-500 dark:text-gray-300 text-sm">
                        Products
                      </p>
                      <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                        {selectedSeller.salesStats?.totalProducts || 0}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-600 p-3 rounded-lg text-center">
                      <p className="text-gray-500 dark:text-gray-300 text-sm">
                        Avg Rating
                      </p>
                      <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                        {selectedSeller.salesStats?.averageRating?.toFixed(1) ||
                          "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                    Address
                  </h4>
                  {selectedSeller.address ? (
                    <div>
                      <p className="text-gray-800 dark:text-gray-100">
                        {selectedSeller.address.street}
                      </p>
                      <p className="text-gray-800 dark:text-gray-100">
                        {selectedSeller.address.city},{" "}
                        {selectedSeller.address.state}{" "}
                        {selectedSeller.address.zipCode}
                      </p>
                      <p className="text-gray-800 dark:text-gray-100">
                        {selectedSeller.address.country}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">
                      No address provided
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                    Actions
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {selectedSeller.status !== "active" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(selectedSeller._id, "active")
                        }
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition duration-200"
                      >
                        Activate Seller
                      </button>
                    )}
                    {selectedSeller.status !== "suspended" && (
                      <button
                        onClick={() =>
                          handleUpdateStatus(selectedSeller._id, "suspended")
                        }
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200"
                      >
                        Suspend Seller
                      </button>
                    )}
                    {!selectedSeller.isVerified && (
                      <button
                        onClick={() => handleVerifySeller(selectedSeller._id)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                      >
                        Verify Seller
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">
                  Recent Orders
                </h4>
                {selectedSeller.recentOrders &&
                selectedSeller.recentOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                      <thead className="bg-gray-100 dark:bg-gray-600">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Order ID
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                        {selectedSeller.recentOrders.map((order) => (
                          <tr key={order._id}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">
                              #
                              {order.orderId ||
                                order._id.substring(18, 24).toUpperCase()}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100">
                              {order.customer?.name || "Guest"}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100">
                              {formatCurrency(order.totalAmount)}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(
                                  order.status
                                )}`}
                              >
                                {getStatusDisplayText(order.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    No recent orders found
                  </p>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SellerPage;
