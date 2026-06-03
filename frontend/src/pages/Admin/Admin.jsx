import React, { useState } from 'react';
import UserList from './UserList';
import './Admin.css';

export default function Admin({ user }) {
  const [activeTab, setActiveTab] = useState('users');

  const handleLogout = () => {
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
            className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Người dùng
          </button>
        </nav>
        <div className="admin-user-info">
          <p className="user-name">{user.full_name || user.email}</p>
          <span className="user-role">Manager</span>
          <button className="logout-btn" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="admin-content">
        <header className="admin-header">
          <h1>Quản lý Hệ thống</h1>
        </header>

        <section className="admin-body">
          {activeTab === 'users' && <UserList />}
        </section>
      </main>
    </div>
  );
}
