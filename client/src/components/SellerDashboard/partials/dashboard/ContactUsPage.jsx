import React, { useState, useEffect, useCallback } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { Mail, CheckCircle, Clock, Trash2, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

function SellerContactUsPage() {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const contactsPerPage = 6;

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosWithAuth.get("/contact");
      const list = Array.isArray(response.data) ? response.data : [];
      setContacts(list);
    } catch (err) {
      console.error("Error fetching contact messages:", err);
      setError("Failed to fetch contact messages. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleUpdateStatus = async (id, status) => {
    try {
      setUpdatingStatus(true);
      const response = await axiosWithAuth.patch(`/contact/${id}/status`, { status });
      const updated = response.data?.data || response.data;
      setContacts(prev => prev.map(c => c._id === id ? { ...c, status } : c));
      if (selectedContact && selectedContact._id === id) {
        setSelectedContact(prev => ({ ...prev, status }));
      }
      toast.success(`Message marked as ${status.replace('_', ' ')}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      toast.error("Failed to update message status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this contact request?")) {
      return;
    }
    try {
      await axiosWithAuth.delete(`/contact/${id}`);
      setContacts(prev => prev.filter(c => c._id !== id));
      if (selectedContact && selectedContact._id === id) {
        setSelectedContact(null);
      }
      toast.success("Contact message deleted");
    } catch (err) {
      console.error("Failed to delete contact:", err);
      toast.error("Failed to delete message");
    }
  };

  // Pagination logic
  const indexOfLastContact = currentPage * contactsPerPage;
  const indexOfFirstContact = indexOfLastContact - contactsPerPage;
  const currentContacts = Array.isArray(contacts)
    ? contacts.slice(indexOfFirstContact, indexOfLastContact)
    : [];

  const totalPages = Math.ceil(contacts.length / contactsPerPage) || 1;
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="col-span-full bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-600" />
            Contact Form Submissions
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Review and respond to messages submitted by visitors and customers
          </p>
        </div>
        <button
          onClick={fetchContacts}
          disabled={loading}
          className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors self-start sm:self-auto"
          title="Refresh messages"
          aria-label="Refresh messages"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading messages...</p>
        </div>
      ) : error ? (
        <div className="py-8 text-center text-red-500">
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchContacts}
            className="mt-3 px-3 py-1 text-xs bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded hover:underline"
          >
            Try Again
          </button>
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-2 opacity-60" />
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">No contact messages</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Customer inquiries and support messages submitted through the contact page will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                <tr>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Received</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {currentContacts.map((contact) => (
                  <tr key={contact._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{contact.name}</div>
                      <div className="text-xs text-gray-500">{contact.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{contact.subject}</span>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{contact.message}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        contact.status === 'resolved' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                          : contact.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}>
                        {contact.status || 'new'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {new Date(contact.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedContact(contact)}
                        className="px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 rounded transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(contact._id)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700 text-sm">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Details Modal */}
      {selectedContact && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                Contact Inquiry
              </h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg">
                <div>
                  <span className="text-xs text-gray-400 block">Sender Name</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedContact.name}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 block">Email Address</span>
                  <a href={`mailto:${selectedContact.email}`} className="text-amber-600 hover:underline">
                    {selectedContact.email}
                  </a>
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-400 block">Subject</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{selectedContact.subject}</p>
              </div>

              <div>
                <span className="text-xs text-gray-400 block mb-1">Message Body</span>
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-lg text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedContact.message}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-xs text-gray-400 block">Current Status</span>
                  <span className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
                    {selectedContact.status || 'new'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedContact.status !== 'in_progress' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedContact._id, 'in_progress')}
                      disabled={updatingStatus}
                      className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded font-medium hover:bg-blue-200"
                    >
                      Mark In Progress
                    </button>
                  )}
                  {selectedContact.status !== 'resolved' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedContact._id, 'resolved')}
                      disabled={updatingStatus}
                      className="px-3 py-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 rounded font-medium hover:bg-green-200 flex items-center gap-1"
                    >
                      <CheckCircle size={14} />
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-200"
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

export default SellerContactUsPage;