// Versiyon: 2.3 (Dosya Limiti Ayarı Eklendi)
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
const Settings = require('../models/Settings'); // [YENİ]

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

// --- SİSTEM AYARLARI (YENİ) ---

// Dosya Boyutu Limitini Getir
router.get('/settings/file-limit', async (req, res) => {
    try {
        let settings = await Settings.findOne({ key: 'system_config' });
        if (!settings) {
            settings = await Settings.create({ key: 'system_config' });
        }
        // Byte cinsinden MB'a çevirip gönderelim (Frontend kolaylığı için)
        const limitMB = Math.floor(settings.maxFileSize / (1024 * 1024));
        res.json({ limitMB });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// Dosya Boyutu Limitini Güncelle
router.put('/settings/file-limit', async (req, res) => {
    try {
        const { limitMB } = req.body;
        const limitBytes = parseInt(limitMB) * 1024 * 1024;
        
        if (!limitBytes || limitBytes < 1024 * 1024) { // En az 1MB olsun
            return res.status(400).json({ message: 'Geçersiz limit (Min 1MB)' });
        }

        await Settings.findOneAndUpdate(
            { key: 'system_config' },
            { maxFileSize: limitBytes, updatedAt: Date.now() },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: `Limit ${limitMB}MB olarak güncellendi.` });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

// --- LOGLAR ---
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

// --- TOPLU SİLME İŞLEMLERİ ---
router.delete('/messages/all', async (req, res) => {
    try {
        await Message.deleteMany({});
        res.json({ success: true, message: 'Tüm mesajlar silindi.' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/announcements/all', async (req, res) => {
    try {
        await Announcement.deleteMany({});
        const io = req.app.get('io');
        if (io) io.emit('announcement-change');
        res.json({ success: true, message: 'Tüm duyurular silindi.' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/files/all', async (req, res) => {
    try {
        const files = await File.find();
        files.forEach(file => {
            const filePath = path.join(__dirname, '../uploads', file.filename);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch(e) { console.error("Dosya silme hatası:", e); }
            }
        });
        await File.deleteMany({});
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