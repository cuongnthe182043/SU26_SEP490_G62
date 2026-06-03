import React, { useEffect, useState } from "react";
import { Button } from "antd";
import "../../styles/admin/UserModal.css";

const initialFormState = {
  email: "",
  full_name: "",
  phone: "",
  role: "driver",
};

export default function UserModal({ isOpen, onClose, onSave, editingUser }) {
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (editingUser) {
      setFormData({
        email: editingUser.email || "",
        full_name: editingUser.full_name || "",
        phone: editingUser.phone || "",
        role: editingUser.role || "driver",
      });
      return;
    }

    setFormData(initialFormState);
  }, [editingUser, isOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{editingUser ? "Edit user" : "Add new user"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email {!editingUser && "*"}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={!!editingUser}
              required={!editingUser}
            />
            {editingUser && <small className="text-muted">Email cannot be changed.</small>}
          </div>



          <div className="form-group">
            <label>Full name</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label>Role *</label>
            <select name="role" value={formData.role} onChange={handleChange} required>
              <option value="manager">Manager</option>
              <option value="coordinator">Coordinator</option>
              <option value="accountant">Accountant</option>
              <option value="driver">Driver</option>
            </select>
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button onClick={onClose}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
