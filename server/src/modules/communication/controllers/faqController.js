const FAQ = require("../models/FaqChat");

// Configuration
const MAX_FAQ_RESULTS = 5;

// Enhanced FAQ search with multiple matching strategies
const searchFAQ = async (query) => {
  if (!query?.trim()) throw new Error("Invalid query");

  try {
    let results = [];
    try {
      // 1. Try exact text search first
      results = await FAQ.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(MAX_FAQ_RESULTS);
    } catch {
      // Fallback if text index is missing or query syntax error
      results = [];
    }

    // 2. Fallback to partial matching if no exact matches (safely escape regex special characters)
    if (results.length === 0) {
      const escapedQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      results = await FAQ.find({
        $or: [
          { question: { $regex: escapedQuery, $options: "i" } },
          { answer: { $regex: escapedQuery, $options: "i" } },
          { tags: { $in: [new RegExp(escapedQuery, "i")] } },
        ],
      }).limit(MAX_FAQ_RESULTS);
    }

    return processFAQResults(results, query);
  } catch (error) {
    throw new Error("Search service unavailable");
  }
};

// Process and rank FAQ results
const processFAQResults = (results, originalQuery) => {
  if (results.length === 0) return null;

  return {
    question: results[0].question,
    answer: results[0].answer,
    confidence: calculateConfidence(results[0], originalQuery),
    source: "knowledge_base",
    all_matches: results.map((r) => ({
      question: r.question,
      answer: r.answer,
      confidence: calculateConfidence(r, originalQuery),
    })),
  };
};

// Confidence scoring algorithm
const calculateConfidence = (result, query) => {
  let score = 0;

  // Exact match bonus
  if (result.question.toLowerCase() === query.toLowerCase()) score += 0.3;

  // Text length scoring
  score += Math.min(result.question.length / 100, 0.2);
  score += Math.min(result.answer.length / 500, 0.2);

  // Keyword overlap
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const answerWords = new Set(result.answer.toLowerCase().split(/\s+/));
  const overlap = [...queryWords].filter((w) => answerWords.has(w)).length;
  score += Math.min(overlap / queryWords.size, 0.3);

  return Math.min(score, 1).toFixed(2);
};

// Main controller — Strictly database-backed FAQ search (zero unauthenticated Gemini calls)
exports.search = async (req, res) => {
  try {
    const query = req.query.query?.trim();
    if (!query) return res.status(400).json({ error: "Query required" });

    // 1. Search database FAQ
    const faqResult = await searchFAQ(query);
    if (faqResult) {
      return res.json(faqResult);
    }

    // 2. Safe fallback when no FAQ matches (no billable AI provider call)
    return res.json({
      answer:
        "I couldn't find a direct FAQ answer for that. Please try searching with different keywords, or sign in to chat with our context-aware AI assistant.",
      confidence: "0",
      source: "faq_fallback",
      question: query,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Search service unavailable",
    });
  }
};

// GET /api/faqs - Get all FAQs with optional search and category filter
exports.getAllFaqs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== "all") {
      filter.category = category;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { question: searchRegex },
        { answer: searchRegex },
        { tags: searchRegex },
      ];
    }

    const faqs = await FAQ.find(filter).sort({ category: 1, question: 1 });
    return res.json({
      success: true,
      count: faqs.length,
      data: faqs,
    });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching FAQs",
      error: error.message,
    });
  }
};

// POST /api/faqs - Create a new FAQ (admin only)
exports.createFaq = async (req, res) => {
  try {
    const { question, answer, category = "General", tags = [] } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Question and answer are required",
      });
    }

    const newFaq = new FAQ({
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim(),
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
    });

    const saved = await newFaq.save();
    return res.status(201).json({
      success: true,
      data: saved,
      message: "FAQ created successfully",
    });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating FAQ",
      error: error.message,
    });
  }
};

// PUT /api/faqs/:id - Update an FAQ
exports.updateFaq = async (req, res) => {
  try {
    const { question, answer, category, tags } = req.body;
    const updateData = {};

    if (question) updateData.question = question.trim();
    if (answer) updateData.answer = answer.trim();
    if (category) updateData.category = category.trim();
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [tags].filter(Boolean);

    const updated = await FAQ.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    return res.json({
      success: true,
      data: updated,
      message: "FAQ updated successfully",
    });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating FAQ",
      error: error.message,
    });
  }
};

// DELETE /api/faqs/:id - Delete an FAQ
exports.deleteFaq = async (req, res) => {
  try {
    const deleted = await FAQ.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    return res.json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting FAQ",
      error: error.message,
    });
  }
};

