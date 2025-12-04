// Versiyon: 1.8 (Ortak Dosya Alanı Eklendi)
const socket = io();
let currentUser = null;
let selectedUser = null;

const notificationSound = new Audio('/sounds/notification.mp3');

function playNotificationSound() {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {});
}

// ==========================================
// 1. BAŞLANGIÇ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Uygulama başlatılıyor (v1.8)...");
    try {
        await getCurrentUser();
        initListeners();
        loadUsers(); 
        loadAnnouncements();
        loadSharedFiles(); // YENİ: Başlangıçta dosyaları yükle
        renderCalendar();
        console.log("✅ Hazır.");
    } catch(e) { 
        console.error("Hata:", e);
        if(e.message === 'Oturum geçersiz') window.location.href = '/login.html';
    }
});

async function getCurrentUser() {
    const res = await fetch('/api/auth/me');
    if(!res.ok) throw new Error('Oturum geçersiz');
    
    const data = await res.json();
    currentUser = data.user;
    
    // UI Güncellemeleri
    const nameEl = document.getElementById('currentUserName') || document.getElementById('user-name-display');
    if(nameEl) nameEl.innerText = currentUser.fullName || currentUser.username;
    
    const titleEl = document.getElementById('user-title-display');
    if(titleEl) titleEl.innerText = currentUser.title || '';

    if(currentUser.isAdmin) {
        const adminBtn = document.getElementById('adminBtn');
        if(adminBtn) adminBtn.style.display = 'block';
    }
    
    const addAnnBtn = document.getElementById('addAnnouncementBtn');
    if(addAnnBtn) addAnnBtn.style.display = 'block';

    socket.emit('user-online', currentUser._id);
}

// ==========================================
// 2. BUTONLAR VE DİNLEYİCİLER
// ==========================================
function initListeners() {
    // Mesajlaşma
    const sendBtn = document.getElementById('sendMessageBtn');
    if(sendBtn) sendBtn.onclick = (e) => { e.preventDefault(); sendMessage(); };

    const msgInput = document.getElementById('messageInput');
    if(msgInput) {
        msgInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
    }

    // Sohbet Dosya Yükleme (Ataş butonu)
    const chatFileIn = document.getElementById('chatFileInput');
    const chatFileBtn = document.getElementById('chat-file-btn');
    if(chatFileIn) chatFileIn.onchange = uploadChatFile;
    if(chatFileBtn) chatFileBtn.onclick = () => chatFileIn.click();

    // Ortak Dosya Alanı: Dosya Seçilince İsim Göster
    const sharedFileIn = document.getElementById('sharedFileInput');
    if(sharedFileIn) {
        sharedFileIn.onchange = function() {
            const nameEl = document.getElementById('sharedFileName');
            if(this.files[0]) nameEl.innerText = this.files[0].name;
            else nameEl.innerText = "Seçilmedi";
        };
    }

    // Modal ve Çıkış
    const modal = document.getElementById('announcementModal');
    const addAnnBtn = document.getElementById('addAnnouncementBtn');
    if(addAnnBtn && modal) {
        addAnnBtn.onclick = () => { modal.style.display = 'flex'; modal.classList.add('active'); };
    }

    document.querySelectorAll('.btn-close').forEach(btn => {
        btn.onclick = () => { if(modal) modal.style.display = 'none'; };
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.onclick = async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        };
    }

    const closeChatBtn = document.getElementById('closeChatBtn');
    if(closeChatBtn) {
        closeChatBtn.onclick = () => {
            document.getElementById('chatWindow').style.display = 'none';
            document.getElementById('defaultView').style.display = 'flex';
            selectedUser = null;
            loadUsers();
        };
    }
}

