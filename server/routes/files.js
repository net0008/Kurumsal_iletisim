// Versiyon: 1.2 (Fix: Türkçe Karakter Sorunu Düzeltildi)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const { requireAuth } = require('../middleware/auth');

// Upload Klasörü Kontrolü
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// --- MULTER AYARLARI ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Disk üzerine kaydederken Türkçe karakterleri ve riskli işaretleri temizle (Güvenlik için)
        // Bu sadece sunucudaki dosya adı içindir, veritabanında orijinalini tutacağız.
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + safeName);
    }
});

const upload = multer({ 
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB Limit
    storage: storage 
});

router.use(requireAuth);

// 1. Dosyaları Listele
router.get('/shared', async (req, res) => {
    try {
        const files = await File.find()
            .sort({ createdAt: -1 })
            .populate('uploader', 'username fullName');
        res.json(files);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Ortak Alana Dosya Yükle (DÜZELTME BURADA YAPILDI)
router.post('/shared', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Dosya seçilmedi' });

        // --- TÜRKÇE KARAKTER DÜZELTME ---
        // Multer bazen dosya isimlerini Latin1 (ISO-8859-1) olarak okur.
        // Bunu UTF-8'e çevirerek "İ, ş, ğ" gibi harfleri düzeltiyoruz.
        let fixedOriginalName = req.file.originalname;
        try {
            fixedOriginalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
        } catch (e) {
            console.log("Karakter dönüştürme hatası, orijinal isim kullanılıyor.");
        }
        // -------------------------------

        const newFile = await File.create({
            filename: req.file.filename, // Diskteki güvenli isim (örn: 12345_tutanak.pdf)
            originalName: fixedOriginalName, // Ekranda görünecek Türkçe isim (örn: TUTANAKTIR.pdf)
            path: `/uploads/${req.file.filename}`,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploader: req.user._id
        });

        // Socket Bildirimi
        const io = req.app.get('io');
        if (io) io.emit('shared-file-change');

        res.json(newFile);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Dosya Sil
router.delete('/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ message: 'Dosya bulunamadı' });

        const isOwner = file.uploader.toString() === req.user._id.toString();
        const isAdmin = req.user.isAdmin === true || req.user.role === 'admin';

        if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Yetkiniz yok' });

        await File.findByIdAndDelete(req.params.id);

        const filePath = path.join(__dirname, '../uploads', file.filename);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch(e) { console.error("Fiziksel silme hatası:", e); }
        }

        const io = req.app.get('io');
        if (io) io.emit('shared-file-change');

        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Sohbet İçi Resim Yükleme (Buraya da düzeltme eklendi)
router.post('/chat-upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Dosya yok' });

    // Türkçe karakter düzeltme
    let fixedName = req.file.originalname;
    try { fixedName = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); } catch(e){}

    res.json({
        success: true,
        fileUrl: `/uploads/${req.file.filename}`,
        fileName: fixedName,
        mimetype: req.file.mimetype
    });
});

module.exports = router;