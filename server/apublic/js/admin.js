// Admin panel JavaScript

let allUsers = [];
let allLogs = [];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAdminAuth();
    await loadStats();
    await loadAllUsers();
    await loadLogs();
    await loadCurrentLogo();
    initEventListeners();
});

// Admin yetkisi kontrolü
async function checkAdminAuth() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/login.html';
            return;
        }
        const data = await response.json();
        if (!data.user.isAdmin) {
            alert('Bu sayfaya erişim yetkiniz yok');
            window.location.href = '/';
        }
    } catch (error) {
        window.location.href = '/login.html';
    }
}

// İstatistikleri yükle
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('onlineUsers').textContent = data.onlineUsers;
        document.getElementById('totalMessages').textContent = data.totalMessages;
        document.getElementById('totalAnnouncements').textContent = data.totalAnnouncements;
        document.getElementById('totalFiles').textContent = data.totalFiles;
    } catch (error) {
        console.error('İstatistikler yüklenemedi:', error);
    }
}

// Tüm kullanıcıları yükle
async function loadAllUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        allUsers = data.users;
        renderUsersTable();
    } catch (error) {
        console.error('Kullanıcılar yüklenemedi:', error);
    }
}

// Kullanıcı tablosunu render et
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    tbody.innerHTML = allUsers.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.fullName}</td>
            <td>${user.title}</td>
            <td>${user.titleOrder}</td>
            <td>${user.isAdmin ? '✓ Evet' : '✗ Hayır'}</td>
            <td>
                <span style="color: ${user.isOnline ? 'var(--online-color)' : 'var(--offline-color)'}">
                    ${user.isOnline ? '● Çevrimiçi' : '○ Çevrimdışı'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editUser('${user.id}')">Düzenle</button>
                <button class="btn btn-sm btn-warning" onclick="resetPassword('${user.id}')">Şifre Sıfırla</button>
                ${!user.isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">Sil</button>` : ''}
            </td>
        </tr>
    `).join('');
}

// Kullanıcı ekle
async function addUser() {
    const userData = {
        username: document.getElementById('newUsername').value.trim(),
        firstName: document.getElementById('newFirstName').value.trim(),
        lastName: document.getElementById('newLastName').value.trim(),
        title: document.getElementById('newTitle').value.trim(),
        titleOrder: parseInt(document.getElementById('newTitleOrder').value)
    };
    
    if (!userData.username || !userData.firstName || !userData.lastName || !userData.title) {
        alert('Tüm alanları doldurun');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Kullanıcı eklendi. Varsayılan şifre: 1234');
            closeModal('addUserModal');
            document.getElementById('addUserForm').reset();
            await loadAllUsers();
            await loadStats();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Kullanıcı eklenemedi');
    }
}

// Toplu kullanıcı ekleme
async function bulkAddUsers() {
    const csvData = document.getElementById('bulkUserData').value.trim();
    
    if (!csvData) {
        alert('CSV verisi giriniz');
        return;
    }
    
    try {
        // CSV'yi parse et
        const lines = csvData.split('\n').filter(line => line.trim());
        const users = [];
        
        // İlk satır başlık, atla
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.trim());
            
            if (parts.length !== 5) {
                alert(`Satır ${i + 1}: Hatalı format (5 alan gerekli)`);
                return;
            }
            
            users.push({
                username: parts[0],
                firstName: parts[1],
                lastName: parts[2],
                title: parts[3],
                titleOrder: parseInt(parts[4])
            });
        }
        
        if (users.length === 0) {
            alert('Geçerli kullanıcı verisi bulunamadı');
            return;
        }
        
        const response = await fetch('/api/admin/users/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`Toplam ${data.results.success.length} kullanıcı eklendi.\nHata: ${data.results.errors.length}`);
            if (data.results.errors.length > 0) {
                console.log('Hatalar:', data.results.errors);
            }
            closeModal('bulkUserModal');
            document.getElementById('bulkUserData').value = '';
            await loadAllUsers();
            await loadStats();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Toplu ekleme başarısız: ' + error.message);
    }
}

// Kullanıcı düzenle (basit versiyon - daha gelişmiş yapılabilir)
async function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    const newTitle = prompt('Yeni Unvan:', user.title);
    if (!newTitle) return;
    
    const newTitleOrder = prompt('Yeni Sıra No:', user.titleOrder);
    if (!newTitleOrder) return;
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: newTitle, 
                titleOrder: parseInt(newTitleOrder) 
            })
        });
        
        if (response.ok) {
            alert('Kullanıcı güncellendi');
            await loadAllUsers();
        }
    } catch (error) {
        alert('Güncelleme başarısız');
    }
}

// Şifre sıfırla
async function resetPassword(userId) {
    if (!confirm('Bu kullanıcının şifresini 1234 olarak sıfırlamak istediğinize emin misiniz?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
            method: 'POST'
        });
        
        if (response.ok) {
            alert('Şifre 1234 olarak sıfırlandı. Kullanıcı ilk girişte yeni şifre belirleyecek.');
        }
    } catch (error) {
        alert('Şifre sıfırlama başarısız');
    }
}

// Kullanıcı sil
async function deleteUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`${user.fullName} kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Kullanıcı silindi');
            await loadAllUsers();
            await loadStats();
        }
    } catch (error) {
        alert('Silme başarısız');
    }
}

