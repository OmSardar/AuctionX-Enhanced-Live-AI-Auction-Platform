import React, { useState, useEffect } from "react";
import axios from "axios";

function AddBannerPage() {
  const API_URL = import.meta.env.VITE_API_URL;
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    link: "",
    position: "top", // Default position
    startDate: "",
    endDate: "",
    isActive: true,
  });

  // For image preview and upload
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // UI states
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/banners`);

        // Most common REST API response formats
        if (response.data?.data) {
          setBanners(response.data.data); // { data: [...] }
        } else if (response.data?.banners) {
          setBanners(response.data.banners); // { banners: [...] }
        } else if (Array.isArray(response.data)) {
          setBanners(response.data); // Just the array
        } else {
          console.error("Unexpected response format:", response.data);
          setBanners([]);
        }
      } catch (err) {
        console.error("Error fetching banners:", err);
        console.error("Error details:", err.response?.data);
        setMessage({
          text: "Failed to load banners",
          type: "error",
        });
      }
    };

    fetchBanners();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      // Create a preview URL for the selected image
      const fileReader = new FileReader();
      fileReader.onload = () => {
        setPreviewUrl(fileReader.result);
      };
      fileReader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedImage) {
      setMessage({
        text: "Please select an image for the banner",
        type: "error",
      });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      // Create form data for multipart/form-data submission
      const formDataToSend = new FormData();
      Object.keys(formData).forEach((key) => {
        formDataToSend.append(key, formData[key]);
      });
      formDataToSend.append("image", selectedImage);

      // Send request to the server
      const response = await axios.post(
        `${API_URL}/api/banners`,
        formDataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Handle success
      setMessage({ text: "Banner added successfully!", type: "success" });

      // Clear form
      setFormData({
        title: "",
        description: "",
        link: "",
        position: "top",
        startDate: "",
        endDate: "",
        isActive: true,
      });
      setSelectedImage(null);
      setPreviewUrl("");

      // Refresh banners list
      if (response.data) {
        if (Array.isArray(response.data)) {
          setBanners(response.data);
        } else if (response.data.banner) {
          setBanners([...banners, response.data.banner]);
        }
      }
    } catch (err) {
      console.error("Error adding banner:", err);
      setMessage({
        text: err.response?.data?.message || "Failed to add banner",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle banner deletion
  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm("Are you sure you want to delete this banner?")) {
      try {
        await axios.delete(`${API_URL}/api/banners/${bannerId}`);
        setBanners(banners.filter((banner) => banner._id !== bannerId));
        setMessage({ text: "Banner deleted successfully!", type: "success" });
      } catch (err) {
        console.error("Error deleting banner:", err);
        setMessage({ text: "Failed to delete banner", type: "error" });
      }
    }
  };

  // Handle banner activation toggle
  const handleToggleActive = async (bannerId, currentStatus) => {
    try {
      await axios.patch(`${API_URL}/api/banners/${bannerId}`, {
        isActive: !currentStatus,
      });

      // Update local state
      setBanners(
        banners.map((banner) =>
          banner._id === bannerId
            ? { ...banner, isActive: !banner.isActive }
            : banner
        )
      );

      setMessage({
        text: `Banner ${
          !currentStatus ? "activated" : "deactivated"
        } successfully!`,
        type: "success",
      });
    } catch (err) {
      console.error("Error updating banner status:", err);
      setMessage({ text: "Failed to update banner status", type: "error" });
    }
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
        <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-100">
          Banner Management
        </h2>
      </header>

      <div className="p-5">
        {/* Status message */}
        {message.text && (
          <div
            className={`mb-4 p-3 rounded ${
              message.type === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-800/20 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-800/20 dark:text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Form Section */}
        <div className="mb-8">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Add New Banner
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              {/* Banner Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Position
                </label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="top">Top</option>
                  <option value="sidebar">Sidebar</option>
                  <option value="footer">Footer</option>
                  <option value="popup">Popup</option>
                </select>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                ></textarea>
              </div>

              {/* Link */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link URL
                </label>
                <input
                  type="url"
                  name="link"
                  value={formData.link}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="https://"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Image Upload */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Banner Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />

                {/* Image Preview */}
                {previewUrl && (
                  <div className="mt-2">
                    <img
                      src={previewUrl}
                      alt="Banner preview"
                      className="w-full max-h-40 object-contain border rounded"
                    />
                  </div>
                )}
              </div>

              {/* Active Status */}
              <div className="md:col-span-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
                  />
                  <label
                    htmlFor="isActive"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    Active
                  </label>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-4">
              <button
                type="submit"
                disabled={loading}
                className={`w-full px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {loading ? "Adding..." : "Add Banner"}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Banners Section */}
        <div>
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Existing Banners
          </h3>

          {banners.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No banners found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-auto w-full">
                <thead className="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Banner</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Details</div>
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
                  {banners.map((banner) => (
                    <tr key={banner._id}>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 h-12 shrink-0 mr-2 sm:mr-3">
                            <img
                              className="w-full h-full object-cover rounded"
                              src={banner.imageUrl}
                              alt={banner.title}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">
                            {banner.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {banner.position} •
                            {banner.startDate && (
                              <span>
                                {" "}
                                {new Date(
                                  banner.startDate
                                ).toLocaleDateString()}{" "}
                                to{" "}
                              </span>
                            )}
                            {banner.endDate
                              ? new Date(banner.endDate).toLocaleDateString()
                              : " No end date"}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            banner.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {banner.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <div className="flex space-x-2">
                          <button
                            onClick={() =>
                              handleToggleActive(banner._id, banner.isActive)
                            }
                            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
                          >
                            {banner.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleDeleteBanner(banner._id)}
                            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddBannerPage;
