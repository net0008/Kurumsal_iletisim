const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Duyuruları Listele
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

// Yeni Duyuru Ekle
router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        const announcement = await Announcement.create({
            title,
            content,
            createdBy: req.session.userId,
            isActive: true,
            createdAt: new Date()
        });

        res.json(announcement);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;