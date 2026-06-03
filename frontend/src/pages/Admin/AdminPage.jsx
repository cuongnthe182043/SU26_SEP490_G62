import React, { useState } from "react";
import UserList from "../../features/admin/UserList";
import "../../pages/Admin/Admin.css";

export default function AdminPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("users");

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>Admin Panel</h2>
        </div>

        <nav className="admin-nav">
          <button
            className={`nav-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            User management
          </button>
        </nav>

        <div className="admin-user-info">
          <p className="user-name">{user.full_name || user.email}</p>
          <span className="user-role">Manager</span>
          <button className="logout-btn" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <header className="admin-header">
          <h1>System management</h1>
        </header>

        <section className="admin-body">
          {activeTab === "users" && <UserList />}
        </section>
      </main>
    </div>
  );
}
