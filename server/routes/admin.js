// Versiyon: 2.2 (Toplu Silme İşlemleri Eklendi)
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
const Log = require('../models/Log');

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

// Logları Getir
router.get('/logs', async (req, res) => {
    try {
        const logs = await Log.find()
            .sort({ timestamp: -1 })
            .limit(100)
            .populate('user', 'username fullName');
        res.json({ logs });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Mesaj İnceleme
router.get('/messages/:user1/:user2', async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: user1, target: user2 },
                { sender: user2, target: user1 }
            ]
        })
        .sort({ createdAt: 1 })
        .populate('sender', 'username fullName');

        res.json(messages);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// --- YENİ: TOPLU SİLME İŞLEMLERİ ---

// 1. Tüm Mesajları Sil
router.delete('/messages/all', async (req, res) => {
    try {
        await Message.deleteMany({});
        // Socket ile istemcilere bildirim gönderilebilir (Opsiyonel)
        res.json({ success: true, message: 'Tüm mesajlar silindi.' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Tüm Duyuruları Sil
router.delete('/announcements/all', async (req, res) => {
    try {
        await Announcement.deleteMany({});
        
        // Socket ile arayüzü güncelle
        const io = req.app.get('io');
        if (io) io.emit('announcement-change');

        res.json({ success: true, message: 'Tüm duyurular silindi.' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Tüm Dosyaları Sil (Veritabanı + Disk)
router.delete('/files/all', async (req, res) => {
    try {
        // Önce tüm dosyaları bul
        const files = await File.find();
        
        // Diskten sil
        files.forEach(file => {
            const filePath = path.join(__dirname, '../uploads', file.filename);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch(e) { console.error("Dosya silme hatası:", e); }
            }
        });

        // Veritabanından sil
        await File.deleteMany({});

        // Socket ile arayüzü güncelle
        const io = req.app.get('io');
        if (io) io.emit('shared-file-change');

        res.json({ success: true, message: 'Tüm dosyalar temizlendi.' });
    } catch (err) { res.status(500).json({ message: err.message }); }
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