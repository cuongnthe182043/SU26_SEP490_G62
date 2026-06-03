import React, { useEffect, useState } from 'react';
import UserModal from './UserModal';
import './UserModal.css';
import './Toast.css';

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";
const PAGE_SIZE = 15;


function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  return { toasts, addToast };
}


function ConfirmModal({ isOpen, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: 360 }}>
        <h2>Xác nhận</h2>
        <p style={{ color: '#374151', marginBottom: 24 }}>{message}</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>Hủy</button>
          <button className="btn-save" style={{ background: '#EF4444' }} onClick={onConfirm}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}


function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

export default function UserList() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);


  const [confirm, setConfirm] = useState({ open: false, message: '', onConfirm: null });


  const { toasts, addToast } = useToast();


  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tải danh sách.");
      setAllUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const filtered = allUsers.filter(u => {
    const q = search.toLowerCase();
    return (
      String(u.id).includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let va = a[sortField] ?? '';
    let vb = b[sortField] ?? '';
    if (typeof va === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(1);
  };

  const sortIcon = (field) => {
    if (sortField !== field) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };


  const handleOpenAdd = () => { setEditingUser(null); setIsModalOpen(true); };
  const handleOpenEdit = (user) => { setEditingUser(user); setIsModalOpen(true); };

  const handleSaveUser = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const url = editingUser
        ? `${apiBase}/api/admin/users/${editingUser.id}`
        : `${apiBase}/api/admin/users`;
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.error || 'Đã có lỗi xảy ra.', 'error'); return; }
      addToast(data.message, 'success');
      setIsModalOpen(false);
      fetchUsers();
    } catch { addToast("Lỗi kết nối.", 'error'); }
  };

  const handleToggleStatus = (user) => {
    const action = user.is_active ? 'khoá' : 'mở khoá';
    setConfirm({
      open: true,
      message: `Bạn có chắc muốn ${action} tài khoản "${user.full_name || user.email}"?`,
      onConfirm: async () => {
        setConfirm(c => ({ ...c, open: false }));
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${apiBase}/api/admin/users/${user.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ is_active: !user.is_active }),
          });
          const data = await res.json();
          if (!res.ok) { addToast(data.error || 'Đã có lỗi.', 'error'); return; }
          addToast(data.message, 'success');
          fetchUsers();
        } catch { addToast("Lỗi kết nối.", 'error'); }
      },
    });
  };

  const getRoleBadge = (role) => {
    const map = { manager: 'badge-manager', coordinator: 'badge-coordinator', accountant: 'badge-accountant', driver: 'badge-driver' };
    return map[role] || '';
  };

  if (loading) return <div className="loading-spinner">Đang tải dữ liệu...</div>;
  if (error) return <div className="error-message">Lỗi: {error}</div>;

  return (
    <div className="user-list-container">
      <ToastContainer toasts={toasts} />

      <div className="list-header">
        <div>
          <h2>Danh sách tài khoản</h2>
          <span className="user-count">Tổng: {filtered.length} / {allUsers.length} người dùng</span>
        </div>
        <button className="btn-add" onClick={handleOpenAdd}>➕ Thêm người dùng</button>
      </div>


      <div className="search-bar">
        <input
          type="text"
          placeholder="Tìm kiếm theo tên, email, SĐT, vai trò..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} className="sortable">ID{sortIcon('id')}</th>
              <th onClick={() => handleSort('full_name')} className="sortable">Họ và Tên{sortIcon('full_name')}</th>
              <th onClick={() => handleSort('email')} className="sortable">Email{sortIcon('email')}</th>
              <th>Số ĐT</th>
              <th onClick={() => handleSort('role')} className="sortable">Vai Trò{sortIcon('role')}</th>
              <th onClick={() => handleSort('is_active')} className="sortable">Trạng Thái{sortIcon('is_active')}</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map(user => (
              <tr key={user.id}>
                <td className="text-bold">#{user.id}</td>
                <td>{user.full_name || <span className="text-muted">Chưa cập nhật</span>}</td>
                <td>{user.email}</td>
                <td>{user.phone || <span className="text-muted">—</span>}</td>
                <td><span className={`badge ${getRoleBadge(user.role)}`}>{user.role}</span></td>
                <td>
                  <span className={`badge ${user.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    {user.is_active ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td>
                  <button className="btn-action btn-edit" onClick={() => handleOpenEdit(user)}>Sửa</button>
                  <button
                    className={`btn-action ${user.is_active ? 'btn-ban' : 'btn-unban'}`}
                    onClick={() => handleToggleStatus(user)}
                  >
                    {user.is_active ? 'Khoá' : 'Mở khoá'}
                  </button>
                </td>
              </tr>
            ))}
            {pageUsers.length === 0 && (
              <tr><td colSpan="7" className="text-center empty-state">Không có dữ liệu.</td></tr>
            )}
          </tbody>
        </table>
      </div>


      <div className="pagination">
        <button className="page-btn" disabled={safePage <= 1} onClick={() => setPage(1)}>«</button>
        <button className="page-btn" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
        <span className="page-info">Trang {safePage} / {totalPages}</span>
        <button className="page-btn" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        <button className="page-btn" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />

      <ConfirmModal
        isOpen={confirm.open}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(c => ({ ...c, open: false }))}
      />
    </div>
  );
}
