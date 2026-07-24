import React from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import viVN from "antd/locale/vi_VN";
import LoadingScreen from "../components/LoadingScreen";
import ForceChangePasswordScreen from "../components/ForceChangePasswordScreen";
import { useAuthSession } from "../hooks/useAuthSession";
import ManagerPage from "../pages/Manager/ManagerPage";
import AccountantPage from "../pages/Accountant/AccountantPage";
import CoordinatorPage from "../pages/Coordinator/CoordinatorPage";
import LoginPage from "../pages/auth/LoginPage";
import ChatbotWidget from "../components/chatbot/ChatbotWidget";
import { Toaster } from "../components/shared-ui/Toast";
import { ConfirmRoot } from "../components/shared-ui/confirm";
import { appTheme, appThemeDark } from "../styles/theme";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";
import "../styles/global.css";

function AppShell() {
  const { user, loading, setSession, refreshSession, logout } = useAuthSession();
  const { isDark } = useTheme();

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

  return (
    <ConfigProvider
      theme={{
        ...(isDark ? appThemeDark : appTheme),
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
      locale={viVN}
    >
      {renderPage()}
      {showChatbot && <ChatbotWidget />}
      <Toaster />
      <ConfirmRoot />
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
