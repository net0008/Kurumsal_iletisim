const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Message = require('../models/Message');

// Giriş İşlemi
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Kullanıcı adı veya şifre hatalı' });
        }

        // Oturumu başlat
        req.session.userId = user._id;

        // Yönlendirme Kontrolü (Öncelik Sırasına Göre)
        let nextStep = 'dashboard';
        
        // 1. Öncelik: Sözleşme onayı yoksa
        if (!user.agreedToTerms) {
            nextStep = 'terms';
        } 
        // 2. Öncelik: İlk giriş ise (Sözleşmeyi onaylamış olsa bile)
        else if (user.firstLogin !== false) {
            nextStep = 'change_password';
        }

        res.json({ success: true, nextStep });
    } catch (error) { 
        console.error("Login hatası:", error);
        res.status(500).json({ message: 'Hata oluştu' }); 
    }
});

// Şifremi Unuttum (Yöneticiye Bildirim)
router.post('/forgot-password', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });

        const admin = await User.findOne({ isAdmin: true });
        if (!admin) return res.status(500).json({ message: 'Yönetici bulunamadı.' });

        await Message.create({
            sender: user._id,
            target: admin._id,
            content: `⚠️ Şifremi unuttum, sıfırlama talep ediyorum. (${user.fullName || user.username})`,
            messageType: 'text',
            read: false,
            createdAt: new Date()
        });

        res.json({ success: true, message: 'Yöneticiye bildirildi.' });
    } catch (error) { res.status(500).json({ message: 'Hata oluştu.' }); }
});

// Sözleşme Onaylama
router.post('/accept-terms', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Oturum yok' });
    try {
        await User.findByIdAndUpdate(req.session.userId, { agreedToTerms: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Şifre Değiştirme
router.post('/change-password', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Oturum yok' });
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) return res.status(400).json({ message: 'Şifre çok kısa' });

        const user = await User.findById(req.session.userId);
        user.password = newPassword; // Model hook'u şifreleyecek
        user.firstLogin = false;     // Artık ilk giriş değil
        await user.save();

        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Mevcut Kullanıcı Bilgisi
router.get('/me', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Giriş yok' });
    const user = await User.findById(req.session.userId).select('-password');
    res.json({ user });
});

// Çıkış Yap
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

module.exports = router;