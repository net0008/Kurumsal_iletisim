// Versiyon: 1.2 (Dinamik Dosya Limiti Eklendi)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const Settings = require('../models/Settings'); // [YENİ]
const { requireAuth } = require('../middleware/auth');

// Upload Klasörü Kontrolü
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

// [YENİ] Dinamik Middleware
const dynamicUpload = (fieldName) => {
    return async (req, res, next) => {
        try {
            let settings = await Settings.findOne({ key: 'system_config' });
            const limit = settings ? settings.maxFileSize : 20 * 1024 * 1024;

            const upload = multer({ 
                limits: { fileSize: limit },
                storage: storage 
            }).single(fieldName);

            upload(req, res, (err) => {
                if (err) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({ message: `Dosya çok büyük! Limit: ${Math.floor(limit / (1024*1024))}MB` });
                    }
                    return res.status(400).json({ message: err.message });
                }
                next();
            });
        } catch (e) { next(e); }
    };
};

router.use(requireAuth);

router.get('/:userId', async (req, res) => {
    try {
        const targetId = req.params.userId;
        const myId = req.session.userId;

        await Message.updateMany(
            { sender: targetId, target: myId, read: false },
            { $set: { read: true } }
        );

        const messages = await Message.find({
            $or: [
                { sender: myId, target: targetId },
                { sender: targetId, target: myId }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
    try {
        const { recipientId, content, messageType } = req.body;
        
        const message = await Message.create({
            sender: req.session.userId,
            target: recipientId,
            content: content,
            messageType: messageType || 'text',
            read: false, 
            createdAt: new Date()
        });

        res.json(message);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. Dosya Gönder (GÜNCELLENDİ)
router.post('/file', dynamicUpload('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Dosya yok' });

        const message = await Message.create({
            sender: req.session.userId,
            target: req.body.recipientId,
            content: '', 
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