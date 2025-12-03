// Versiyon: 1.1
// Değişiklikler: Takvim oluşturma (renderCalendar) ve Gelişmiş Duyuru Listeleme (Yazar/Tarih/Silme Yetkisi)

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
        loadUsers(); 
        loadAnnouncements();
        renderCalendar(); // Takvimi Başlat
    } catch(e) { 
        // Hata varsa login sayfasına yönlendir
        if(!window.location.href.includes('login')) window.location.href = '/login.html'; 
    }
});

async function getCurrentUser() {
    const res = await fetch('/api/auth/me');
    if(!res.ok) throw new Error('Oturum geçersiz');
    
    const data = await res.json();
    currentUser = data.user;
    
    // Header Bilgileri
    document.getElementById('currentUserName').innerText = currentUser.fullName || currentUser.username;
    const titleEl = document.getElementById('user-title-display');
    if(titleEl) titleEl.innerText = currentUser.title || '';

    // Admin Butonları
    if(currentUser.isAdmin) {
        document.getElementById('adminBtn').style.display = 'block';
    }
    
    // Duyuru ekleme butonu artık herkese açık olduğu için gizleme yapmıyoruz.
    
    socket.emit('user-online', currentUser._id);
}

// ==========================================
// 2. BUTONLAR VE DİNLEYİCİLER
// ==========================================
function initListeners() {
    // Mesaj Gönderme
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Dosya Yükleme
    const fileInput = document.getElementById('chatFileInput');
    if (fileInput) fileInput.addEventListener('change', uploadFile);

    // Duyuru Modalı
    const modal = document.getElementById('announcementModal');
    const addAnnBtn = document.getElementById('addAnnouncementBtn');
    if (addAnnBtn) {
        addAnnBtn.addEventListener('click', () => modal.classList.add('active'));
    }

    // Modal Kapatma
    window.closeModal = (id) => document.getElementById(id).classList.remove('active');
    
    // Çıkış
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    // Sohbeti Kapat
    const closeChatBtn = document.getElementById('closeChatBtn');
    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            document.getElementById('chatWindow').style.display = 'none';
            document.getElementById('defaultView').style.display = 'flex';
            selectedUser = null;
            loadUsers();
        });
    }
}

