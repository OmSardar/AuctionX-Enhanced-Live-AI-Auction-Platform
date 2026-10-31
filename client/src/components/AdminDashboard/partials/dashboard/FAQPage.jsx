import React, { useState, useEffect } from "react";
import axiosWithAuth from "../../../../redux/slices/axiosWithAuth";
import { toast } from "react-hot-toast";
import { ChevronDown, ChevronUp, Plus, Trash2, Search, HelpCircle } from "lucide-react";

const CATEGORIES = ["all", "General", "Bidding", "Account", "Payment", "Sellers"];

export default function FAQPage() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  // New FAQ Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [newTags, setNewTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFaqs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await axiosWithAuth.get("/faqs", { params });
      if (response.data?.success && Array.isArray(response.data.data)) {
        setFaqs(response.data.data);
      } else if (Array.isArray(response.data)) {
        setFaqs(response.data);
      } else {
        setFaqs([]);
      }
    } catch (err) {
      console.error("Failed to load FAQs:", err);
      toast.error("Failed to load FAQs from server");
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
  }, [selectedCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFaqs();
  };

  const handleCreateFaq = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Question and answer are required");
      return;
    }

    setSubmitting(true);
    try {
      const tagsArray = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await axiosWithAuth.post("/faqs", {
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
        category: newCategory,
        tags: tagsArray,
      });

      toast.success("FAQ created successfully!");
      setShowAddModal(false);
      setNewQuestion("");
      setNewAnswer("");
      setNewTags("");
      fetchFaqs();
    } catch (err) {
      console.error("Failed to create FAQ:", err);
      toast.error(err.response?.data?.message || "Failed to create FAQ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFaq = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      await axiosWithAuth.delete(`/faqs/${id}`);
      toast.success("FAQ deleted successfully");
      setFaqs((prev) => prev.filter((f) => f._id !== id));
    } catch (err) {
      console.error("Failed to delete FAQ:", err);
      toast.error("Failed to delete FAQ");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-sm rounded-2xl border border-gray-100 dark:border-gray-700/60 p-5 sm:p-6 transition-colors">
      {/* Header */}
      <div className="sm:flex sm:justify-between sm:items-center pb-5 border-b border-gray-100 dark:border-gray-700/60 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Knowledge Base & FAQ Management
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Curate questions and authoritative answers served to platform users and the automated assistant.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="mt-3 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-medium text-xs shadow-xs transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New FAQ</span>
        </button>
      </div>

      {/* Search & Categories */}
      <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search questions, answers, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </form>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer capitalize ${
                selectedCategory === cat
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                  : "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2"></div>
          <p>Loading knowledge base entries...</p>
        </div>
      ) : faqs.length === 0 ? (
        <div className="py-12 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8">
          <HelpCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1">
            No FAQs found
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
            {searchTerm || selectedCategory !== "all"
              ? "No questions match your current search or category filter."
              : "Get started by adding frequently asked questions for platform users."}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First FAQ</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => {
            const isExpanded = expandedId === faq._id;
            return (
              <div
                key={faq._id}
                className="rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden bg-gray-50/50 dark:bg-gray-800/40 transition"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : faq._id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-gray-100/50 dark:hover:bg-gray-700/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                      {faq.category || "General"}
                    </span>
                    <h4 className="font-medium text-xs sm:text-sm text-gray-800 dark:text-gray-100 truncate">
                      {faq.question}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFaq(faq._id, e)}
                      title="Delete FAQ"
                      aria-label="Delete FAQ"
                      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700/40 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    <p className="whitespace-pre-wrap">{faq.answer}</p>
                    {faq.tags && faq.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/40">
                        {faq.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-gray-200/70 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add FAQ Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
              Add New Knowledge Base Entry
            </h3>
            <form onSubmit={handleCreateFaq} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g. How do scheduled bids work?"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                >
                  {CATEGORIES.filter((c) => c !== "all").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Answer
                </label>
                <textarea
                  required
                  rows={4}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Enter the authoritative answer..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. bidding, auto-bid, limits"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save FAQ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}