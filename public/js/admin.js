document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadUsers();
    
    const logoInput = document.getElementById('logoInput');
    if(logoInput) logoInput.addEventListener('change', uploadLogo);
});

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        document.getElementById('totalUsers').innerText = data.totalUsers || 0;
        document.getElementById('onlineUsers').innerText = data.onlineUsers || 0;
        document.getElementById('totalMessages').innerText = data.totalMessages || 0;
        document.getElementById('totalAnnouncements').innerText = data.totalAnnouncements || 0;
    } catch(e){}
}

async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.fullName || u.firstName + ' ' + u.lastName}</td>
                <td>${u.title || '-'}</td>
                <td>${u.titleOrder || 100}</td>
                <td>${u.isAdmin ? '<b style="color:red">Admin</b>' : 'Personel'}</td>
                <td>
                    ${!u.isAdmin ? `
                        <button onclick="resetPassword('${u._id}')" class="btn btn-sm btn-secondary" title="Şifre Sıfırla">🔑</button>
                        <button onclick="deleteUser('${u._id}')" class="btn btn-sm btn-danger" title="Sil">🗑️</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    } catch(e) {}
}

async function addUser() {
    const data = {
        username: document.getElementById('newUsername').value,
        firstName: document.getElementById('newFirstName').value,
        lastName: document.getElementById('newLastName').value,
        title: document.getElementById('newTitle').value,
        titleOrder: document.getElementById('newTitleOrder').value
    };
    const res = await fetch('/api/users/add', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    if(res.ok) { alert('Kullanıcı eklendi'); closeModal('addUserModal'); loadUsers(); loadStats(); }
    else alert('Hata oluştu');
}

async function bulkAddUsers() {
    const text = document.getElementById('bulkUserData').value;
    if (!text.trim()) return alert('Veri yok');

    const lines = text.split('\n');
    const users = [];
    
    lines.forEach(line => {
        if(!line.trim() || line.toLowerCase().startsWith('kullanici')) return;
        
        const cols = line.split(',');
        if(cols.length >= 3) {
            const rawName = cols[1].trim(); 
            let firstName = rawName, lastName = '';
            
            // Ad ve Soyadı ayırma
            if(rawName.includes(' ')) {
                const parts = rawName.split(' ');
                lastName = parts.pop();
                firstName = parts.join(' ');
            } else if (cols[2] && !cols[3]) {
                 firstName = cols[1].trim();
                 lastName = cols[2].trim();
            }

            users.push({
                username: cols[0].trim(),
                firstName: firstName,
                lastName: lastName || rawName,
                fullName: rawName,
                title: cols[2]?.trim() || cols[3]?.trim(),
                titleOrder: cols[4]?.trim() || 100
            });
        }
    });

    if(users.length === 0) return alert('Geçerli kullanıcı bulunamadı');

    const res = await fetch('/api/users/bulk', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ users })
    });
    
    if(res.ok) { 
        const data = await res.json();
        alert(data.count + ' kullanıcı eklendi');
        closeModal('bulkUserModal'); loadUsers(); loadStats();
    } else { alert('Yükleme hatası'); }
}

async function deleteUser(id) {
    if(confirm('Bu kullanıcı silinsin mi?')) { 
        await fetch(`/api/users/${id}`, {method:'DELETE'}); 
        loadUsers(); loadStats(); 
    }
}

async function deleteAllUsers() {
    if(confirm('DİKKAT: Yönetici hariç HERKES silinecek! Onaylıyor musunuz?')) { 
        const res = await fetch('/api/users/delete-all', {method:'DELETE'}); 
        const data = await res.json();
        alert(data.count + ' kullanıcı silindi');
        loadUsers(); loadStats(); 
    }
}

async function resetPassword(id) {
    if(confirm('Şifre 1234 olarak sıfırlansın mı?')) { 
        await fetch(`/api/users/reset-password/${id}`, {method:'POST'}); 
        alert('Şifre sıfırlandı'); 
    }
}

async function uploadLogo(e) {
    const formData = new FormData();
    formData.append('logo', e.target.files[0]);
    await fetch('/api/admin/settings/logo', { method: 'POST', body: formData });
    location.reload();
}