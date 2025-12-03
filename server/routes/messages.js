const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');

// Upload Klasörü Kontrolü
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer Ayarları (Dosya Yükleme İçin)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

router.use(requireAuth);

// 1. Mesaj Geçmişini Getir ve OKUNDU YAP (Kritik Kısım)
router.get('/:userId', async (req, res) => {
    try {
        const targetId = req.params.userId; // Sohbet edilen kişi
        const myId = req.session.userId;    // Ben

        // ADIM A: Karşı taraftan bana gelen ve henüz okunmamış mesajları bulup "okundu" yap
        await Message.updateMany(
            { sender: targetId, target: myId, read: false },
            { $set: { read: true } }
        );

        // ADIM B: Mesaj geçmişini getir (Eskiden yeniye doğru)
        const messages = await Message.find({
            $or: [
                { sender: myId, target: targetId },
                { sender: targetId, target: myId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Yeni Mesaj Gönder (Metin)
router.post('/', async (req, res) => {
    try {
        const { recipientId, content, messageType } = req.body;
        
        const message = await Message.create({
            sender: req.session.userId,
            target: recipientId,
            content: content,
            messageType: messageType || 'text',
            read: false, // İlk başta okunmadı
            createdAt: new Date()
        });

        res.json(message);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Dosya Gönder
router.post('/file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Dosya yok' });

        const message = await Message.create({
            sender: req.session.userId,
            target: req.body.recipientId,
            content: '', // Dosya mesajının içeriği boş olabilir
            messageType: 'file',
            fileUrl: `/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            mimetype: req.file.mimetype,
            read: false,
            createdAt: new Date()
        });

        res.json(message);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;