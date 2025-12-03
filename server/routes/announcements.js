// Versiyon: 1.1
// Değişiklikler: 
// - Duyuru ekleme herkese açıldı.
// - Silme yetkisi kontrolü eklendi (Sadece sahibi veya admin).
// - Yazar bilgisi (populate) eklendi.

const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireAuth } = require('../middleware/auth');

// Tüm rotalar oturum açmış kullanıcılar içindir
router.use(requireAuth);

// Duyuruları Listele
router.get('/', async (req, res) => {
    try {
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username fullName'); // Yazarın adını getir
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
            createdBy: req.session.userId, // Oturum açan kişi
            isActive: true,
            createdAt: new Date()
        });
        
        // Frontend'de hemen ismini göstermek için populate yapıyoruz
        announcement = await announcement.populate('createdBy', 'username fullName');

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

        // Yetki Kontrolü
        // req.user nesnesi auth middleware'inden gelir
        const isCreator = announcement.createdBy._id.toString() === req.user._id.toString();
        const isAdmin = req.user.isAdmin === true || req.user.role === 'admin';

        if (!isCreator && !isAdmin) {
            return res.status(403).json({ message: 'Bu duyuruyu silmeye yetkiniz yok.' });
        }

        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;