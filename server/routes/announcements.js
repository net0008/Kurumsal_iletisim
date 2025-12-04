// Versiyon: 1.5 (Debug Modu)
const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Listeleme
router.get('/', async (req, res) => {
    try {
        const announcements = await Announcement.find().sort({ createdAt: -1 }).populate('createdBy', 'username fullName');
        res.json(announcements);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Ekleme
router.post('/', async (req, res) => {
    try {
        let announcement = await Announcement.create({
            title: req.body.title,
            content: req.body.content,
            createdBy: req.session.userId,
            isActive: true,
            createdAt: new Date()
        });
        announcement = await announcement.populate('createdBy', 'username fullName');

        // SOCKET TETİKLEME
        const io = req.app.get('io');
        if (io) {
            console.log("📢 SERVER: Duyuru eklendi, 'announcement-change' sinyali gönderiliyor..."); 
            io.emit('announcement-change'); 
        } else {
            console.error("❌ SERVER HATASI: IO nesnesi bulunamadı!");
        }

        res.json(announcement);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Silme
router.delete('/:id', async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) return res.status(404).json({ message: 'Bulunamadı' });

        const isCreator = announcement.createdBy.toString() === req.user._id.toString();
        const isAdmin = req.user.isAdmin === true || req.user.role === 'admin';

        if (!isCreator && !isAdmin) return res.status(403).json({ message: 'Yetkiniz yok.' });

        await Announcement.findByIdAndDelete(req.params.id);

        // SOCKET TETİKLEME
        const io = req.app.get('io');
        if (io) {
            console.log("📢 SERVER: Duyuru silindi, 'announcement-change' sinyali gönderiliyor..."); 
            io.emit('announcement-change');
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;