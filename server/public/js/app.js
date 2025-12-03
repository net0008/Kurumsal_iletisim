const socket = io();
let currentUser = null;
let selectedUser = null;

// ==========================================
// 1. BAŞLANGIÇ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await getCurrentUser();
        initListeners();
        loadUsers(); // İlk yükleme
        loadAnnouncements();
    } catch(e) { 
        // Eğer hata varsa (örn: oturum yoksa) login sayfasına at
        if(!window.location.href.includes('login')) window.location.href = '/login.html'; 
    }
});

async function getCurrentUser() {
    const res = await fetch('/api/auth/me');
    if(!res.ok) throw new Error();
    const data = await res.json();
    currentUser = data.user;
    
    // Üst barı güncelle
    const userNameDisplay = document.getElementById('currentUserName');
    if (userNameDisplay) userNameDisplay.innerText = currentUser.fullName || currentUser.username;
    
    // Admin butonlarını göster
    if(currentUser.isAdmin) {
        const adminBtn = document.getElementById('adminBtn');
        const addAnnBtn = document.getElementById('addAnnouncementBtn');
        if(adminBtn) adminBtn.style.display = 'block';
        if(addAnnBtn) addAnnBtn.style.display = 'block';
    }
    
    // Sunucuya "Ben geldim" de
    socket.emit('user-online', currentUser.id);
}

// ==========================================
// 2. OLAY DİNLEYİCİLERİ
// ==========================================
function initListeners() {
    // Mesaj Gönderme
    const send = () => sendMessage();
    const sendBtn = document.getElementById('sendMessageBtn');
    const msgInput = document.getElementById('messageInput');

    if(sendBtn) sendBtn.addEventListener('click', send);
    if(msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                send(); 
            }
        });
    }

    // Dosya Yükleme
    const fileInput = document.getElementById('chatFileInput');
    if(fileInput) fileInput.addEventListener('change', uploadFile);

    // Duyuru Modalı
    const modal = document.getElementById('announcementModal');
    const addAnnBtn = document.getElementById('addAnnouncementBtn');
    if(addAnnBtn) addAnnBtn.addEventListener('click', () => modal.classList.add('active'));
    
    window.closeModal = (id) => document.getElementById(id).classList.remove('active');
    
    // Çıkış
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    // Sohbeti Kapat (Mobil/Tablet için)
    const closeChatBtn = document.getElementById('closeChatBtn');
    if(closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            document.getElementById('chatWindow').style.display = 'none';
            document.getElementById('defaultView').style.display = 'flex';
            selectedUser = null;
            loadUsers();
        });
    }
}

// ==========================================
// 3. KULLANICI LİSTESİ & BADGE YÖNETİMİ
// ==========================================
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const list = document.getElementById('userList');
        
        if(!list) return;

        list.innerHTML = users.filter(u => u._id !== currentUser.id).map(user => {
            const isActive = selectedUser && selectedUser._id === user._id ? 'active' : '';
            const initial = (user.firstName?.[0] || user.username[0]).toUpperCase();
            const statusDot = user.isOnline ? '<div class="status-dot online"></div>' : '';
            
            // Eğer o kişiyle konuşmuyorsak ve okunmamış mesaj varsa badge göster
            const showBadge = user.unreadCount > 0 && (!selectedUser || selectedUser._id !== user._id);
            const badgeHtml = showBadge 
                ? `<div class="unread-badge" id="badge-${user._id}">${user.unreadCount}</div>` 
                : `<div class="unread-badge" id="badge-${user._id}" style="display:none">0</div>`;

            return `
            <div class="user-item ${isActive}" 
                 id="user-${user._id}" 
                 onclick='selectUser(${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                <div class="avatar">${initial}${statusDot}</div>
                <div class="user-info">
                    <div class="user-details">
                        <div class="user-fullname">${user.fullName || user.username}</div>
                        <div class="user-title">${user.title || ''}</div>
                    </div>
                    ${badgeHtml}
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.error(e); }
}

// ==========================================
// 4. SOHBET SEÇİMİ VE MESAJLAR
// ==========================================
async function selectUser(user) {
    selectedUser = user;
    
    // 1. Görsel olarak badge'i (kırmızı topu) hemen gizle
    const badge = document.getElementById(`badge-${user._id}`);
    if(badge) { badge.style.display = 'none'; badge.innerText = '0'; }
    
    // 2. Listede aktif olanı işaretle
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-${user._id}`)?.classList.add('active');

    // 3. Görünümü Değiştir
    document.getElementById('defaultView').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'flex';
    document.getElementById('chatUserName').innerText = user.fullName || user.username;
    
    const statusText = user.isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
    document.getElementById('chatUserStatus').innerText = statusText;
    document.getElementById('chatUserStatus').style.color = user.isOnline ? '#2ecc71' : '#95a5a6';

    // 4. Mesajları Çek (Backend bu sırada okundu yapacak)
    try {
        const res = await fetch(`/api/messages/${user._id}`);
        const msgs = await res.json();
        
        const area = document.getElementById('chatMessages');
        area.innerHTML = '';
        
        if (msgs.length === 0) area.innerHTML = '<div style="text-align:center; color:#ccc; margin-top:20px;">Henüz mesaj yok. Merhaba de! 👋</div>';
        else msgs.forEach(addMessageUI);
        
        // ==> SCROLL FIX: En alta kaydır <==
        scrollToBottom();
        
        // 5. Listeyi sessizce yenile (Veritabanındaki "okunmamış: 0" bilgisini almak için)
        // Böylece sayfa yenilenince badge geri gelmez.
        loadUsers(); 

    } catch(e) { console.error(e); }
}