// ==========================================
// 3. KULLANICI LİSTESİ
// ==========================================
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const list = document.getElementById('userList');
        
        if(!list) return;

        const currentUserIdStr = String(currentUser._id);

        list.innerHTML = users
            .filter(u => String(u._id) !== currentUserIdStr)
            .map(user => {
                const isActive = selectedUser && selectedUser._id === user._id ? 'active' : '';
                const initial = (user.firstName?.[0] || user.username[0]).toUpperCase();
                const statusDot = user.isOnline ? '<div class="status-dot online"></div>' : '';
                
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
// 4. SOHBET İŞLEMLERİ
// ==========================================
async function selectUser(user) {
    selectedUser = user;
    
    const badge = document.getElementById(`badge-${user._id}`);
    if(badge) { badge.style.display = 'none'; badge.innerText = '0'; }
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-${user._id}`)?.classList.add('active');

    document.getElementById('defaultView').style.display = 'none';
    document.getElementById('chatWindow').style.display = 'flex';
    document.getElementById('chatUserName').innerText = user.fullName || user.username;
    
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
            if (msgs.length === 0) {
                area.innerHTML = '<div style="text-align:center; color:#ccc; margin-top:20px;">Henüz mesaj yok.</div>';
            } else {
                msgs.forEach(addMessageUI);
            }
            scrollToBottom();
        }
        loadUsers(); 
    } catch(e) { console.error(e); }
}

function scrollToBottom() {
    const area = document.getElementById('chatMessages');
    if(area) setTimeout(() => { area.scrollTop = area.scrollHeight; }, 50);
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
    } catch (e) { console.error(e); }
}

async function uploadFile() {
    const input = document.getElementById('chatFileInput');
    const file = input.files[0];
    if (!file || !selectedUser) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('recipientId', selectedUser._id);

    const progress = document.getElementById('uploadProgress');
    if(progress) progress.style.display = 'block';

    try {
        const res = await fetch('/api/messages/file', { method: 'POST', body: formData });
        if(progress) progress.style.display = 'none';
        
        if (res.ok) {
            const msg = await res.json();
            socket.emit('send-message', { ...msg, to: selectedUser._id });
            addMessageUI(msg);
            scrollToBottom();
        } else { alert('Hata'); }
    } catch (e) { 
        if(progress) progress.style.display = 'none';
        alert('Hata'); 
    }
    input.value = '';
}

function addMessageUI(msg) {
    const area = document.getElementById('chatMessages');
    if(!area) return;
    if (area.innerHTML.includes('Henüz mesaj yok')) area.innerHTML = '';

    const currentUserIdStr = String(currentUser._id || currentUser.id);
    const msgSenderIdStr = String(msg.sender._id || msg.sender);

    const isMe = msgSenderIdStr === currentUserIdStr;
    let content = msg.content;
    
    if (msg.messageType === 'file') {
        if (msg.mimetype?.startsWith('image')) {
            content = `<a href="${msg.fileUrl}" target="_blank"><img src="${msg.fileUrl}" style="max-width:200px; border-radius:5px;"></a>`;
        } else {
            content = `<a href="${msg.fileUrl}" target="_blank" style="color:inherit; text-decoration:underline;">📎 ${msg.fileName}</a>`;
        }
    }

    const div = document.createElement('div');
    div.className = `message ${isMe ? 'sent' : 'received'}`;
    div.innerHTML = `${content}<div class="message-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    area.appendChild(div);
}

// ==========================================
// 5. DUYURULAR (GELİŞMİŞ)
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

        list.innerHTML = data.map(ann => {
            const dateStr = new Date(ann.createdAt).toLocaleString('tr-TR');
            // Yazar bilgisini kontrol et
            const author = ann.createdBy ? (ann.createdBy.fullName || ann.createdBy.username) : 'Bilinmeyen';
            
            // Silme Yetkisi: Admin veya Yazan Kişi
            const isCreator = ann.createdBy && (String(ann.createdBy._id) === String(currentUser._id));
            const canDelete = currentUser.isAdmin || isCreator;

            return `
            <div class="announcement-card">
                <div class="announcement-title">${ann.title}</div>
                <div class="announcement-text">${ann.content}</div>
                <div class="announcement-meta">
                    <div class="meta-info">
                        <span class="meta-author"><i class="fas fa-user-edit"></i> ${author}</span>
                        <span><i class="fas fa-clock"></i> ${dateStr}</span>
                    </div>
                    ${canDelete ? `<button class="delete-ann-btn" onclick="deleteAnnouncement('${ann._id}')" title="Sil"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
            </div>`;
        }).join('');
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
            alert("Duyuru kaydedilemedi.");
        }
    } catch(e) { console.error(e); }
};

window.deleteAnnouncement = async function(id) {
    if(!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    try {
        const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
        if(res.ok) loadAnnouncements();
        else alert('Yetkiniz yok');
    } catch(e) { alert('Hata'); }
};

// ==========================================
// 6. TAKVİM (YENİ ÖZELLİK)
// ==========================================
function renderCalendar() {
    const container = document.getElementById('calendar');
    if(!container) return;
    
    const date = new Date();
    const month = date.getMonth();
    const year = date.getFullYear();
    const today = date.getDate();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const days = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
    
    let html = `<div class="calendar-header">${monthNames[month]} ${year}</div><div class="calendar-grid">`;
    days.forEach(d => html += `<div class="calendar-day-name">${d}</div>`);
    
    // Pazartesi 1, Pazar 0. Türk takvimine göre Pazar'ı 7 kabul edelim
    let startDay = firstDay.getDay();
    if(startDay === 0) startDay = 7;
    
    // Boş kutular (Ayın başındaki boşluklar)
    for(let i=1; i<startDay; i++) html += `<div class="calendar-day empty"></div>`;
    
    // Günler
    for(let i=1; i<=lastDay.getDate(); i++) {
        const isToday = i === today ? 'today' : '';
        html += `<div class="calendar-day ${isToday}">${i}</div>`;
    }
    
    html += `</div>`;
    container.innerHTML = html;
}

// ==========================================
// 7. SOCKET EVENTS
// ==========================================
socket.on('new-message', (msg) => {
    const currentUserIdStr = String(currentUser._id || currentUser.id);
    const msgSenderIdStr = String(msg.sender._id || msg.sender);
    
    // Eğer sohbet o kişiyle açıksa mesajı ekle
    if (selectedUser && (msgSenderIdStr === String(selectedUser._id) || msgSenderIdStr === currentUserIdStr)) {
        if (msgSenderIdStr === String(selectedUser._id)) {
             addMessageToUI(msg);
             scrollToBottom();
        }
    } else {
        // Değilse badge (rozet) sayısını artır
        if (msgSenderIdStr !== currentUserIdStr) {
            const badge = document.getElementById(`badge-${msg.sender}`);
            if (badge) {
                let count = parseInt(badge.innerText || '0');
                badge.innerText = count + 1;
                badge.style.display = 'inline-block';
            } else loadUsers();
        }
    }
});

socket.on('user-status-change', () => loadUsers());