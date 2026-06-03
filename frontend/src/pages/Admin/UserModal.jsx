import React, { useState, useEffect } from 'react';
import './UserModal.css';

export default function UserModal({ isOpen, onClose, onSave, editingUser }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'driver'
  });

  useEffect(() => {
    if (editingUser) {
      setFormData({
        email: editingUser.email || '',
        password: '',
        full_name: editingUser.full_name || '',
        phone: editingUser.phone || '',
        role: editingUser.role || 'driver'
      });
    } else {
      setFormData({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role: 'driver'
      });
    }
  }, [editingUser, isOpen]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{editingUser ? 'Sửa thông tin người dùng' : 'Thêm người dùng mới'}</h2>
        <form onSubmit={handleSubmit}>
          
          <div className="form-group">
            <label>Email {!editingUser && '*'}</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              disabled={!!editingUser}
              required={!editingUser}
            />
            {editingUser && <small className="text-muted">Không thể thay đổi email.</small>}
          </div>

          {!editingUser && (
            <div className="form-group">
              <label>Mật khẩu *</label>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Họ và Tên</label>
            <input 
              type="text" 
              name="full_name" 
              value={formData.full_name} 
              onChange={handleChange} 
            />
          </div>

          <div className="form-group">
            <label>Số điện thoại</label>
            <input 
              type="text" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
            />
          </div>

          <div className="form-group">
            <label>Vai trò *</label>
            <select name="role" value={formData.role} onChange={handleChange} required>
              <option value="manager">Manager (Quản trị)</option>
              <option value="coordinator">Coordinator (Điều phối)</option>
              <option value="accountant">Accountant (Kế toán)</option>
              <option value="driver">Driver (Tài xế)</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Huỷ</button>
            <button type="submit" className="btn-save">Lưu lại</button>
          </div>
        </form>
      </div>
    </div>
  );
}
