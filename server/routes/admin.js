// Versiyon: 2.0 (Loglama ve Mesaj İnceleme Eklendi)
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
const Log = require('../models/Log'); // Log modeli eklendi

const { requireAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

router.use(requireAuth, isAdmin);

// İstatistikler
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const onlineUsers = await User.countDocuments({ isOnline: true });
        const totalMessages = await Message.countDocuments();
        const totalAnnouncements = await Announcement.countDocuments();
        const totalFiles = await File.countDocuments();

        res.json({ totalUsers, onlineUsers, totalMessages, totalAnnouncements, totalFiles });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// --- LOG SİSTEMİ (YENİ) ---
router.get('/logs', async (req, res) => {
    try {
        // En son 100 logu getir, kullanıcı bilgilerini de al
        const logs = await Log.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .populate('user', 'username fullName');
        res.json({ logs });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// --- MESAJ İNCELEME (YENİ) ---
router.get('/messages/:user1/:user2', async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        
        // İki kullanıcı arasındaki tüm mesajları bul (Tarihe göre sıralı)
        const messages = await Message.find({
            $or: [
                { sender: user1, target: user2 },
                { sender: user2, target: user1 }
            ]
        })
        .sort({ createdAt: 1 })
        .populate('sender', 'username fullName'); // Gönderen ismini al

        res.json(messages);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Logo Yükleme
const imgDir = path.join(__dirname, '../../public/img');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imgDir),
    filename: (req, file, cb) => cb(null, 'logo.png')
});
const upload = multer({ storage: storage });

router.post('/settings/logo', upload.single('logo'), (req, res) => {
    res.json({ success: true, message: 'Logo güncellendi' });
});

module.exports = router;