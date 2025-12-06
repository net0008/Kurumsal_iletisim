// Versiyon: 2.4 (Ses Ayarı Endpoint'i Eklendi)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

// Upload Ayarları (Avatar İçin)
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
        const uniqueSuffix = 'avatar-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 }, storage: storage }); // 5MB Limit

router.use(requireAuth);

// Kullanıcıları Listele
router.get('/', async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ isOnline: -1, titleOrder: 1, firstName: 1 });
        
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            const userObj = user.toObject();
            if (req.session.userId) {
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
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- PROFİL İŞLEMLERİ ---

// 1. Profil Fotoğrafı Yükle
router.post('/profile/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Resim seçilmedi' });
        
        const imageUrl = `/uploads/${req.file.filename}`;
        await User.findByIdAndUpdate(req.session.userId, { profileImage: imageUrl });
        
        res.json({ success: true, imageUrl });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 2. Tema Güncelle
router.put('/profile/theme', async (req, res) => {
    try {
        const { theme } = req.body;
        if (!['light', 'dark', 'gold', 'teal'].includes(theme)) {
            return res.status(400).json({ message: 'Geçersiz tema' });
        }
        await User.findByIdAndUpdate(req.session.userId, { theme });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 3. [YENİ] Sesli Bildirim Ayarı Güncelle
router.put('/profile/notification-sound', async (req, res) => {
    try {
        const { enabled } = req.body;
        await User.findByIdAndUpdate(req.session.userId, { notificationSound: enabled });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// --- ADMIN İŞLEMLERİ ---

router.post('/add', isAdmin, async (req, res) => {
    try {
        const { username, firstName, lastName, title, titleOrder } = req.body;
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash('1234', salt);
        
        await User.create({
            username, firstName, lastName, fullName: `${firstName} ${lastName}`, 
            title, titleOrder: parseInt(titleOrder) || 100, password 
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/bulk', isAdmin, async (req, res) => {
    try {
        const { users } = req.body;
        const salt = await bcrypt.genSalt(10);
        const existing = await User.find({ username: { $in: users.map(u => u.username) }});
        const existingNames = existing.map(u => u.username);
        
        const newUsers = users.filter(u => !existingNames.includes(u.username)).map(u => ({
            ...u, titleOrder: parseInt(u.titleOrder) || 100, password: bcrypt.hashSync('1234', salt)
        }));

        if(newUsers.length > 0) await User.insertMany(newUsers);
        res.json({ count: newUsers.length });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        if(req.params.id === req.user._id.toString()) return res.status(400).json({message: 'Kendinizi silemezsiniz'});
        await User.findByIdAndDelete(req.params.id);
        await Message.deleteMany({ $or: [{sender: req.params.id}, {target: req.params.id}] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/reset-password/:id', isAdmin, async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('1234', salt);
        await User.findByIdAndUpdate(req.params.id, { password: hash, firstLogin: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;