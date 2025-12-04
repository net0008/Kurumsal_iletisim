// Versiyon: 2.0 (Header Avatar Eklendi)
const socket = io();
let currentUser = null;
let selectedUser = null;

const notificationSound = new Audio('/sounds/notification.mp3');
function playNotificationSound() {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Uygulama başlatılıyor...");
    try {
        await getCurrentUser();
        initListeners();
        loadUsers(); 
        loadAnnouncements();
        loadSharedFiles();
        renderCalendar();
    } catch(e) { 
        if(e.message === 'Oturum geçersiz') window.location.href = '/login.html';
    }
});

async function getCurrentUser() {
    const res = await fetch('/api/auth/me');
    if(!res.ok) throw new Error('Oturum geçersiz');
    
    const data = await res.json();
    currentUser = data.user;
    
    // 1. İsim ve Unvan
    document.getElementById('currentUserName').innerText = currentUser.fullName || currentUser.username;
    document.getElementById('user-title-display').innerText = currentUser.title || '';
    
    // 2. Header Avatarı (YENİ)
    const headerAvatar = document.getElementById('headerUserAvatar');
    if(headerAvatar) {
        const initial = (currentUser.firstName?.[0] || currentUser.username[0]).toUpperCase();
        if(currentUser.profileImage) {
            headerAvatar.innerHTML = `<img src="${currentUser.profileImage}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            headerAvatar.innerText = initial;
        }
    }

    // 3. Tema Uygula
    if(currentUser.theme) document.body.setAttribute('data-theme', currentUser.theme);

    // 4. Yetki Butonları
    if(currentUser.isAdmin) document.getElementById('adminBtn').style.display = 'block';
    document.getElementById('addAnnouncementBtn').style.display = 'block';

    socket.emit('user-online', currentUser._id);
}

// ... (Geri kalan tüm fonksiyonlar aynı - initListeners, loadUsers, selectUser vb.) ...
// Kopyala-Yapıştır kolaylığı için eski kodlarınızı koruyabilirsiniz, sadece getCurrentUser değişti.

function initListeners() {
    const sendBtn = document.getElementById('sendMessageBtn');
    if(sendBtn) sendBtn.onclick = (e) => { e.preventDefault(); sendMessage(); };
    const msgInput = document.getElementById('messageInput');
    if(msgInput) msgInput.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }};
    
    const chatFileIn = document.getElementById('chatFileInput');
    const chatFileBtn = document.getElementById('chat-file-btn');
    if(chatFileIn) chatFileIn.onchange = uploadChatFile;
    if(chatFileBtn) chatFileBtn.onclick = () => chatFileIn.click();

    const profileBtn = document.getElementById('profileBtn');
    const profileModal = document.getElementById('profileModal');
    if(profileBtn) {
        profileBtn.onclick = () => {
            profileModal.style.display = 'flex';
            document.getElementById('profileFullName').value = currentUser.fullName;
            document.getElementById('profileTitle').value = currentUser.title;
            const img = currentUser.profileImage || `https://ui-avatars.com/api/?name=${currentUser.fullName}&background=random`;
            document.getElementById('previewAvatar').src = img;
        };
    }

    window.switchTab = (tabId) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        const index = ['tab-general', 'tab-theme', 'tab-security'].indexOf(tabId);
        document.querySelectorAll('.tab-btn')[index].classList.add('active');
    };

    document.querySelectorAll('.btn-close, .profile-close').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('announcementModal').style.display = 'none';
            if(profileModal) profileModal.style.display = 'none';
        };
    });

    const sharedFileIn = document.getElementById('sharedFileInput');
    if(sharedFileIn) sharedFileIn.onchange = function() {
        document.getElementById('sharedFileName').innerText = this.files[0] ? this.files[0].name : "Seçilmedi";
    };

    document.getElementById('logoutBtn').onclick = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    };

    document.getElementById('closeChatBtn').onclick = () => {
        document.getElementById('chatWindow').style.display = 'none';
        document.getElementById('defaultView').style.display = 'flex';
        selectedUser = null;
        loadUsers();
    };
    
    document.getElementById('addAnnouncementBtn').onclick = () => {
        document.getElementById('announcementModal').style.display = 'flex';
    };
}

