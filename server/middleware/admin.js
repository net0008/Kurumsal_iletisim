const isAdmin = (req, res, next) => {
    // Kullanıcı oturumu var mı ve admin mi?
    // req.user objesi auth.js middleware'inden gelir.
    if (req.user && (req.user.isAdmin === true || req.user.role === 'admin')) {
        return next(); // Yetki var, geç
    }
    
    // Yetki yoksa hata döndür
    console.log("Admin yetkisi reddedildi. Kullanıcı:", req.user ? req.user.username : "Yok");
    return res.status(403).json({ message: 'Bu sayfaya erişim yetkiniz yok' });
};

module.exports = isAdmin;