// Versiyon: 1.2
// Değişiklikler: Socket.io 'io' nesnesi global olarak erişilebilir hale getirildi.

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

// Veritabanı
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
const sessionMiddleware = session({
  secret: 'corporate-chat-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, 
    secure: false, 
    httpOnly: true
  }
});

app.use(sessionMiddleware);

// Socket Session
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// === KRİTİK: IO NESNESİNİ PAYLAŞ ===
app.set('io', io); 
// ===================================

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

// Socket Mantığı
io.on('connection', (socket) => {
  socket.on('user-online', async (userId) => {
    if(!userId) return;
    socket.userId = userId;
    await User.findByIdAndUpdate(userId, { isOnline: true, lastActivity: Date.now() });
    io.emit('user-status-change', { userId, isOnline: true });
  });

  socket.on('send-message', (data) => {
    io.emit('new-message', data);
  });

  socket.on('disconnect', async () => {
    if (socket.userId) {
      await User.findByIdAndUpdate(socket.userId, { isOnline: false });
      io.emit('user-status-change', { userId: socket.userId, isOnline: false });
    }
  });
});

// Başlangıç Temizliği
async function resetSystemStatus() {
    try {
        await User.updateMany({}, { isOnline: false });
        console.log("✅ Sistem v1.2 Başlatıldı");
        
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
        }
    } catch (err) { console.error(err); }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
  await resetSystemStatus();
});