// ... Profil Fonksiyonları ...
window.uploadAvatar = async function() {
    const input = document.getElementById('avatarInput');
    if(!input.files[0]) return alert("Dosya seçilmedi");
    const formData = new FormData();
    formData.append('avatar', input.files[0]);
    try {
        const res = await fetch('/api/users/profile/avatar', { method: 'POST', body: formData });
        const data = await res.json();
        if(res.ok) {
            alert("Güncellendi");
            document.getElementById('previewAvatar').src = data.imageUrl;
            currentUser.profileImage = data.imageUrl;
            // Header avatarı güncelle
            const headerAvatar = document.getElementById('headerUserAvatar');
            if(headerAvatar) headerAvatar.innerHTML = `<img src="${data.imageUrl}" style="width:100%; height:100%; object-fit:cover;">`;
            socket.emit('user-status-change'); 
        } else alert(data.message);
    } catch(e) { alert("Hata"); }
};

window.setTheme = async function(themeName) {
    document.body.setAttribute('data-theme', themeName);
    await fetch('/api/users/profile/theme', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ theme: themeName }) });
    currentUser.theme = themeName;
};

window.changeProfilePassword = async function() {
    const p1 = document.getElementById('newProfilePass').value;
    const p2 = document.getElementById('newProfilePassConfirm').value;
    if(p1.length < 4 || p1 !== p2) return alert("Şifreler uyuşmuyor veya çok kısa");
    const res = await fetch('/api/auth/change-password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ newPassword: p1 }) });
    if(res.ok) { alert("Değiştirildi"); document.getElementById('newProfilePass').value=''; document.getElementById('newProfilePassConfirm').value=''; }
};

// ... Diğer Yükleme Fonksiyonları (Aynı) ...
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
            const avatarHtml = user.profileImage ? `<img src="${user.profileImage}" style="width:100%; height:100%; object-fit:cover;">` : initial;
            
            return `
            <div class="user-item ${isActive}" id="user-${user._id}" onclick='selectUser(${JSON.stringify(user).replace(/'/g, "&#39;")})'>
                <div class="avatar">${avatarHtml}${user.isOnline ? '<div class="status-dot online"></div>' : ''}</div>
                <div class="user-info">
                    <div class="user-details">
                        <div class="user-fullname">${user.fullName || user.username}</div>
                        <div class="user-title">${user.title || ''}</div>
                    </div>
                    <div class="unread-badge" id="badge-${user._id}" style="${user.unreadCount > 0 ? 'display:inline-block;' : 'display:none;'}">${user.unreadCount}</div>
                </div>
            </div>`;
        }).join('');
    } catch(e) {}
}

async function selectUser(user) {
    selectedUser = user;
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-${user._id}`)?.classList.add('active');
    document.getElementById('badge-'+user._id).style.display='none';
    document.getElementById('defaultView').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'flex';
    document.getElementById('chatUserName').innerText = user.fullName;
    const statusEl = document.getElementById('chatUserStatus');
    statusEl.innerText = user.isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
    statusEl.style.color = user.isOnline ? 'var(--success-color)' : '#999';
    const res = await fetch(`/api/messages/${user._id}`);
    const msgs = await res.json();
    const area = document.getElementById('chatMessages');
    area.innerHTML = '';
    msgs.forEach(addMessageUI);
    scrollToBottom();
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !selectedUser) return;
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: selectedUser._id, content }) });
    const msg = await res.json();
    socket.emit('send-message', { ...msg, to: selectedUser._id });
    addMessageUI(msg);
    input.value = '';
    scrollToBottom();
}

async function uploadChatFile() {
    const input = document.getElementById('chatFileInput');
    if (!input.files[0] || !selectedUser) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);
    formData.append('recipientId', selectedUser._id);
    const res = await fetch('/api/messages/file', { method: 'POST', body: formData });
    if(res.ok) {
        const msg = await res.json();
        socket.emit('send-message', { ...msg, to: selectedUser._id });
        addMessageUI(msg);
        scrollToBottom();
    }
    input.value = '';
}

function addMessageUI(msg) {
    const area = document.getElementById('chatMessages');
    const isMe = String(msg.sender._id || msg.sender) === String(currentUser._id);
    let content = msg.content;
    if (msg.messageType === 'file') {
        content = msg.mimetype?.startsWith('image') ? `<a href="${msg.fileUrl}" target="_blank"><img src="${msg.fileUrl}" style="max-width:200px; border-radius:5px;"></a>` : `<a href="${msg.fileUrl}" target="_blank" style="text-decoration:underline">📎 ${msg.fileName}</a>`;
    }
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    div.innerHTML = `${content}<div class="message-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    area.appendChild(div);
}

function scrollToBottom() { setTimeout(() => { const area = document.getElementById('chatMessages'); area.scrollTop = area.scrollHeight; }, 50); }