function scrollToBottom() {
    const area = document.getElementById('chatMessages');
    // DOM'un render edilmesi için minik bir gecikme
    setTimeout(() => {
        area.scrollTop = area.scrollHeight;
    }, 50);
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if(!content || !selectedUser) return;

    try {
        const res = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId: selectedUser._id, content })
        });
        const msg = await res.json();
        socket.emit('send-message', { ...msg, to: selectedUser._id });
        addMessageUI(msg);
        input.value = '';
        scrollToBottom();
    } catch (e) { console.error(e); }
}

async function uploadFile() {
    const input = document.getElementById('chatFileInput');
    const file = input.files[0];
    if(!file || !selectedUser) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipientId', selectedUser._id);

    const progress = document.getElementById('uploadProgress');
    if(progress) progress.style.display = 'block';

    try {
        const res = await fetch('/api/messages/file', { method: 'POST', body: formData });
        if(progress) progress.style.display = 'none';
        
        if(res.ok) {
            const msg = await res.json();
            socket.emit('send-message', { ...msg, to: selectedUser._id });
            addMessageUI(msg);
            scrollToBottom();
        } else { alert('Hata'); }
    } catch(e) { 
        if(progress) progress.style.display = 'none';
        alert('Hata'); 
    }
    input.value = '';
}

function addMessageUI(msg) {
    const area = document.getElementById('chatMessages');
    // "Henüz mesaj yok" yazısını kaldır
    if(area.innerHTML.includes('Henüz mesaj yok')) area.innerHTML = '';

    const isMe = msg.sender === currentUser.id || msg.sender._id === currentUser.id;
    let content = msg.content;
    
    if(msg.messageType === 'file') {
        if(msg.mimetype?.startsWith('image')) {
            content = `<a href="${msg.fileUrl}" target="_blank">
                        <img src="${msg.fileUrl}" style="max-width:200px; border-radius:5px; border:1px solid #ddd;">
                       </a>`;
        } else {
            content = `<a href="${msg.fileUrl}" target="_blank" style="color:inherit; text-decoration:none; display:flex; align-items:center; gap:5px; background:rgba(0,0,0,0.05); padding:5px 10px; border-radius:5px;">
                        <i class="fas fa-file-download"></i> <span style="text-decoration:underline;">${msg.fileName}</span>
                       </a>`;
        }
    }

    const div = document.createElement('div');
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    div.innerHTML = `
        ${content}
        <div class="message-time">
            ${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            ${isMe ? '<i class="fas fa-check" style="font-size:0.6rem; margin-left:3px;"></i>' : ''}
        </div>
    `;
    area.appendChild(div);
}

// ==========================================
// 5. DUYURULAR
// ==========================================
async function loadAnnouncements() {
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        const list = document.getElementById('announcementList');
        if(!list) return;

        if (data.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:20px; color:#999; font-size:0.9rem;">Henüz duyuru yok.</div>';
            return;
        }

        list.innerHTML = data.map(ann => `
            <div class="announcement-card">
                <div class="announcement-title">${ann.title}</div>
                <div class="announcement-text">${ann.content}</div>
                <div class="announcement-date">${new Date(ann.createdAt).toLocaleDateString()}</div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

window.saveAnnouncement = async function() {
    const title = document.getElementById('annTitle').value;
    const content = document.getElementById('annContent').value;
    if (!title || !content) return alert("Eksik bilgi");

    try {
        const res = await fetch('/api/announcements', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (res.ok) {
            document.getElementById('announcementModal').classList.remove('active');
            document.getElementById('annTitle').value = '';
            document.getElementById('annContent').value = '';
            loadAnnouncements();
        } else {
            alert("Kaydedilemedi.");
        }
    } catch (e) { console.error(e); }
};

// ==========================================
// 6. SOCKET EVENTS (GERÇEK ZAMANLI)
// ==========================================
socket.on('new-message', (msg) => {
    // 1. Eğer şu an mesajı gönderen kişiyle konuşuyorsak:
    if (selectedUser && (msg.sender === selectedUser._id || msg.sender._id === selectedUser._id)) {
        addMessageToUI(msg);
        scrollToBottom();
        // İsterseniz burada kısa bir 'bip' sesi çalabilirsiniz
    } else {
        // 2. Konuşmuyorsak (başka ekrandaysak):
        // Listede o kişinin yanındaki sayacı artır
        const badge = document.getElementById(`badge-${msg.sender}`);
        if(badge) {
            let count = parseInt(badge.innerText || '0');
            badge.innerText = count + 1;
            badge.style.display = 'inline-block';
        }
        // Eğer kullanıcı listede yoksa veya görünmüyorsa listeyi yenile
        else {
            loadUsers();
        }
    }
});

socket.on('user-status-change', () => {
    // Birisi online/offline olunca listeyi güncelle
    loadUsers();
});