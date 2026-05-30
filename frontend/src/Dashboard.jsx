import React, { useState, useEffect } from "react";
import "./Dashboard.css";

export default function Dashboard({ user, onLogout }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    fetchUserData();
    fetchRoles();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:9999/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch("http://localhost:9999/roles");
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
      }
    } catch (err) {
      console.error("Failed to fetch roles:", err);
    }
  };

  const getRolePermissions = (role) => {
    const permissions = {
      accountant: ["View Financial Reports", "Manage Accounts", "Export Data"],
      manager: [
        "View Reports",
        "Manage Staff",
        "View Analytics",
        "Approve Transactions",
      ],
      coordinator: [
        "View Operations",
        "Manage Logistics",
        "Schedule Deliveries",
      ],
    };
    return permissions[role] || [];
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={onLogout} className="logout-btn">
          Đăng Xuất
        </button>
      </div>

      <div className="user-info-card">
        <h2>Thông Tin Người Dùng</h2>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Tên:</strong> {user.full_name}
        </p>
        <p>
          <strong>Vai Trò:</strong>{" "}
          <span className="role-badge">{user.role}</span>
        </p>
      </div>

      <div className="permissions-card">
        <h2>Quyền Hạn</h2>
        <ul>
          {getRolePermissions(user.role).map((perm, idx) => (
            <li key={idx}>✓ {perm}</li>
          ))}
        </ul>
      </div>

      <div className="roles-list">
        <h2>Danh Sách Vai Trò</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Mô Tả</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>{role.id}</td>
                <td>{role.name}</td>
                <td>{role.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
