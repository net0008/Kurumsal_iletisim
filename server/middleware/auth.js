const User = require('../models/User');

const requireAuth = async (req, res, next) => {
    // Session kontrolü
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: 'Oturum açmanız gerekiyor' });
    }

    try {
        // Kullanıcıyı bul ve şifre hariç bilgilerini al
        const user = await User.findById(req.session.userId).select('-password');
        
        if (!user) {
            req.session.destroy();
            return res.status(401).json({ message: 'Kullanıcı bulunamadı' });
        }

        // Kullanıcı bilgisini isteğe ekle (Diğer dosyalar bunu kullanır)
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth Middleware Hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası' });
    }
};

// DİKKAT: Burada süslü parantez {} VAR.
module.exports = { requireAuth };