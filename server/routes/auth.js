// Versiyon: 1.2 (Log Kaydı Eklendi)
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');
const Log = require('../models/Log'); // Log modelini çağır

// Yardımcı Fonksiyon: Log Ekle
async function createLog(userId, action, req) {
    try {
        await Log.create({
            user: userId,
            action: action,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });
    } catch(e) { console.error("Log hatası:", e); }
}

// Giriş İşlemi
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Kullanıcı adı veya şifre hatalı' });
        }

        req.session.userId = user._id;
        
        // LOG: Giriş
        await createLog(user._id, 'login', req);

        let nextStep = 'dashboard';
        if (!user.agreedToTerms) nextStep = 'terms';
        else if (user.firstLogin !== false) nextStep = 'change_password';

        res.json({ success: true, nextStep });
    } catch (error) { res.status(500).json({ message: 'Hata oluştu' }); }
});

// Şifre Değiştirme
router.post('/change-password', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Oturum yok' });
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) return res.status(400).json({ message: 'Şifre çok kısa' });

        const user = await User.findById(req.session.userId);
        user.password = newPassword;
        user.firstLogin = false;
        await user.save();

        // LOG: Şifre Değiştirme
        await createLog(user._id, 'password_change', req);

        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Sözleşme Onayı
router.post('/accept-terms', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Oturum yok' });
    try {
        await User.findByIdAndUpdate(req.session.userId, { agreedToTerms: true });
        
        // LOG: Sözleşme Onayı
        await createLog(req.session.userId, 'terms_accepted', req);
        
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Şifremi Unuttum
router.post('/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

        const admin = await User.findOne({ isAdmin: true });
        if (admin) {
            await Message.create({
                sender: user._id,
                target: admin._id,
                content: `⚠️ Şifremi unuttum, sıfırlama talep ediyorum. (${user.fullName || user.username})`,
                read: false
            });
        }
        res.json({ success: true, message: 'Bildirildi.' });
    } catch (error) { res.status(500).json({ message: 'Hata oluştu.' }); }
});

// Kullanıcı Bilgisi
router.get('/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Giriş yok' });
    const user = await User.findById(req.session.userId).select('-password');
    res.json({ user });
});

// Çıkış Yap
router.post('/logout', async (req, res) => {
    if(req.session.userId) {
        // LOG: Çıkış
        await createLog(req.session.userId, 'logout', req);
    }
    req.session.destroy();
    res.json({ success: true });
});

module.exports = router;