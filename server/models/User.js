const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    fullName: { type: String, default: '' },
    title: { type: String, default: 'Personel' },
    titleOrder: { type: Number, default: 100 },
    isAdmin: { type: Boolean, default: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isOnline: { type: Boolean, default: false },
    lastActivity: { type: Date, default: Date.now },
    
    // YENİ EKLENEN ALANLAR
    firstLogin: { type: Boolean, default: true }, // İlk girişte şifre değişimi için
    agreedToTerms: { type: Boolean, default: false }, // Sözleşme onayı için
    
    createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) { next(err); }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);