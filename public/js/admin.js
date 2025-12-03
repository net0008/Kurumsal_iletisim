// Versiyon: 1.1 - Admin Paneli Mantığı
// Düzeltmeler: 
// 1. Hata yönetimi eklendi (try-catch blokları artık sessiz değil).
// 2. CSV okuma mantığı "kullanici_adi,ad,soyad,unvan,sira_no" formatına sabitlendi.
// 3. Silme işlemleri için geri bildirim eklendi.

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadUsers();
    
    const logoInput = document.getElementById('logoInput');
    if(logoInput) logoInput.addEventListener('change', uploadLogo);
});

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// İstatistikleri Getir
async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Veri alınamadı');
        
        const data = await res.json();
        document.getElementById('totalUsers').innerText = data.totalUsers || 0;
        document.getElementById('onlineUsers').innerText = data.onlineUsers || 0;
        document.getElementById('totalMessages').innerText = data.totalMessages || 0;
        document.getElementById('totalAnnouncements').innerText = data.totalAnnouncements || 0;
    } catch(e) {
        console.error("İstatistik hatası:", e);
        // Hata olsa bile kullanıcıya yansıtma, 0 kalsın
    }
}

// Kullanıcıları Listele
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Liste çekilemedi');
        
        const users = await res.json();
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Kayıtlı kullanıcı bulunamadı.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.fullName || (u.firstName + ' ' + u.lastName)}</td>
                <td>${u.title || '-'}</td>
                <td>${u.titleOrder || 100}</td>
                <td>${u.isAdmin ? '<b style="color:red">Yönetici</b>' : 'Personel'}</td>
                <td>
                    ${!u.isAdmin ? `
                        <button onclick="resetPassword('${u._id}')" class="btn btn-sm btn-secondary" title="Şifreyi 1234 yap">🔑</button>
                        <button onclick="deleteUser('${u._id}')" class="btn btn-sm btn-danger" title="Sil">🗑️</button>
                    ` : '<span style="color:#999">-</span>'}
                </td>
            </tr>
        `).join('');
    } catch(e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">Hata: ${e.message}</td></tr>`;
    }
}

// Tek Kullanıcı Ekle
async function addUser() {
    const data = {
        username: document.getElementById('newUsername').value.trim(),
        firstName: document.getElementById('newFirstName').value.trim(),
        lastName: document.getElementById('newLastName').value.trim(),
        title: document.getElementById('newTitle').value.trim(),
        titleOrder: document.getElementById('newTitleOrder').value
    };

    if(!data.username || !data.firstName) return alert("Lütfen gerekli alanları doldurun.");

    try {
        const res = await fetch('/api/users/add', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        const result = await res.json();

        if(res.ok) { 
            alert('Kullanıcı başarıyla eklendi'); 
            closeModal('addUserModal'); 
            loadUsers(); 
            loadStats(); 
        } else {
            alert('Hata: ' + (result.message || 'Ekleme başarısız'));
        }
    } catch (e) { alert('Sunucu hatası: ' + e.message); }
}

// Toplu Kullanıcı Ekle (CSV)
async function bulkAddUsers() {
    const text = document.getElementById('bulkUserData').value;
    if (!text.trim()) return alert('Lütfen CSV verisi yapıştırın');

    const lines = text.split('\n');
    const users = [];
    
    // CSV Formatı: kullanici_adi,ad,soyad,unvan,sira_no
    lines.forEach((line, index) => {
        const l = line.trim();
        if(!l || l.toLowerCase().startsWith('kullanici')) return; // Başlığı ve boş satırları atla
        
        const cols = l.split(',');
        
        // En az 3 alan (username, ad, soyad) olmalı
        if(cols.length >= 3) {
            users.push({
                username: cols[0].trim(),
                firstName: cols[1].trim(),
                lastName: cols[2].trim(),
                fullName: `${cols[1].trim()} ${cols[2].trim()}`,
                title: cols[3] ? cols[3].trim() : 'Personel',
                titleOrder: cols[4] ? parseInt(cols[4].trim()) : 100, // Sıra no varsa al, yoksa 100
                password: '1234' // Varsayılan şifre
            });
        }
    });

    if (users.length === 0) return alert("Geçerli veri bulunamadı. Formatı kontrol edin.");

    try {
        const res = await fetch('/api/users/bulk', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ users })
        });
        
        const result = await res.json();
        
        if(res.ok) { 
            alert(result.message || (result.count + ' kullanıcı eklendi'));
            closeModal('bulkUserModal'); 
            loadUsers(); 
            loadStats();
        } else { 
            alert('Yükleme hatası: ' + result.message); 
        }
    } catch (e) { alert('Sunucu hatası: ' + e.message); }
}

// Tek Kullanıcı Sil
async function deleteUser(id) {
    if(!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
    
    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const result = await res.json();

        if(res.ok) {
            alert("Kullanıcı silindi.");
            loadUsers(); 
            loadStats(); 
        } else {
            alert("Silinemedi: " + result.message);
        }
    } catch(e) { alert("Hata oluştu: " + e.message); }
}

// Tümünü Sil
async function deleteAllUsers() {
    if(!confirm('DİKKAT: Yönetici hariç TÜM kullanıcılar silinecek! Bu işlem geri alınamaz.')) return;
    
    try {
        const res = await fetch('/api/users/delete-all', { method: 'DELETE' });
        const result = await res.json();

        if(res.ok) {
            alert(result.count + ' kullanıcı silindi.');
            loadUsers(); 
            loadStats(); 
        } else {
            alert("Silme hatası: " + result.message);
        }
    } catch(e) { alert("Hata oluştu: " + e.message); }
}

// Şifre Sıfırla
async function resetPassword(id) {
    if(!confirm('Bu kullanıcının şifresi "1234" olarak sıfırlansın mı?')) return;
    
    try {
        const res = await fetch(`/api/users/reset-password/${id}`, { method: 'POST' });
        if(res.ok) {
            alert('Şifre sıfırlandı.');
        } else {
            alert('İşlem başarısız.');
        }
    } catch(e) { alert("Hata: " + e.message); }
}

// Logo Yükle
async function uploadLogo(e) {
    if(!e.target.files[0]) return;

    const formData = new FormData();
    formData.append('logo', e.target.files[0]);
    
    try {
        const res = await fetch('/api/admin/settings/logo', { method: 'POST', body: formData });
        if(res.ok) {
            alert('Logo güncellendi, sayfa yenileniyor...');
            location.reload();
        } else {
            alert('Logo yüklenemedi.');
        }
    } catch(e) { alert("Hata: " + e.message); }
}