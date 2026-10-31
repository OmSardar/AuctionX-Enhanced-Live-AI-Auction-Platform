const express = require('express');
const router = express.Router();
const socketController = require('../controllers/socketController');

// This is a bit different from regular routes since Socket.io doesn't use Express routing
module.exports = (io) => {
  // Initialize socket controller with the io instance
  socketController(io);
  
  return router;
};