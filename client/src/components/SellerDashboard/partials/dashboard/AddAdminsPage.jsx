import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { toast } from "react-hot-toast";

function AddAdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    role: "editor",
    password: "",
    confirmPassword: ""
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState(null);
  const adminsPerPage = 6;

  // Fetch admins from the backend
  useEffect(() => {
    const fetchAdmins = async () => {
      setLoading(true);
      try {
        const response = await axiosWithAuth.get(
          `/admins?page=${currentPage}&limit=${adminsPerPage}`
        );

        if (Array.isArray(response.data)) {
          setAdmins(response.data);
          setTotalPages(Math.ceil(response.data.length / adminsPerPage));
        } 
        else if (response.data && response.data.admins) {
          setAdmins(response.data.admins);
          setTotalPages(response.data.totalPages || 1);
        } 
        else {
          console.error("Invalid response format:", response.data);
          setAdmins([]);
        }
      } catch (err) {
        console.error("Error fetching admins:", err);
        setAdmins([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
  }, [currentPage]);

  // Function to handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ""
      });
    }
  };

  // Function to validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.fullName.trim()) errors.fullName = "Full name is required";
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = "Email is invalid";
    
    if (!formData.password) errors.password = "Password is required";
    else if (formData.password.length < 6) errors.password = "Password must be at least 6 characters";
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    
    return errors;
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    // Submit form data
    setSubmitStatus("submitting");
    try {
      await axiosWithAuth.post("/admins", formData);
      
      // Success - reset form and show success message
      setFormData({
        fullName: "",
        email: "",
        role: "editor",
        password: "",
        confirmPassword: ""
      });
      setSubmitStatus("success");
      toast.success("Administrator added successfully!");
      
      // Refresh admin list
      const response = await axiosWithAuth.get(
        `/admins?page=${currentPage}&limit=${adminsPerPage}`
      );
      
      if (Array.isArray(response.data)) {
        setAdmins(response.data);
      } else if (response.data && response.data.admins) {
        setAdmins(response.data.admins);
      }
      
      // Close modal after short delay
      setTimeout(() => {
        setShowAddModal(false);
        setSubmitStatus(null);
      }, 2000);
      
    } catch (error) {
      console.error("Error adding admin:", error);
      setSubmitStatus("error");
    }
  };

  // Function to handle pagination
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Function to handle view details
  const handleViewDetails = (adminId) => {
    const admin = admins.find((a) => a._id === adminId);
    setSelectedAdmin(admin);
  };

  // Function to close modal
  const handleCloseModal = () => {
    setSelectedAdmin(null);
    setShowAddModal(false);
    setSubmitStatus(null);
    setFormErrors({});
  };

  // Function to handle admin deletion
  const handleDeleteAdmin = async (adminId) => {
    if (window.confirm("Are you sure you want to remove this admin?")) {
      try {
        await axiosWithAuth.delete(`/admins/${adminId}`);
        toast.success("Administrator removed successfully");
        
        // Update admin list after deletion
        setAdmins(admins.filter(admin => admin._id !== adminId));
        
        // Close modal if the deleted admin was being viewed
        if (selectedAdmin && selectedAdmin._id === adminId) {
          setSelectedAdmin(null);
        }
      } catch (error) {
        console.error("Error deleting admin:", error);
        toast.error(error.response?.data?.message || "Failed to delete admin.");
      }
    }
  };

  return (
    <div className="col-span-full xl:col-span-6 bg-white dark:bg-gray-800 shadow-xs rounded-xl">
      <header className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100">
          Admin Management
        </h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
        >
          Add New Admin
        </button>
      </header>
      
      <div className="p-3">
        {/* Loading indicator */}
        {loading ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Loading admin list...
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
                      <div className="font-semibold text-left">Name</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Email</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Role</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Status</div>
                    </th>
                    <th className="p-2 whitespace-nowrap">
                      <div className="font-semibold text-left">Actions</div>
                    </th>
                  </tr>
                </thead>
                {/* Table body */}
                <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-700/60">
                  {admins && admins.length > 0 ? (
                    admins.map((admin) => (
                      <tr key={admin._id}>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 shrink-0 mr-2 sm:mr-3">
                              <div className="bg-gray-200 dark:bg-gray-700 w-full h-full rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-semibold">
                                {admin.fullName.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="font-medium text-gray-800 dark:text-gray-100">
                              {admin.fullName}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">{admin.email}</div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              admin.role === 'admin' 
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                              {admin.role}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-left">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              admin.active 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {admin.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewDetails(admin._id)}
                              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteAdmin(admin._id)}
                              className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="p-4 text-center text-gray-500 dark:text-gray-400"
                      >
                        No admins found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - only show if there are admins */}
            {admins && admins.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for Admin Details */}
      {selectedAdmin && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Admin Details
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              {/* Admin Avatar and Name */}
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl text-gray-600 dark:text-gray-300 font-semibold">
                  {selectedAdmin.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {selectedAdmin.fullName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAdmin.role.charAt(0).toUpperCase() + selectedAdmin.role.slice(1)}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Email
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedAdmin.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Status
                  </p>
                  <div className="flex items-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedAdmin.active 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {selectedAdmin.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Created At
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {new Date(selectedAdmin.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last Login
                  </p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {selectedAdmin.lastLogin 
                      ? new Date(selectedAdmin.lastLogin).toLocaleDateString() + ' ' + 
                        new Date(selectedAdmin.lastLogin).toLocaleTimeString()
                      : 'Never logged in'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => handleDeleteAdmin(selectedAdmin._id)}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-200"
              >
                Remove
              </button>
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

      {/* Modal for Adding New Admin */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-lg">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Add New Admin
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition duration-200"
              >
                &times;
              </button>
            </div>

            {/* Status Messages */}
            {submitStatus === "success" && (
              <div className="mb-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded-md">
                Admin added successfully!
              </div>
            )}
            
            {submitStatus === "error" && (
              <div className="mb-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md">
                Failed to add admin. Please try again.
              </div>
            )}

            {/* Modal Body - Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="fullName">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${
                      formErrors.fullName ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.fullName && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="email">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${
                      formErrors.email ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="password">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${
                      formErrors.password ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.password && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 ${
                      formErrors.confirmPassword ? 'border-red-500 dark:border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {formErrors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitStatus === "submitting"}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition duration-200 disabled:opacity-50"
                >
                  {submitStatus === "submitting" ? "Adding..." : "Add Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddAdminsPage;