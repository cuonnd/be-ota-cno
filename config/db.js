const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Tăng timeout lên 30s
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      maxPoolSize: 10,
      minPoolSize: 5,
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('✅ MongoDB Connected...');
    
    // Xử lý các sự kiện kết nối
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;