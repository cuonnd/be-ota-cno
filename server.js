// server.js - ĐÃ SỬA
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const apiRoutes = require('./routes/api');
const { generalErrorHandler, routeNotFoundHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/files', express.static(path.join(__dirname, 'uploads')));
app.use('/api', apiRoutes);
app.use(routeNotFoundHandler);
app.use(generalErrorHandler);

const PORT = process.env.PORT || 3000;

// 👇 CHỈ KHỞI ĐỘNG SERVER SAU KHI KẾT NỐI DB THÀNH CÔNG
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // tăng thời gian timeout nếu cần
})
.then(() => {
  console.log('✅ MongoDB Connected');
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1); // Dừng app nếu kết nối DB thất bại
});