// ==========================================
// 3. ORTAK DOSYA İŞLEMLERİ (YENİ)
// ==========================================
async function loadSharedFiles() {
    try {
        const res = await fetch('/api/files/shared');
        const files = await res.json();
        const list = document.getElementById('sharedFileList');
        
        if(!list) return;

        if (files.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#999; font-size:0.8rem; margin-top:15px;">Henüz ortak dosya yok.</div>';
            return;
        }

        list.innerHTML = files.map(file => {
            const dateStr = new Date(file.createdAt).toLocaleString('tr-TR');
            const uploaderName = file.uploader ? (file.uploader.fullName || file.uploader.username) : 'Bilinmeyen';
            
            // Silme Yetkisi: Admin veya Yükleyen
            const isOwner = file.uploader && String(file.uploader._id) === String(currentUser._id);
            const canDelete = currentUser.isAdmin || isOwner;

            return `
            <div class="shared-file-item">
                <div class="file-info-left">
                    <div class="file-name" title="${file.originalName}">
                        <i class="fas fa-file text-blue-500"></i> ${file.originalName}
                    </div>
                    <div class="file-meta">
                        <span><i class="fas fa-user"></i> ${uploaderName}</span>
                        <span><i class="far fa-clock"></i> ${dateStr}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${file.path}" download target="_blank" class="btn-icon download" title="İndir"><i class="fas fa-download"></i></a>
                    ${canDelete ? `<button onclick="deleteSharedFile('${file._id}')" class="btn-icon delete" title="Sil"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error("Dosya listesi hatası:", e); }
}

window.uploadSharedFile = async function() {
    const input = document.getElementById('sharedFileInput');
    const file = input.files[0];
    if (!file) return alert("Lütfen önce bir dosya seçin.");
    if (file.size > 20 * 1024 * 1024) return alert("Dosya 20MB'dan büyük olamaz!");

    const formData = new FormData();
    formData.append('file', file);

    const nameEl = document.getElementById('sharedFileName');
    const originalText = nameEl.innerText;
    nameEl.innerText = "Yükleniyor... %0";

    try {
        // İlerleme çubuğu olmadığı için basitçe bekliyoruz
        const res = await fetch('/api/files/shared', { method: 'POST', body: formData });
        
        if (res.ok) {
            input.value = '';
            nameEl.innerText = "Seçilmedi";
            // Socket listeyi yenileyecek
        } else {
            const err = await res.json();
            alert("Hata: " + err.message);
            nameEl.innerText = originalText;
        }
    } catch(e) { 
        alert("Sunucu hatası");
        nameEl.innerText = originalText;
    }
};

window.deleteSharedFile = async function(id) {
    if(!confirm("Bu dosya kalıcı olarak silinecek. Emin misiniz?")) return;
    try {
        const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
        if(!res.ok) {
            const err = await res.json();
            alert(err.message || "Silme yetkiniz yok.");
        }
    } catch(e) { alert("Hata oluştu."); }
};


// ==========================================
// 4. SOHBET & KULLANICILAR (MEVCUT)
// ==========================================
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const list = document.getElementById('userList');
        if(!list) return;

        const currentUserIdStr = String(currentUser._id);
        list.innerHTML = users.filter(u => String(u._id) !== currentUserIdStr).map(user => {
            const isActive = selectedUser && selectedUser._id === user._id ? 'active' : '';
            const initial = (user.firstName?.[0] || user.username[0]).toUpperCase();
            const showBadge = user.unreadCount > 0 && (!selectedUser || selectedUser._id !== user._id);
            
            return `
            <div class="user-item ${isActive}" id="user-${user._id}" onclick='selectUser(${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                <div class="avatar">
                    ${initial}
                    ${user.isOnline ? '<div class="status-dot online"></div>' : ''}
                </div>
                <div class="user-info">
                    <div class="user-details">
                        <div class="user-fullname">${user.fullName || user.username}</div>
                        <div class="user-title">${user.title || ''}</div>
                    </div>
                    <div class="unread-badge" id="badge-${user._id}" style="${showBadge ? 'display:inline-block;' : 'display:none;'}">${user.unreadCount}</div>
                </div>
            </div>`;
        }).join('');
    } catch(e) {}
}

async function selectUser(user) {
    selectedUser = user;
    const badge = document.getElementById(`badge-${user._id}`);
    if(badge) { badge.style.display = 'none'; badge.innerText = '0'; }
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-${user._id}`)?.classList.add('active');

    document.getElementById('defaultView').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'flex';
    
    const nameEl = document.getElementById('chatUserName');
    if(nameEl) nameEl.innerText = user.fullName || user.username;
    
    const statusEl = document.getElementById('chatUserStatus');
    if(statusEl) {
        statusEl.innerText = user.isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
        statusEl.style.color = user.isOnline ? '#2ecc71' : '#999';
    }

    try {
        const res = await fetch(`/api/messages/${user._id}`);
        const msgs = await res.json();
        const area = document.getElementById('chatMessages');
        if(area) {
            area.innerHTML = '';
            if (msgs.length === 0) area.innerHTML = '<div style="text-align:center; color:#ccc; margin-top:20px;">Henüz mesaj yok.</div>';
            else msgs.forEach(addMessageUI);
            scrollToBottom();
        }
        loadUsers(); 
    } catch(e) {}
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !selectedUser) return;
    try {
        const res = await fetch('/api/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientId: selectedUser._id, content })
        });
        const msg = await res.json();
        socket.emit('send-message', { ...msg, to: selectedUser._id });
        addMessageUI(msg);
        input.value = '';
        scrollToBottom();
    } catch (e) {}
}

async function uploadChatFile() {
    const input = document.getElementById('chatFileInput');
    const file = input.files[0];
    if (!file || !selectedUser) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipientId', selectedUser._id);
    
    try {
        const res = await fetch('/api/messages/file', { method: 'POST', body: formData });
        if (res.ok) {
            const msg = await res.json();
            socket.emit('send-message', { ...msg, to: selectedUser._id });
            addMessageUI(msg);
            scrollToBottom();
        }
    } catch(e) {}
    input.value = '';
}

function addMessageUI(msg) {
    const area = document.getElementById('chatMessages');
    if(!area) return;
    if (area.innerHTML.includes('Henüz mesaj yok')) area.innerHTML = '';
    const isMe = String(msg.sender._id || msg.sender) === String(currentUser._id);
    let content = msg.content;
    if (msg.messageType === 'file') {
        if (msg.mimetype?.startsWith('image')) content = `<a href="${msg.fileUrl}" target="_blank"><img src="${msg.fileUrl}" style="max-width:200px; border-radius:5px;"></a>`;
        else content = `<a href="${msg.fileUrl}" target="_blank" style="text-decoration:underline">📎 ${msg.fileName}</a>`;
    }
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    div.innerHTML = `${content}<div class="message-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    area.appendChild(div);
}

