import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Tag, message, Modal, Typography } from 'antd';
import { SearchOutlined, PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import UserModal from './UserModal';
import '../../styles/admin/UserModal.css';
import '../../styles/admin/Toast.css';
import '../../styles/admin/Admin.css';

const { Title, Text } = Typography;
const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";

export default function UserList() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
      message.error(`Lỗi: ${err.message}`);
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
      if (!res.ok) { message.error(data.error || 'Đã có lỗi xảy ra.'); return; }
      message.success(data.message);
      setIsModalOpen(false);
      fetchUsers();
    } catch { message.error("Lỗi kết nối."); }
  };

  const handleToggleStatus = (user) => {
    const action = user.is_active ? 'khoá' : 'mở khoá';
    Modal.confirm({
      title: 'Xác nhận',
      content: `Bạn có chắc muốn ${action} tài khoản "${user.full_name || user.email}"?`,
      okText: 'Xác nhận',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${apiBase}/api/admin/users/${user.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ is_active: !user.is_active }),
          });
          const data = await res.json();
          if (!res.ok) { message.error(data.error || 'Đã có lỗi.'); return; }
          message.success(data.message);
          fetchUsers();
        } catch { message.error("Lỗi kết nối."); }
      },
    });
  };

  const getRoleColor = (role) => {
    const map = { manager: 'magenta', coordinator: 'blue', accountant: 'purple', driver: 'orange' };
    return map[role] || 'default';
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      render: (text, record, index) => <strong>{(currentPage - 1) * pageSize + index + 1}</strong>,
    },
    {
      title: 'Họ và Tên',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: (a, b) => (a.full_name || '').localeCompare(b.full_name || ''),
      render: (text) => text || <Text type="secondary">Chưa cập nhật</Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
    },
    {
      title: 'Số ĐT',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => text || <Text type="secondary">—</Text>,
    },
    {
      title: 'Vai Trò',
      dataIndex: 'role',
      key: 'role',
      sorter: (a, b) => (a.role || '').localeCompare(b.role || ''),
      render: (role) => <Tag color={getRoleColor(role)}>{(role || '').toUpperCase()}</Tag>,
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'is_active',
      key: 'is_active',
      sorter: (a, b) => (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1),
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, user) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleOpenEdit(user)}
            disabled={user.role === 'manager'}
          >
            Sửa
          </Button>
          <Button 
            danger={user.is_active} 
            type="text"
            icon={user.is_active ? <LockOutlined /> : <UnlockOutlined />}
            onClick={() => handleToggleStatus(user)}
            disabled={user.role === 'manager'}
          >
            {user.is_active ? 'Khoá' : 'Mở khoá'}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Title level={3} style={{ margin: 0 }}>Danh sách tài khoản</Title>
          <Text type="secondary" style={{ margin: 0 }}>Tổng: {filtered.length} / {allUsers.length} người dùng</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="middle" onClick={handleOpenAdd}>
          Thêm người dùng
        </Button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Input 
          placeholder="Tìm kiếm theo tên, email, SĐT, vai trò..." 
          prefix={<SearchOutlined />} 
          value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          size="large"
          allowClear
        />
      </div>

      <Table 
        columns={columns} 
        dataSource={filtered} 
        rowKey="id" 
        loading={loading}
        pagination={{ 
          current: currentPage,
          pageSize: pageSize,
          defaultPageSize: 10,
          showSizeChanger: true, 
          showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} mục`,
          onChange: (page, size) => { setCurrentPage(page); setPageSize(size); }
        }}
        scroll={{ x: 'max-content' }}
      />

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        editingUser={editingUser}
      />
    </div>
  );
}