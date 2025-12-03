// Versiyon: 1.1
// Tarih: 03.12.2025
// Değişiklikler:
// - Kullanıcı sıralama kriteri güncellendi: Önce Online > Sonra Sıra No (titleOrder) > Sonra İsim.
// - Okunmamış mesaj sayısı hesaplama mantığı korundu.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

router.use(requireAuth);

// Kullanıcıları Listele
router.get('/', async (req, res) => {
    try {
        const users = await User.find()
            .select('-password') // Şifreleri gönderme
            .sort({ 
                isOnline: -1,   // 1. ÖNCELİK: Online olanlar en üstte (true > false)
                titleOrder: 1,  // 2. ÖNCELİK: Sıra Numarası (1'den 69'a doğru artan)
                firstName: 1,   // 3. ÖNCELİK: İsim Alfabetik (Sıra numarası aynıysa)
                lastName: 1     // 4. ÖNCELİK: Soyad Alfabetik
            });
        
        // Her kullanıcı için okunmamış mesaj sayısını hesapla
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            const userObj = user.toObject();
            if (req.session.userId) {
                // Bana gelen (target=benimID) ve gönderen=o_kisi olan ve okunmamış mesajlar
                const count = await Message.countDocuments({
                    sender: user._id,
                    target: req.session.userId,
                    read: false
                });
                userObj.unreadCount = count;
            }
            return userObj;
        }));

        res.json(usersWithCounts);
    } catch (err) { 
        console.error("Liste hatası:", err);
        res.status(500).json({ message: err.message }); 
    }
});

// --- Admin İşlemleri ---

// Tek Kullanıcı Ekle
router.post('/add', isAdmin, async (req, res) => {
    try {
        const { username, firstName, lastName, title, titleOrder } = req.body;
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash('1234', salt);
        
        await User.create({
            username, 
            firstName, 
            lastName, 
            fullName: `${firstName} ${lastName}`, 
            title, 
            titleOrder: parseInt(titleOrder) || 100, // Sıra no gelmezse 100 atar
            password 
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Toplu Kullanıcı Ekle
router.post('/bulk', isAdmin, async (req, res) => {
    try {
        const { users } = req.body;
        const salt = await bcrypt.genSalt(10);
        
        // Mevcut kullanıcıları bul (çakışmayı önlemek için)
        const existing = await User.find({ username: { $in: users.map(u => u.username) }});
        const existingNames = existing.map(u => u.username);
        
        const newUsers = users
            .filter(u => !existingNames.includes(u.username))
            .map(u => ({
                ...u,
                // Sıra numarasını (titleOrder) sayıya çeviriyoruz, yoksa 100 yapıyoruz
                titleOrder: parseInt(u.titleOrder) || 100,
                password: bcrypt.hashSync('1234', salt)
            }));

        if(newUsers.length > 0) await User.insertMany(newUsers);
        res.json({ count: newUsers.length });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Tüm Kullanıcıları Sil
router.delete('/delete-all', isAdmin, async (req, res) => {
    try {
        const result = await User.deleteMany({ _id: { $ne: req.user._id }, isAdmin: false });
        res.json({ count: result.deletedCount });
    } catch (err) { res.status(500).json({ message: err.message }); }
});


// Tek Kullanıcı Sil
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        if(req.params.id === req.user._id.toString()) {
            return res.status(400).json({message: 'Kendinizi silemezsiniz'});
        }
        await User.findByIdAndDelete(req.params.id);
        await Message.deleteMany({ $or: [{sender: req.params.id}, {target: req.params.id}] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Şifre Sıfırla
router.post('/reset-password/:id', isAdmin, async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('1234', salt);
        await User.findByIdAndUpdate(req.params.id, { password: hash, firstLogin: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;