// Versiyon: 1.1
// Değişiklikler: Silme rotası eklendi, ekleme herkese açıldı, silme yetkisi (sahibi/admin) eklendi.

const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireAuth } = require('../middleware/auth');

// Tüm rotalar için oturum kontrolü
router.use(requireAuth);

// Duyuruları Listele
router.get('/', async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username fullName'); // Yazarın ismini getir
        res.json(announcements);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Yeni Duyuru Ekle (Herkes ekleyebilir)
router.post('/', async (req, res) => {
    try {
        const { title, content } = req.body;
        
        let announcement = await Announcement.create({
            title,
            content,
            createdBy: req.session.userId, // Oturum açan kişi yazar
            isActive: true,
            createdAt: new Date()
        });
        
        // Frontend'e geri dönmeden önce yazar bilgisini doldur
        announcement = await announcement.populate('createdBy', 'username fullName');

        // Socket.io ile herkese bildir
        const io = req.app.get('io');
        if (io) io.emit('force-reload-announcements');

        res.json(announcement);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Duyuru Sil (Sadece Sahibi veya Admin)
router.delete('/:id', async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) return res.status(404).json({ message: 'Bulunamadı' });

        // Yetki Kontrolü: Ekleyen kişi mi VEYA Admin mi?
        // req.user, auth middleware'inden geliyor (user objesi orada set ediliyor)
        const isCreator = announcement.createdBy._id.toString() === req.user._id.toString();
        const isAdmin = req.user.isAdmin === true || req.user.role === 'admin';

        if (!isCreator && !isAdmin) {
            return res.status(403).json({ message: 'Bu duyuruyu silmeye yetkiniz yok.' });
        }

        await Announcement.findByIdAndDelete(req.params.id);

        // Socket.io ile herkese bildir
        const io = req.app.get('io');
        if (io) io.emit('force-reload-announcements');

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;