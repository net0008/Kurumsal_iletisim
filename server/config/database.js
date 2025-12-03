const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // MongoDB bağlantı URL'i
    // Yerel MongoDB için: 'mongodb://localhost:27017/corporate-chat'
    // MongoDB Atlas için: process.env.MONGODB_URI
    
    const conn = await mongoose.connect('mongodb://localhost:27017/corporate-chat', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Bağlandı: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Hata: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;