// Logo yükle
async function uploadLogo(file) {
    if (file.size > 5 * 1024 * 1024) {
        alert('Logo boyutu 5MB\'dan küçük olmalıdır');
        return;
    }
    
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
        const response = await fetch('/api/admin/logo', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            alert('Logo yüklendi');
            await loadCurrentLogo();
        } else {
            alert('Logo yüklenemedi');
        }
    } catch (error) {
        alert('Logo yükleme hatası');
    }
}

// Mevcut logoyu yükle
async function loadCurrentLogo() {
    try {
        const response = await fetch('/api/admin/logo');
        const data = await response.json();
        if (data.logoUrl) {
            document.getElementById('currentLogo').src = data.logoUrl + '?t=' + Date.now();
        }
    } catch (error) {
        console.error('Logo yüklenemedi:', error);
    }
}

// Logları yükle
async function loadLogs() {
    try {
        const response = await fetch('/api/admin/logs');
        const data = await response.json();
        allLogs = data.logs;
        renderLogsTable(allLogs);
    } catch (error) {
        console.error('Loglar yüklenemedi:', error);
    }
}

// Logları filtrele
function filterLogs() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const action = document.getElementById('actionFilter').value;
    
    let filtered = allLogs;
    
    if (startDate) {
        filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(startDate));
    }
    
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(log => new Date(log.timestamp) <= end);
    }
    
    if (action) {
        filtered = filtered.filter(log => log.action === action);
    }
    
    renderLogsTable(filtered);
}

// Log tablosunu render et
function renderLogsTable(logs) {
    const tbody = document.getElementById('logsTableBody');
    
    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Log bulunamadı</td></tr>';
        return;
    }
    
    const actionLabels = {
        login: 'Giriş',
        logout: 'Çıkış',
        password_change: 'Şifre Değiştirme',
        terms_accepted: 'Şartlar Kabul'
    };
    
    tbody.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString('tr-TR');
        const timeStr = date.toLocaleTimeString('tr-TR');
        
        return `
            <tr>
                <td>${dateStr} ${timeStr}</td>
                <td>${log.user ? log.user.fullName : 'Bilinmeyen'}</td>
                <td>${actionLabels[log.action] || log.action}</td>
                <td>${log.ipAddress || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Event listeners
function initEventListeners() {
    // Kullanıcı ekleme formu
    document.getElementById('addUserForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addUser();
    });
    
    // Logo yükleme
    document.getElementById('logoInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            uploadLogo(file);
        }
    });
}

// Modal fonksiyonları
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}