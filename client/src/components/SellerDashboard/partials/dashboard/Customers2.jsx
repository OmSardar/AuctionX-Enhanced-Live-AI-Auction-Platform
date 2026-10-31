import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Users, Mail, MapPin, DollarSign, Package } from "lucide-react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";

function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const customersPerPage = 5;

  const sellerEmail = useSelector(
    (state) => state.auth?.user?.email || state.user?.email
  );

  useEffect(() => {
    let isMounted = true;

    const fetchSellerCustomers = async () => {
      if (!sellerEmail) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axiosWithAuth.get(
          `/orders/seller/${encodeURIComponent(sellerEmail)}`
        );

        if (!isMounted) return;

        const orders = Array.isArray(response.data) ? response.data : [];

        // Aggregate unique customer buyers from seller's orders
        const customerMap = new Map();

        orders.forEach((order) => {
          const email = order.userEmail || "unknown@buyer.com";
          const existing = customerMap.get(email);
          const orderAmount = order.highestBid || order.amount || 0;

          if (existing) {
            existing.totalSpent += orderAmount;
            existing.orderCount += 1;
            existing.recentOrderDate = order.createdAt || existing.recentOrderDate;
            if (order.address && !existing.location) {
              existing.location = order.address;
            }
          } else {
            customerMap.set(email, {
              _id: order._id || email,
              name: order.name || email.split("@")[0],
              email: email,
              totalSpent: orderAmount,
              orderCount: 1,
              location: order.address || "India",
              recentOrderDate: order.createdAt || new Date().toISOString(),
              recentItem: order.title || order.itemName || "Auction Item",
            });
          }
        });

        setCustomers(Array.from(customerMap.values()));
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching seller customers:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load customer list"
        );
        setCustomers([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSellerCustomers();

    return () => {
      isMounted = false;
    };
  }, [sellerEmail]);

  const handleViewDetails = (customerId) => {
    const customer = customers.find((c) => c._id === customerId);
    setSelectedCustomer(customer);
  };

  const handleCloseModal = () => {
    setSelectedCustomer(null);
  };

  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = customers.slice(
    indexOfFirstCustomer,
    indexOfLastCustomer
  );

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="col-span-full xl:col-span-6 bg-surface border border-border-subtle shadow-card rounded-2xl overflow-hidden">
      <header className="px-5 py-4 border-b border-border-subtle flex justify-between items-center">
        <div>
          <h2 className="font-bold text-foreground text-base sm:text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-action-primary" />
            Storefront Buyers & Customers
          </h2>
          <p className="text-xs text-foreground-secondary">
            Verified collectors and winning bidders who ordered from your listings
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-subtle text-foreground-secondary border border-border-subtle">
          {customers.length} {customers.length === 1 ? "Buyer" : "Buyers"}
        </span>
      </header>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-foreground-secondary">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-action-primary mr-3"></div>
            <span>Loading customers...</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-status-danger bg-status-danger/5 rounded-xl border border-status-danger/20 text-sm">
            {error}
          </div>
        ) : customers.length === 0 ? (
          <div className="py-12 text-center text-foreground-secondary">
            <Package className="w-12 h-12 mx-auto mb-3 text-foreground-muted opacity-50" />
            <p className="font-medium text-foreground">No customer orders yet</p>
            <p className="text-xs text-foreground-secondary mt-1">
              Winning bidders will automatically appear here once their orders are confirmed.
            </p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="table-auto w-full text-left">
                <thead className="text-xs uppercase font-semibold text-foreground-muted bg-surface-subtle border-b border-border-subtle">
                  <tr>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Email</th>
                    <th className="p-3 text-right">Total Spent</th>
                    <th className="p-3 text-center">Orders</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-border-subtle">
                  {currentCustomers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="hover:bg-surface-subtle/50 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-action-primary/10 text-action-primary font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {customer.name?.charAt(0)?.toUpperCase() || "B"}
                          </div>
                          <div className="font-medium text-foreground truncate max-w-[140px]">
                            {customer.name}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-foreground-secondary truncate max-w-[160px]">
                        {customer.email}
                      </td>
                      <td className="p-3 text-right font-numeric font-bold text-foreground">
                        ₹{customer.totalSpent.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 text-center font-numeric text-foreground-secondary">
                        {customer.orderCount}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleViewDetails(customer._id)}
                          className="px-3 py-1 bg-surface-subtle hover:bg-surface-hover text-action-primary text-xs font-semibold rounded-lg border border-border-subtle transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {customers.length > customersPerPage && (
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-border-subtle text-xs">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-foreground-secondary">
                  Page {currentPage} of {Math.ceil(customers.length / customersPerPage)}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={
                    currentPage === Math.ceil(customers.length / customersPerPage)
                  }
                  className="px-3 py-1.5 rounded-lg border border-border-subtle bg-surface hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs z-50 p-4">
          <div className="bg-surface border border-border-subtle p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-border-subtle">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-action-primary" />
                Buyer Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-foreground-muted hover:text-foreground text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-action-primary/10 text-action-primary font-bold flex items-center justify-center text-lg">
                  {selectedCustomer.name?.charAt(0)?.toUpperCase() || "B"}
                </div>
                <div>
                  <p className="font-bold text-foreground text-base">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-xs text-foreground-secondary">
                    {selectedCustomer.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle">
                  <p className="text-xs text-foreground-muted">Total Spent</p>
                  <p className="text-lg font-bold text-action-primary font-numeric">
                    ₹{selectedCustomer.totalSpent.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle">
                  <p className="text-xs text-foreground-muted">Orders Count</p>
                  <p className="text-lg font-bold text-foreground font-numeric">
                    {selectedCustomer.orderCount}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-subtle border border-border-subtle">
                <p className="text-xs text-foreground-muted mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Delivery Location
                </p>
                <p className="text-xs text-foreground-secondary">
                  {selectedCustomer.location}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-surface-subtle hover:bg-surface-hover border border-border-subtle text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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

export default Customers;
