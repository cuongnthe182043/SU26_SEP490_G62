import React from "react";
import LoadingScreen from "../components/LoadingScreen";
import { useAuthSession } from "../hooks/useAuthSession";
import AdminPage from "../pages/Admin/AdminPage";
import CoordinatorPage from "../pages/Coordinator/CoordinatorPage";
import LoginPage from "../pages/auth/LoginPage";

export default function App() {
  const { user, loading, setSession, logout } = useAuthSession();

  if (loading) {
    return <LoadingScreen label="Loading signed-in user..." />;
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setSession} />;
  }

  if (user.role === "manager") {
    return <AdminPage user={user} onLogout={logout} />;
  }

  if (user.role === "coordinator") {
    return <CoordinatorPage user={user} onLogout={logout} />;
  }

  return <LoadingScreen label="No page is available for this role." />;
}
