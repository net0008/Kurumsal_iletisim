// Versiyon: 1.1 - Admin Rotaları
// Düzeltme: Frontend kodları temizlendi, backend rotaları eklendi.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Modeller
const User = require('../models/User');
const Message = require('../models/Message');
const Announcement = require('../models/Announcement');
const File = require('../models/File');

// Middleware
const { requireAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

// Tüm admin rotaları korumalıdır
router.use(requireAuth, isAdmin);

// İstatistikleri Getir
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const onlineUsers = await User.countDocuments({ isOnline: true });
        const totalMessages = await Message.countDocuments();
        const totalAnnouncements = await Announcement.countDocuments();
        const totalFiles = await File.countDocuments();

        res.json({
            totalUsers,
            onlineUsers,
            totalMessages,
            totalAnnouncements,
            totalFiles
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Logo Yükleme Ayarları
const imgDir = path.join(__dirname, '../../public/img');
if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, imgDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'logo.png'); // Her zaman logo.png olarak kaydet
    }
});
const upload = multer({ storage: storage });

// Logo Yükleme Rotası
router.post('/settings/logo', upload.single('logo'), (req, res) => {
    res.json({ success: true, message: 'Logo güncellendi' });
});

// Logları Getir (Placeholder - İleride eklenebilir)
router.get('/logs', (req, res) => {
    res.json({ logs: [] });
});

module.exports = router;