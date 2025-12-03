const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const { requireAuth } = require('../middleware/auth');
const isAdmin = require('../middleware/admin');

router.use(requireAuth);

// Listeleme (ÖZEL SIRALAMA: Online > Unvan > İsim)
router.get('/', async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort({ 
                isOnline: -1,   // 1. Öncelik: Online olanlar (true) en üstte
                titleOrder: 1,  // 2. Öncelik: Unvan sırası (Küçük sayı = Üst rütbe)
                firstName: 1,   // 3. Öncelik: İsim alfabetik
                lastName: 1     // 4. Öncelik: Soyad alfabetik
            });
        
        // Okunmamış Mesaj Sayıları
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

// --- Admin İşlemleri ---
router.post('/add', isAdmin, async (req, res) => {
    try {
        const { username, firstName, lastName, title, titleOrder } = req.body;
        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash('1234', salt);
        
        await User.create({
            username, firstName, lastName, 
            fullName: `${firstName} ${lastName}`, 
            title, titleOrder: parseInt(titleOrder)||100, 
            password 
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
        
        const newUsers = users
            .filter(u => !existingNames.includes(u.username))
            .map(u => ({ ...u, password: bcrypt.hashSync('1234', salt) }));

        if(newUsers.length > 0) await User.insertMany(newUsers);
        res.json({ count: newUsers.length });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', isAdmin, async (req, res) => {
    try {
        if(req.params.id === req.user._id.toString()) return res.status(400).json({message:'Kendini silemezsin'});
        await User.findByIdAndDelete(req.params.id);
        await Message.deleteMany({ $or: [{sender: req.params.id}, {target: req.params.id}] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/delete-all', isAdmin, async (req, res) => {
    try {
        const result = await User.deleteMany({ _id: { $ne: req.user._id }, isAdmin: false });
        res.json({ count: result.deletedCount });
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