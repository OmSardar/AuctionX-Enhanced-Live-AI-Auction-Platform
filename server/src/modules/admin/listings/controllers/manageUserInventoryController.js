// controllers/itemController.js
const Item = require("../models/inventory");

// Get all items
const getItems = async (req, res) => {
  try {
    const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : null;
    const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(req.query.limit, 10))) : null;

    let query = Item.find().sort({ createdAt: -1 }).lean();

    if (page && limit) {
      const skip = (page - 1) * limit;
      const [total, items] = await Promise.all([
        Item.countDocuments(),
        query.skip(skip).limit(limit),
      ]);
      return res.status(200).json({
        items,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    const items = await query;
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single item by ID
const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a new item
const addItem = async (req, res) => {
  const { name, category, price, email, addedDate, status, image } = req.body;
  try {
    const newItem = new Item({
      name,
      category,
      price,
      email,
      addedDate,
      status,
      image,
    });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an item
const updateItem = async (req, res) => {
  const { id } = req.params;
  const { name, category, price, email, addedDate, status, image } = req.body;
  try {
    const updatedItem = await Item.findByIdAndUpdate(
      id,
      { name, category, price, email, addedDate, status, image },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an item
const deleteItem = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedItem = await Item.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete multiple items
const deleteMultipleItems = async (req, res) => {
  const { ids } = req.body; // Array of item IDs to delete
  try {
    await Item.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: "Items deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getItems,
  getItemById,
  addItem,
  updateItem,
  deleteItem,
  deleteMultipleItems,
};