function scrollToBottom() {
    const area = document.getElementById('chatMessages');
    if(area) setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
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

        if (data.length === 0) { list.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Henüz duyuru yok.</div>'; return; }

        list.innerHTML = data.map(ann => {
            const dateStr = new Date(ann.createdAt).toLocaleString('tr-TR');
            const author = ann.createdBy ? (ann.createdBy.fullName || ann.createdBy.username) : 'Bilinmeyen';
            const canDelete = currentUser.isAdmin || (ann.createdBy && String(ann.createdBy._id) === String(currentUser._id));
            return `
            <div class="announcement-card">
                <div class="announcement-title">${ann.title}</div>
                <div class="announcement-text">${ann.content}</div>
                <div class="announcement-meta">
                    <div class="meta-info"><span>👤 ${author}</span><span>🕒 ${dateStr}</span></div>
                    ${canDelete ? `<button class="delete-ann-btn" onclick="deleteAnnouncement('${ann._id}')" title="Sil">🗑️</button>` : ''}
                </div>
            </div>`;
        }).join('');
    } catch(e) {}
}

window.saveAnnouncement = async function() {
    const t = document.getElementById('annTitle').value;
    const c = document.getElementById('annContent').value;
    if(!t || !c) return alert("Eksik bilgi");
    await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title: t, content: c }) });
    const modal = document.getElementById('announcementModal');
    if(modal) modal.style.display = 'none';
    document.getElementById('annTitle').value = '';
    document.getElementById('annContent').value = '';
};

window.deleteAnnouncement = async function(id) {
    if(confirm('Silinsin mi?')) await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
};

// ==========================================
// 6. TAKVİM
// ==========================================
function renderCalendar() {
    const container = document.getElementById('calendar');
    if(!container) return;
    const date = new Date();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    let html = `<div class="calendar-header">${monthNames[date.getMonth()]} ${date.getFullYear()}</div><div class="calendar-grid">`;
    for(let i=1; i<=31; i++) {
        if(i > new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()) break;
        html += `<div class="calendar-day ${i === date.getDate() ? 'today' : ''}">${i}</div>`;
    }
    container.innerHTML = html + `</div>`;
}

// ==========================================
// 7. SOCKET
// ==========================================
socket.on('connect', () => console.log("🟢 Socket Bağlı"));

// ORTAK DOSYA DEĞİŞİMİ (YENİ)
socket.on('shared-file-change', () => {
    console.log("📂 Dosya alanı güncellendi.");
    playNotificationSound();
    loadSharedFiles();
});

socket.on('announcement-change', () => {
    playNotificationSound();
    loadAnnouncements();
});

socket.on('new-message', (msg) => {
    const myId = String(currentUser._id);
    const senderId = String(msg.sender._id || msg.sender);
    if(senderId !== myId) playNotificationSound();
    
    if (selectedUser && (senderId === String(selectedUser._id) || senderId === myId)) {
         if (senderId !== myId) { addMessageToUI(msg); scrollToBottom(); }
    } else if (senderId !== myId) {
        const badge = document.getElementById(`badge-${msg.sender}`);
        if(badge) { badge.style.display = 'inline-block'; badge.innerText = parseInt(badge.innerText)+1; }
        else loadUsers();
    }
});

socket.on('user-status-change', () => loadUsers());