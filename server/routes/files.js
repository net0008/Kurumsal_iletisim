const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const { requireAuth } = require('../middleware/auth'); // Nesne olarak al ({ requireAuth })

// Upload Klasörü Kontrolü
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Ayarları
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Türkçe karakter sorununu önlemek için safe isim
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Tüm rotalar korumalı
router.use(requireAuth);

// Sohbet İçi Dosya Yükleme
router.post('/chat-upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Dosya seçilmedi' });

        // URL (public klasöründen erişim için)
        const fileUrl = `/uploads/${req.file.filename}`;

        res.json({
            success: true,
            fileUrl: fileUrl,
            fileName: req.file.originalname,
            mimetype: req.file.mimetype
        });
    } catch (error) {
        console.error("Dosya yükleme hatası:", error);
        res.status(500).json({ message: 'Dosya yüklenemedi' });
    }
});

// Admin / Kurumsal Dosya Yükleme
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Dosya seçilmedi' });

        const newFile = await File.create({
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: `/uploads/${req.file.filename}`,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploader: req.user._id
        });

        res.json({ success: true, file: newFile });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Dosyaları Listele
router.get('/', async (req, res) => {
    try {
        const files = await File.find()
            .sort({ createdAt: -1 })
            .populate('uploader', 'username fullName');
        res.json(files);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;