const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./config/database');
const User = require('./models/User');

// Rotalar
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const announcementRoutes = require('./routes/announcements');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Veritabanı Bağlantısı
connectDB();

// Middleware Ayarları
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Oturum (Session) Ayarları
const sessionMiddleware = session({
  secret: 'corporate-chat-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, 
    secure: false, // Localhost için false olmalı
    httpOnly: true
  }
});

app.use(sessionMiddleware);

// Socket.io ile Session Paylaşımı
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Rota Tanımlamaları
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io Bağlantı Mantığı
io.on('connection', (socket) => {
  // Kullanıcı Online Oldu
  socket.on('user-online', async (userId) => {
    if(!userId) return;
    socket.userId = userId;
    
    // Veritabanında online yap
    await User.findByIdAndUpdate(userId, { isOnline: true, lastActivity: Date.now() });
    
    // Herkese duyur
    io.emit('user-status-change', { userId, isOnline: true });
  });

  // Mesaj İletimi
  socket.on('send-message', (data) => {
    io.emit('new-message', data);
  });

  // Bağlantı Koptu
  socket.on('disconnect', async () => {
    if (socket.userId) {
      // Veritabanında offline yap
      await User.findByIdAndUpdate(socket.userId, { isOnline: false });
      
      // Herkese duyur
      io.emit('user-status-change', { userId: socket.userId, isOnline: false });
    }
  });
});

// === SİSTEM BAŞLANGIÇ TEMİZLİĞİ ===
async function resetSystemStatus() {
    try {
        // Sunucu her başladığında herkesi offline yap (Hayalet kullanıcıları önler)
        await User.updateMany({}, { isOnline: false });
        console.log("🧹 Sistem başlangıcı: Tüm kullanıcılar 'Offline' durumuna getirildi.");

        // Admin kontrolü
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'admin',
                password: 'admin123', 
                firstName: 'Sistem',
                lastName: 'Yöneticisi',
                title: 'Yönetici',
                isAdmin: true,
                role: 'admin',
                firstLogin: false
            });
            console.log('✅ Varsayılan admin hesabı oluşturuldu.');
        }
    } catch (err) { console.error('Başlangıç hatası:', err); }
}

// Sunucuyu Başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
  await resetSystemStatus();
});