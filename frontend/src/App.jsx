import React, { useEffect, useState } from "react";
import Login from "./pages/Login";
import Coordinator from "./pages/Coordinator/coordinator";

import Admin from "./pages/Admin/Admin";

const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:9999";

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingUser(false);
      return;
    }

    const loadCurrentUser = async () => {
      try {
        const response = await fetch(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Không thể lấy thông tin user.");
        }
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      } catch (err) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        setLoadingUser(false);
      }
    };

    loadCurrentUser();
  }, []);

  const handleLoginSuccess = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const response = await fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (response.ok) {
      setUser(data);
      localStorage.setItem("user", JSON.stringify(data));
    }
  };

  if (loadingUser) {
    return <main className="loading-screen">Đang tải thông tin đăng nhập...</main>;
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (user.role === 'manager') {
    return <Admin user={user} />;
  }

  if (user.role === 'coordinator') {
    return <Coordinator user={user} />;
  }
  
  return <main className="loading-screen">Chưa có trang cho chức vụ này.</main>;
}
