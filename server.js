const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db'); // Sử dụng function từ db.js

const apiRoutes = require('./routes/api');
const { generalErrorHandler, routeNotFoundHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: '*',
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

// Khởi động server chỉ sau khi MongoDB đã kết nối thành công
const startServer = async () => {
  try {
    // Đợi MongoDB kết nối trước
    await connectDB();
    
    // Sau đó mới khởi động server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();