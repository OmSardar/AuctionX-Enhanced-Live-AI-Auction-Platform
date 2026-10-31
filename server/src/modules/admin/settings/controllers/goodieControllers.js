const Goodie = require("../models/goodie");

// Create Goodie
exports.createGoodie = async (req, res) => {
  try {
    const { name, category, price, stock, description, keyFeatures, images } = req.body;

    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({ error: "Name, category, price, and stock are required" });
    }

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ error: "Price must be a non-negative number" });
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: "Stock must be a non-negative integer" });
    }

    const goodie = await Goodie.create({
      name: String(name).trim(),
      category: String(category).trim().toLowerCase(),
      price: parsedPrice,
      stock: parsedStock,
      description: description ? String(description).trim() : "",
      keyFeatures: Array.isArray(keyFeatures) ? keyFeatures.map(f => String(f).trim()).filter(Boolean) : [],
      images: Array.isArray(images) ? images.map(img => String(img).trim()).filter(Boolean) : []
    });

    res.status(201).json(goodie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get All Goodies
exports.getAllGoodies = async (req, res) => {
  try {
    const goodies = await Goodie.find().sort({ createdAt: -1 });
    res.json(goodies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Goodies by Category
exports.getGoodiesByCategory = async (req, res) => {
  try {
    const category = req.params.category.toLowerCase();
    const goodies = await Goodie.find({ category }).sort({ createdAt: -1 });
    res.json(goodies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Goodie
exports.updateGoodie = async (req, res) => {
  try {
    const allowedFields = ["name", "category", "price", "stock", "description", "keyFeatures", "images"];
    const updates = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        if (key === "price") {
          const p = parseFloat(req.body[key]);
          if (!isNaN(p) && p >= 0) updates.price = p;
        } else if (key === "stock") {
          const s = parseInt(req.body[key], 10);
          if (!isNaN(s) && s >= 0) updates.stock = s;
        } else if (key === "category") {
          updates.category = String(req.body[key]).trim().toLowerCase();
        } else {
          updates[key] = req.body[key];
        }
      }
    }

    const updated = await Goodie.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Goodie not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Goodie
exports.deleteGoodie = async (req, res) => {
  try {
    const deleted = await Goodie.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Goodie not found" });
    }
    res.json({ message: "Goodie deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

