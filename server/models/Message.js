const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: String, required: true }, // Alıcı ID'si
    content: { type: String },
    messageType: { type: String, enum: ['text', 'file'], default: 'text' },
    fileUrl: { type: String },
    fileName: { type: String },
    mimetype: { type: String },
    read: { type: Boolean, default: false }, // Okundu bilgisi eklendi
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);