async function loadSharedFiles() {
    const res = await fetch('/api/files/shared');
    const files = await res.json();
    const list = document.getElementById('sharedFileList');
    if(files.length === 0) { list.innerHTML = '<div style="text-align:center; padding:10px; opacity:0.6;">Dosya yok.</div>'; return; }
    list.innerHTML = files.map(file => {
        const isOwner = file.uploader && String(file.uploader._id) === String(currentUser._id);
        const canDelete = currentUser.isAdmin || isOwner;
        return `<div class="shared-file-item"><div class="file-info-left"><div class="file-name" title="${file.originalName}">${file.originalName}</div><div class="file-meta"><span>${file.uploader?.fullName || '?'}</span></div></div><div class="file-actions"><a href="${file.path}" download class="btn-icon download"><i class="fas fa-download"></i></a>${canDelete ? `<button onclick="deleteSharedFile('${file._id}')" class="btn-icon delete"><i class="fas fa-trash"></i></button>` : ''}</div></div>`;
    }).join('');
}

window.uploadSharedFile = async function() {
    const input = document.getElementById('sharedFileInput');
    if(!input.files[0]) return alert("Dosya seç");
    const formData = new FormData();
    formData.append('file', input.files[0]);
    document.getElementById('sharedFileName').innerText = "Yükleniyor...";
    await fetch('/api/files/shared', { method: 'POST', body: formData });
    input.value = '';
    document.getElementById('sharedFileName').innerText = "Seçilmedi";
};

window.deleteSharedFile = async function(id) { if(confirm("Silinsin mi?")) await fetch(`/api/files/${id}`, { method: 'DELETE' }); };

async function loadAnnouncements() {
    const res = await fetch('/api/announcements');
    const data = await res.json();
    const list = document.getElementById('announcementList');
    if(data.length === 0) { list.innerHTML = '<div style="text-align:center; padding:10px; opacity:0.6;">Duyuru yok.</div>'; return; }
    list.innerHTML = data.map(ann => {
        const canDelete = currentUser.isAdmin || (ann.createdBy && String(ann.createdBy._id) === String(currentUser._id));
        return `<div class="announcement-card"><div class="announcement-title">${ann.title}</div><div class="announcement-text">${ann.content}</div><div class="announcement-meta"><div class="meta-info"><span>${ann.createdBy?.fullName || '?'}</span></div>${canDelete ? `<button onclick="deleteAnnouncement('${ann._id}')" class="delete-ann-btn"><i class="fas fa-trash"></i></button>` : ''}</div></div>`;
    }).join('');
}

window.saveAnnouncement = async function() {
    const t = document.getElementById('annTitle').value; const c = document.getElementById('annContent').value;
    if(!t || !c) return alert("Eksik bilgi");
    await fetch('/api/announcements', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title: t, content: c }) });
    document.getElementById('announcementModal').style.display = 'none';
    document.getElementById('annTitle').value = ''; document.getElementById('annContent').value = '';
};
window.deleteAnnouncement = async function(id) { if(confirm("Sil?")) await fetch(`/api/announcements/${id}`, { method: 'DELETE' }); };

function renderCalendar() {
    const container = document.getElementById('calendar'); if(!container) return;
    const date = new Date();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    let html = `<div class="calendar-header">${monthNames[date.getMonth()]} ${date.getFullYear()}</div><div class="calendar-grid">`;
    for(let i=1; i<=31; i++) { if(i>new Date(date.getFullYear(),date.getMonth()+1,0).getDate()) break; html += `<div class="calendar-day ${i===date.getDate()?'today':''}">${i}</div>`; }
    container.innerHTML = html + `</div>`;
}

socket.on('connect', () => console.log("🟢 Socket Bağlı"));
socket.on('shared-file-change', () => { playNotificationSound(); loadSharedFiles(); });
socket.on('announcement-change', () => { playNotificationSound(); loadAnnouncements(); });
socket.on('new-message', (msg) => {
    const myId = String(currentUser._id);
    const senderId = String(msg.sender._id || msg.sender);
    if(senderId !== myId) playNotificationSound();
    if (selectedUser && (senderId === String(selectedUser._id) || senderId === myId)) { if (senderId !== myId) { addMessageToUI(msg); scrollToBottom(); } } 
    else if (senderId !== myId) { const b = document.getElementById(`badge-${msg.sender}`); if(b) { b.style.display='inline-block'; b.innerText=parseInt(b.innerText)+1; } else loadUsers(); }
});
socket.on('user-status-change', () => loadUsers());