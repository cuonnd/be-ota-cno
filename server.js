const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const apiRoutes = require('./routes/api');
const { generalErrorHandler, routeNotFoundHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Middleware
app.use(cors({
  origin: '*', // Cho phép tất cả các nguồn gốc
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/files', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', apiRoutes);

// Error handlers
app.use(routeNotFoundHandler);
app.use(generalErrorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
