// Versiyon: 1.0 (Yeni Sistem Ayarları Modeli)
const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    key: { 
        type: String, 
        required: true, 
        unique: true,
        default: 'system_config' 
    },
    maxFileSize: { 
        type: Number, 
        default: 20 * 1024 * 1024 // Varsayılan 20MB
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Settings', SettingsSchema);