// Versiyon: 1.2
// Değişiklikler: Duyuru ekleme/silme işlemlerinde Socket.io ile anlık bildirim gönderimi eklendi.

const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Listele
router.get('/', async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username fullName');
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Ekle (Anlık Bildirimli)
router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        let announcement = await Announcement.create({
            title,
            content,
            createdBy: req.session.userId,
            isActive: true,
            createdAt: new Date()
        });
        
        await announcement.populate('createdBy', 'username fullName');

        // --- SOCKET BİLDİRİMİ ---
        const io = req.app.get('io');
        if (io) {
            io.emit('announcement-change'); 
        }
        // ------------------------

        res.json(announcement);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Sil (Anlık Bildirimli)
router.delete('/:id', async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) return res.status(404).json({ message: 'Bulunamadı' });

        const isCreator = announcement.createdBy._id.toString() === req.user._id.toString();
        const isAdmin = req.user.isAdmin === true || req.user.role === 'admin';

        if (!isCreator && !isAdmin) {
            return res.status(403).json({ message: 'Yetkisiz işlem.' });
        }

        await Announcement.findByIdAndDelete(req.params.id);

        // --- SOCKET BİLDİRİMİ ---
        const io = req.app.get('io');
        if (io) {
            io.emit('announcement-change');
        }
        // ------------------------

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;