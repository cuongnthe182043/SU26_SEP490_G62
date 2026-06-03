import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button, Space, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined, LeftOutlined, RightOutlined, DoubleLeftOutlined, DoubleRightOutlined } from "@ant-design/icons";
import { apiRequest } from "../../services/apiClient";
import UserModal from "./UserModal";
import "../../styles/admin/UserModal.css";
import "../../styles/admin/Toast.css";

const PAGE_SIZE = 10;

function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
  };

  return { toasts, addToast };
}

function ConfirmModal({ isOpen, message, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: 360 }}>
        <h2>Confirm</h2>
        <p style={{ color: "#374151", marginBottom: 24 }}>{message}</p>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button type="primary" danger onClick={onConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function sortUsers(users, sortField, sortDir) {
  return [...users].sort((a, b) => {
    let valueA = a[sortField] ?? "";
    let valueB = b[sortField] ?? "";

    if (typeof valueA === "boolean") {
      valueA = valueA ? 1 : 0;
      valueB = valueB ? 1 : 0;
    }

    if (valueA < valueB) return sortDir === "asc" ? -1 : 1;
    if (valueA > valueB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

export default function UserList() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [confirm, setConfirm] = useState({
    open: false,
    message: "",
    onConfirm: null,
  });
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const { toasts, addToast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const data = await apiRequest("/api/admin/users", { token });
      setAllUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return allUsers;
    }

    return allUsers.filter((user) => {
      return (
        String(user.id).includes(query) ||
        (user.full_name || "").toLowerCase().includes(query) ||
        (user.email || "").toLowerCase().includes(query) ||
        (user.phone || "").toLowerCase().includes(query) ||
        (user.role || "").toLowerCase().includes(query)
      );
    });
  }, [allUsers, deferredSearch]);

  const sortedUsers = useMemo(
    () => sortUsers(filteredUsers, sortField, sortDir),
    [filteredUsers, sortField, sortDir],
  );

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageUsers = useMemo(() => {
    return sortedUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [safePage, sortedUsers]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }

    setPage(1);
  };

  const sortIcon = (field) => {
    if (sortField !== field) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (formData) => {
    try {
      const token = localStorage.getItem("token");
      const url = editingUser ? `/api/admin/users/${editingUser.id}` : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";

      const data = await apiRequest(url, {
        method,
        token,
        body: formData,
      });

      addToast(data.message || "Saved successfully.", "success");
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      addToast(err.message || "An error occurred.", "error");
    }
  };

  const handleToggleStatus = (user) => {
    const action = user.is_active ? "lock" : "unlock";
    setConfirm({
      open: true,
      message: `Are you sure you want to ${action} account "${user.full_name || user.email}"?`,
      onConfirm: async () => {
        setConfirm((current) => ({ ...current, open: false }));

        try {
          const token = localStorage.getItem("token");
          const data = await apiRequest(`/api/admin/users/${user.id}/status`, {
            method: "PATCH",
            token,
            body: { is_active: !user.is_active },
          });

          addToast(data.message || "Updated successfully.", "success");
          fetchUsers();
        } catch (err) {
          addToast(err.message || "An error occurred.", "error");
        }
      },
    });
  };

  const getRoleBadge = (role) => {
    const map = {
      manager: "badge-manager",
      coordinator: "badge-coordinator",
      accountant: "badge-accountant",
      driver: "badge-driver",
    };

    return map[role] || "";
  };

  if (loading) return <div className="loading-spinner">Loading data...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="user-list-container">
      <ToastContainer toasts={toasts} />

      <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0 }}>User accounts</h2>
          <span className="user-count" style={{ display: 'inline-block', margin: 0 }}>
            Total: {filteredUsers.length} / {allUsers.length} users
          </span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAdd}>
          Add user
        </Button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, email, phone, role..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>STT</th>
              <th onClick={() => handleSort("full_name")} className="sortable">
                Full name{sortIcon("full_name")}
              </th>
              <th onClick={() => handleSort("email")} className="sortable">
                Email{sortIcon("email")}
              </th>
              <th>Phone</th>
              <th onClick={() => handleSort("role")} className="sortable">
                Role{sortIcon("role")}
              </th>
              <th onClick={() => handleSort("is_active")} className="sortable">
                Status{sortIcon("is_active")}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user, index) => (
              <tr key={user.id}>
                <td className="text-bold">{(safePage - 1) * PAGE_SIZE + index + 1}</td>
                <td>
                  {user.full_name || <span className="text-muted">Not set</span>}
                </td>
                <td>{user.email}</td>
                <td>{user.phone || <span className="text-muted">-</span>}</td>
                <td>
                  <span className={`badge ${getRoleBadge(user.role)}`}>{user.role}</span>
                </td>
                <td>
                  <span className={`badge ${user.is_active ? "badge-active" : "badge-inactive"}`}>
                    {user.is_active ? "Active" : "Locked"}
                  </span>
                </td>
                <td>
                  <Space>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => handleOpenEdit(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="text"
                      danger={user.is_active}
                      icon={user.is_active ? <LockOutlined /> : <UnlockOutlined />}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {user.is_active ? "Lock" : "Unlock"}
                    </Button>
                  </Space>
                </td>
              </tr>
            ))}
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center empty-state">
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
        <Button
          icon={<DoubleLeftOutlined />}
          disabled={safePage <= 1}
          onClick={() => setPage(1)}
        />
        <Button
          icon={<LeftOutlined />}
          disabled={safePage <= 1}
          onClick={() => setPage((current) => current - 1)}
        />
        <span className="page-info" style={{ margin: '0 8px' }}>
          Page {safePage} / {totalPages}
        </span>
        <Button
          icon={<RightOutlined />}
          disabled={safePage >= totalPages}
          onClick={() => setPage((current) => current + 1)}
        />
        <Button
          icon={<DoubleRightOutlined />}
          disabled={safePage >= totalPages}
          onClick={() => setPage(totalPages)}
        />
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
        onCancel={() => setConfirm((current) => ({ ...current, open: false }))}
      />
    </div>
  );
}
