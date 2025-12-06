// Versiyon: 2.2 (Toplu Silme JS Eklendi)
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
    await applyAdminTheme();
    await loadStats();
    await loadUsers(); 
    await loadLogs();
    
    const logoIn = document.getElementById('logoInput');
    if(logoIn) logoIn.addEventListener('change', uploadLogo);
});

async function applyAdminTheme() {
    try {
        const res = await fetch('/api/auth/me');
        if(res.ok) {
            const data = await res.json();
            if(data.user && data.user.theme) {
                document.body.setAttribute('data-theme', data.user.theme);
            }
        }
    } catch(e) { console.error("Tema yüklenemedi:", e); }
}

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        document.getElementById('totalUsers').innerText = data.totalUsers;
        document.getElementById('onlineUsers').innerText = data.onlineUsers;
        document.getElementById('totalMessages').innerText = data.totalMessages;
        document.getElementById('totalAnnouncements').innerText = data.totalAnnouncements;
        
        // Yeni eklenen dosya istatistiği
        if(document.getElementById('totalFiles')) {
            document.getElementById('totalFiles').innerText = data.totalFiles;
        }
    } catch(e){}
}

// --- YENİ: TOPLU SİLME FONKSİYONLARI ---

async function deleteAllMessages() {
    if(!confirm("DİKKAT! Sistemdeki TÜM mesajlar kalıcı olarak silinecek. Onaylıyor musunuz?")) return;
    try {
        const res = await fetch('/api/admin/messages/all', { method: 'DELETE' });
        const data = await res.json();
        alert(data.message);
        loadStats();
    } catch(e) { alert("Hata oluştu"); }
}

async function deleteAllAnnouncements() {
    if(!confirm("DİKKAT! Tüm duyurular silinecek. Onaylıyor musunuz?")) return;
    try {
        const res = await fetch('/api/admin/announcements/all', { method: 'DELETE' });
        const data = await res.json();
        alert(data.message);
        loadStats();
    } catch(e) { alert("Hata oluştu"); }
}

async function deleteAllFiles() {
    if(!confirm("DİKKAT! Tüm ortak dosyalar ve sohbet dosyaları hem veritabanından hem de diskten silinecek. Onaylıyor musunuz?")) return;
    try {
        const res = await fetch('/api/admin/files/all', { method: 'DELETE' });
        const data = await res.json();
        alert(data.message);
        loadStats();
    } catch(e) { alert("Hata oluştu"); }
}

// ----------------------------------------

async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        allUsers = users;
        
        const tbody = document.getElementById('usersTableBody');
        const select1 = document.getElementById('msgUser1');
        const select2 = document.getElementById('msgUser2');
        
        tbody.innerHTML = '';
        if(select1) select1.innerHTML = '<option value="">Seçiniz...</option>';
        if(select2) select2.innerHTML = '<option value="">Seçiniz...</option>';

        users.forEach(u => {
            tbody.innerHTML += `
            <tr>
                <td>${u.username}</td>
                <td>${u.fullName || u.firstName}</td>
                <td>${u.title}</td>
                <td>${u.titleOrder}</td>
                <td>${u.isAdmin ? '<b style="color:var(--danger-color)">Admin</b>' : 'Personel'}</td>
                <td>
                    <button onclick="resetPassword('${u._id}')" class="btn btn-sm btn-secondary" title="Şifre Sıfırla">🔑</button>
                    ${!u.isAdmin ? `<button onclick="deleteUser('${u._id}')" class="btn btn-sm btn-danger" title="Sil">🗑️</button>` : ''}
                </td>
            </tr>`;

            const option = `<option value="${u._id}">${u.fullName} (${u.username})</option>`;
            if(select1) select1.innerHTML += option;
            if(select2) select2.innerHTML += option;
        });

    } catch(e) { console.error(e); }
}

async function loadLogs() {
    try {
        const res = await fetch('/api/admin/logs');
        const data = await res.json();
        const tbody = document.getElementById('logsTableBody');
        
        if(!tbody) return;
        
        if(data.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px;">Henüz log kaydı yok.</td></tr>';
            return;
        }

        const actionMap = {
            'login': '<span style="color:var(--success-color)">Giriş</span>',
            'logout': '<span style="color:var(--warning-color)">Çıkış</span>',
            'password_change': 'Şifre Değişimi',
            'terms_accepted': 'Sözleşme Onayı'
        };

        tbody.innerHTML = data.logs.map(log => `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString('tr-TR')}</td>
                <td>${log.user ? log.user.fullName : 'Silinmiş Kullanıcı'}</td>
                <td>${actionMap[log.action] || log.action}</td>
                <td>${log.ipAddress || '-'}</td>
            </tr>
        `).join('');
    } catch(e) { console.error(e); }
}

