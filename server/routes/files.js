// Versiyon: 1.1 (Ortak Dosya Alanı Özelliği)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const { requireAuth } = require('../middleware/auth');

// Upload Klasörü
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer Ayarları
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Türkçe karakter ve boşlukları temizleyerek güvenli isim oluştur
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + safeName);
    }
});
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 }, storage: storage }); // 20MB Limit

router.use(requireAuth);

// 1. Dosyaları Listele (Paylaşım Alanı İçin)
router.get('/shared', async (req, res) => {
    try {
        const files = await File.find()
            .sort({ createdAt: -1 }) // En yeni en üstte
            .populate('uploader', 'username fullName');
        res.json(files);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Ortak Alana Dosya Yükle
router.post('/shared', upload.single('file'), async (req, res) => {
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

        // Socket Bildirimi (Anlık Güncelleme)
        const io = req.app.get('io');
        if (io) io.emit('shared-file-change');

        res.json(newFile);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Dosya Sil (Sadece Admin veya Yükleyen)
router.delete('/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'Dosya bulunamadı' });

        const isOwner = file.uploader.toString() === req.user._id.toString();
        const isAdmin = req.user.isAdmin === true || req.user.role === 'admin';

        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Yetkiniz yok' });

        // Veritabanından sil
        await File.findByIdAndDelete(req.params.id);

        // Fiziksel dosyayı sil (Sunucuda yer kaplamasın)
        const filePath = path.join(__dirname, '../uploads', file.filename);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch(e) { console.error("Dosya silinemedi:", e); }
        }

        // Socket Bildirimi
        const io = req.app.get('io');
        if (io) io.emit('shared-file-change');

        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Sohbet İçi Resim Yükleme (Eski özellik)
router.post('/chat-upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Dosya yok' });
    res.json({
        success: true,
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        mimetype: req.file.mimetype
    });
});

module.exports = router;