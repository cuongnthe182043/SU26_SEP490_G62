import React, { Suspense, lazy } from "react";
import LoadingScreen from "../components/LoadingScreen";
import ForceChangePasswordScreen from "../components/ForceChangePasswordScreen";
import { useAuthSession } from "../hooks/useAuthSession";
import LoginPage from "../pages/auth/LoginPage";
import { Toaster } from "../components/shared-ui/Toast";
import { ConfirmRoot } from "../components/shared-ui/confirm";
import { ThemeProvider } from "../theme/ThemeProvider";
import "../styles/global.css";

const ManagerPage = lazy(() => import("../pages/Manager/ManagerPage"));
const AccountantPage = lazy(() => import("../pages/Accountant/AccountantPage"));
const CoordinatorPage = lazy(() => import("../pages/Coordinator/CoordinatorPage"));
const ChatbotWidget = lazy(() => import("../components/chatbot/ChatbotWidget"));

function AppShell() {
  const { user, loading, setSession, refreshSession, logout } = useAuthSession();

  // Chỉ hiện trợ lý AI khi đã đăng nhập xong (không ở màn login / đổi mật khẩu bắt buộc).
  const showChatbot = Boolean(user) && !user?.must_change_password;

  const renderPage = () => {
    if (loading) return <LoadingScreen label="Đang tải..." />;
    if (!user) return <LoginPage onLoginSuccess={setSession} />;
    if (user.must_change_password) {
      return <ForceChangePasswordScreen user={user} onChanged={refreshSession} onLogout={logout} />;
    }
    if (user.role === "manager") return <ManagerPage user={user} onLogout={logout} />;
    if (user.role === "coordinator") return <CoordinatorPage user={user} onLogout={logout} />;
    if (user.role === "accountant") return <AccountantPage user={user} onLogout={logout} />;
    return <LoadingScreen label="Không có trang cho vai trò này." />;
  };

  const content = renderPage();

  return (
    <>
      <Suspense fallback={<LoadingScreen label="Đang tải giao diện..." />}>
        {content}
        {showChatbot && <ChatbotWidget />}
      </Suspense>
      <Toaster />
      <ConfirmRoot />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
