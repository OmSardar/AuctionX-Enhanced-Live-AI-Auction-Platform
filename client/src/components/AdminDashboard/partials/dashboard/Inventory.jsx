import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { getOptimizedThumbnail, getOptimizedCardImage } from "../../../../utils/imageOptimizer";
import { formatCurrency } from "../../../../lib/utils";

function DashboardCard10() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [countdown, setCountdown] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const itemsPerPage = 5;

  // Fetch products from the backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await axiosWithAuth.get("/products/");

        // Validate response data is an array
        if (
          !response.data?.products ||
          !Array.isArray(response.data.products)
        ) {
          throw new Error("Invalid products data format");
        }
        setProducts(response.data.products);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError(error.message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Countdown effect for the selected item
  useEffect(() => {
    if (!selectedItem) return;

    const calculateCountdown = () => {
      const now = new Date();
      const biddingDate = new Date(selectedItem.biddingStartDate);
      const [hours, minutes] = selectedItem.biddingStartTime.split(":");
      biddingDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      const diff = biddingDate - now;

      if (diff <= 0) {
        setCountdown("Bidding has started");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(`${days}d ${hoursLeft}h ${minutesLeft}m ${secondsLeft}s`);
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [selectedItem]);

  const handleViewDetails = (productId) => {
    const product = products.find((p) => p._id === productId);
    setSelectedItem(product);
    setCurrentImageIndex(0);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const handleSelectItem = (productId) => {
    if (selectedItems.includes(productId)) {
      setSelectedItems(selectedItems.filter((id) => id !== productId));
    } else {
      setSelectedItems([...selectedItems, productId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.length === products.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(products.map((product) => product._id));
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_URL}/api/products/delete-multiple`, {
        data: { ids: selectedItems },
      });
      setProducts(
        products.filter((product) => !selectedItems.includes(product._id))
      );
      setSelectedItems([]);
    } catch (error) {
      console.error("Error deleting products:", error);
      setError("Failed to delete products");
    }
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Safe array operations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = products.slice(indexOfFirstItem, indexOfLastItem);

  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "130px",
  };

  const nextImage = () => {
    if (selectedItem?.images?.length > currentImageIndex + 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading products...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Product Inventory
        </h2>
        <div className="flex items-center space-x-4">
          {selectedItems.length > 0 && (
            <button
              onClick={handleDelete}
              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
          >
            {selectedItems.length === products.length
              ? "Unselect All"
              : "Select All"}
          </button>
        </div>
      </header>
      <div className="p-3">
        {products.length === 0 ? (
          <div className="text-center py-8">No products found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Select</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Name</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Category</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Start Price</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Email</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">
                        Bidding Date
                      </div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Status</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Actions</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
                  {currentItems.map((product) => (
                    <tr key={product._id}>
                      <td className="p-2 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(product._id)}
                          onChange={() => handleSelectItem(product._id)}
                          className="form-checkbox h-4 w-4 text-blue-600 transition duration-200"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 shrink-0 mr-2 sm:mr-3">
                            {product.images?.[0]?.secure_url && (
                              <img
                                className="w-full h-full object-cover rounded-lg"
                                src={getOptimizedThumbnail(product.images[0].secure_url, 80)}
                                width="40"
                                height="40"
                                loading="lazy"
                                decoding="async"
                                alt={product.name}
                              />
                            )}
                          </div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            <div style={ellipsisStyle}>{product.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle}>{product.category}</div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left font-medium text-green-500">
                          <div style={ellipsisStyle}>
                            {formatCurrency(product.biddingStartPrice)}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle}>{product.email}</div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle}>
                            {new Date(
                              product.biddingStartDate
                            ).toLocaleDateString()}{" "}
                            at {product.biddingStartTime}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="text-left">
                          <div style={ellipsisStyle}>
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                product.status === "Active"
                                  ? "bg-yellow-100 text-yellow-600"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {product.status === "Active"
                                ? "Pending"
                                : "Unsold"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(product._id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
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
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of{" "}
                {Math.ceil(products.length / itemsPerPage)}
              </span>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={
                  currentPage === Math.ceil(products.length / itemsPerPage)
                }
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal for Product Details */}
      {selectedItem && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Product Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Images Section */}
              <div>
                <div className="relative">
                  {selectedItem.images?.[currentImageIndex]?.secure_url && (
                    <>
                      <img
                        className="w-full h-64 object-contain rounded-lg mb-2"
                        src={selectedItem.images[currentImageIndex].secure_url}
                        alt={selectedItem.name}
                      />
                      {selectedItem.images.length > 1 && (
                        <div className="flex justify-between absolute top-1/2 w-full">
                          <button
                            onClick={prevImage}
                            disabled={currentImageIndex === 0}
                            className="bg-gray-800/50 text-white p-2 rounded-full hover:bg-gray-800 transition duration-200"
                          >
                            &lt;
                          </button>
                          <button
                            onClick={nextImage}
                            disabled={
                              currentImageIndex ===
                              selectedItem.images.length - 1
                            }
                            className="bg-gray-800/50 text-white p-2 rounded-full hover:bg-gray-800 transition duration-200"
                          >
                            &gt;
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex space-x-2 mt-2">
                    {selectedItem.images?.map((img, index) => (
                      <img
                        key={index}
                        src={getOptimizedThumbnail(img.secure_url, 96)}
                        alt={`Thumbnail ${index}`}
                        loading="lazy"
                        decoding="async"
                        className={`w-12 h-12 object-cover rounded cursor-pointer ${
                          currentImageIndex === index
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      />
                    ))}
                  </div>
                </div>

                {selectedItem.hasBanner &&
                  selectedItem.bannerImage?.secure_url && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Banner Image</h4>
                      <img
                        src={selectedItem.bannerImage.secure_url}
                        alt="Banner"
                        className="w-full h-32 object-contain rounded-lg"
                      />
                      <p className="text-sm mt-1">
                        Banner Plan: {selectedItem.bannerPlan}
                      </p>
                    </div>
                  )}
              </div>

              {/* Details Section */}
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedItem.name}</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {selectedItem.category}
                </p>

                <div className="mb-4">
                  <h3 className="font-medium mb-1">Countdown to Bidding:</h3>
                  <p className="text-lg font-semibold text-blue-600">
                    {countdown}
                  </p>
                  <p className="text-sm">
                    Starts:{" "}
                    {new Date(
                      selectedItem.biddingStartDate
                    ).toLocaleDateString()}{" "}
                    at {selectedItem.biddingStartTime}
                  </p>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium mb-1">Starting Price:</h3>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(selectedItem.biddingStartPrice)}
                  </p>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium mb-1">Status:</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedItem.status === "Active"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {selectedItem.status === "Active" ? "Pending" : "Unsold"}
                  </span>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium mb-1">Contact:</h3>
                  <p>{selectedItem.email}</p>
                  <p>{selectedItem.mobileNumber}</p>
                </div>

                <div className="mb-4">
                  <h3 className="font-medium mb-1">Description:</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {selectedItem.description?.map((item, index) => (
                      <li key={index}>
                        <span className="font-medium">{item.name}:</span>{" "}
                        {item.description}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
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

export default DashboardCard10;