async function inspectMessages() {
    const u1 = document.getElementById('msgUser1').value;
    const u2 = document.getElementById('msgUser2').value;
    const area = document.getElementById('inspectorArea');
    
    if(!u1 || !u2) return alert("Lütfen iki kullanıcı seçin.");
    if(u1 === u2) return alert("Farklı kullanıcılar seçmelisiniz.");

    area.style.display = 'block';
    area.innerHTML = '<div style="text-align:center; padding:20px;">Yükleniyor...</div>';

    try {
        const res = await fetch(`/api/admin/messages/${u1}/${u2}`);
        const msgs = await res.json();

        if(msgs.length === 0) {
            area.innerHTML = '<div style="text-align:center; opacity:0.6; margin-top:20px;">Bu iki kişi arasında mesajlaşma yok.</div>';
            return;
        }

        let html = '';
        msgs.forEach(msg => {
            const isUser1 = msg.sender._id === u1;
            const align = isUser1 ? 'flex-start' : 'flex-end';
            const bg = isUser1 ? 'var(--message-received-bg)' : 'var(--primary-color)';
            const color = isUser1 ? 'var(--message-text-color)' : 'white';
            
            let content = msg.content;
            if(msg.messageType === 'file') content = `📎 Dosya: ${msg.fileName}`;

            html += `
            <div style="display:flex; justify-content:${align}; margin-bottom:10px;">
                <div style="background:${bg}; color:${color}; padding:10px; border-radius:8px; max-width:70%; border:1px solid var(--border-color);">
                    <div style="font-size:0.7rem; opacity:0.8; margin-bottom:3px;">${msg.sender.fullName} - ${new Date(msg.createdAt).toLocaleString()}</div>
                    <div>${content}</div>
                </div>
            </div>`;
        });
        
        area.innerHTML = html;
        setTimeout(() => area.scrollTop = area.scrollHeight, 100);

    } catch(e) {
        area.innerHTML = '<div style="color:var(--danger-color); text-align:center;">Hata oluştu.</div>';
    }
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

async function addUser() {
    const data = {
        username: document.getElementById('newUsername').value,
        firstName: document.getElementById('newFirstName').value,
        lastName: document.getElementById('newLastName').value,
        title: document.getElementById('newTitle').value,
        titleOrder: document.getElementById('newTitleOrder').value
    };
    if(!data.username) return alert("Eksik bilgi");
    
    await fetch('/api/users/add', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
    });
    closeModal('addUserModal');
    loadUsers(); loadStats();
}

async function bulkAddUsers() {
    const text = document.getElementById('bulkUserData').value;
    const lines = text.split('\n');
    const users = [];
    lines.forEach(l => {
        const c = l.split(',');
        if(c.length >= 4) users.push({username: c[0].trim(), firstName: c[1].trim(), lastName: c[2].trim(), title: c[3].trim(), titleOrder: c[4]?c[4].trim():100});
    });
    
    await fetch('/api/users/bulk', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({users})
    });
    closeModal('bulkUserModal');
    loadUsers(); loadStats();
}

async function deleteUser(id) {
    if(confirm("Silinsin mi?")) {
        await fetch(`/api/users/${id}`, { method: 'DELETE' });
        loadUsers(); loadStats();
    }
}

async function deleteAllUsers() {
    if(confirm("TÜM kullanıcılar silinecek?")) {
        await fetch('/api/users/delete-all', { method: 'DELETE' });
        loadUsers(); loadStats();
    }
}

async function resetPassword(id) {
    if(confirm("Şifre 1234 olsun mu?")) {
        await fetch(`/api/users/reset-password/${id}`, { method: 'POST' });
        alert("Sıfırlandı.");
    }
}

async function uploadLogo(e) {
    const file = e.target.files[0];
    if(!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    await fetch('/api/admin/settings/logo', { method: 'POST', body: fd });
    location.reload();
}