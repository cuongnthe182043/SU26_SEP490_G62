import { lazy, Suspense, useState } from "react";
import { HeroUIProvider } from "@heroui/react";
import {
  RiDashboardLine,
  RiBuilding2Line,
  RiUserSearchLine,
  RiUserSettingsLine,
  RiTruckLine,
  RiMoneyDollarCircleLine,
  RiGiftLine,
  RiEqualizerLine,
  RiTrophyLine,
  RiCalendarLine,
  RiBarChart2Line,
} from "react-icons/ri";
import "../../styles/shared-ui.css";

import { Sidebar } from "../../components/shared-ui/Sidebar";
import { TopBar } from "../../components/shared-ui/TopBar";
import { saveSession } from "../../services/storage";
import ProfileModal from "../../components/profile/ProfileModal";

import DashboardView from "./views/DashboardView";
import PartnersView from "./views/PartnersView";
import CustomersView from "./views/CustomersView";
import UsersView from "./views/UsersView";
import VehiclesView from "./views/VehiclesView";
import PayrollView from "./views/PayrollView";
import BonusView from "./views/BonusView";
import BonusRulesView from "./views/BonusRulesView";
import KpiView from "./views/KpiView";
import HolidaysView from "./views/HolidaysView";
import BusinessReportView from "./views/BusinessReportView";

const SpendingView = lazy(() => import("./views/SpendingView"));

const NAV_GROUPS = [
  {
    label: "Tổng quan",
    items: [
      { key: "dashboard", label: "Tổng quan", icon: RiDashboardLine },
      { key: "business-report", label: "Báo cáo kinh doanh", icon: RiBarChart2Line },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { key: "partners", label: "Đối tác", icon: RiBuilding2Line },
      { key: "customers", label: "Khách hàng", icon: RiUserSearchLine },
      { key: "vehicles", label: "Quản lý xe", icon: RiTruckLine },
      { key: "spending", label: "Quản lý chi", icon: RiMoneyDollarCircleLine },
      { key: "kpi", label: "KPI & Xếp hạng", icon: RiTrophyLine },
    ],
  },
  {
    label: "Nhân sự & Lương",
    items: [
      { key: "users", label: "Người dùng", icon: RiUserSettingsLine },
      { key: "payroll", label: "Duyệt lương", icon: RiMoneyDollarCircleLine },
      { key: "bonus", label: "Thưởng & Phúc lợi", icon: RiGiftLine },
      { key: "bonus-rules", label: "Quy tắc thưởng", icon: RiEqualizerLine },
      { key: "holidays", label: "Ngày lễ", icon: RiCalendarLine },
    ],
  },
];

const VIEW_META = {
  dashboard: { title: "Tổng quan quản lý", subtitle: "Phê duyệt, công nợ, phiếu thu và thông tin công ty trên cùng một luồng vận hành." },
  "business-report": { title: "Báo cáo kinh doanh", subtitle: "Lợi nhuận, hiệu suất đội xe, dòng tiền và năng suất tài xế theo từng kỳ — so sánh với kỳ liền trước." },
  partners: { title: "Quản lý đối tác", subtitle: "Quản lý thông tin đối tác và theo dõi công nợ nếu đối tác đang tồn đọng thanh toán." },
  customers: { title: "Quản lý khách hàng", subtitle: "Quản lý thông tin khách hàng thuê vận chuyển." },
  users: { title: "Quản lý người dùng", subtitle: "Quản lý tài khoản, vai trò và trạng thái truy cập." },
  vehicles: { title: "Quản lý xe", subtitle: "Theo dõi phương tiện, tài xế được gán và trạng thái bảo trì." },
  payroll: { title: "Duyệt lương tài xế", subtitle: "Xác nhận bảng lương tài xế trước khi kế toán chi trả." },
  bonus: { title: "Thưởng & Phúc lợi", subtitle: "Duyệt thưởng Tết, phúc lợi kết hôn/tang gia/sinh nhật và thưởng đặc biệt." },
  "bonus-rules": { title: "Quy tắc thưởng", subtitle: "Cấu hình ngưỡng và số tiền thưởng KPI, thưởng doanh thu theo từng nhóm xe." },
  kpi: { title: "KPI & Xếp hạng", subtitle: "Theo dõi KPI và bảng xếp hạng của toàn bộ tài xế theo tháng, theo nhóm xe." },
  holidays: { title: "Quản lý ngày lễ", subtitle: "Danh mục ngày lễ hưởng nguyên lương — tài xế đi làm ngày lễ được tính 200% lương." },
  spending: { title: "Quản lý chi", subtitle: "Duyệt chi phí tài xế, duyệt phiếu chi và theo dõi tổng hợp mọi khoản chi của công ty." },
};

const VIEW_STORAGE_KEY = "manager_active_view";

// entity_type (backend gắn vào thông báo) → view của Manager. Thực thể không có
// trong bảng thì về dashboard (nơi có các hàng đợi tổng hợp).
const NOTIFICATION_VIEW_BY_ENTITY = {
  payroll: "payroll",
  salary_advance: "dashboard",
  salary_advances: "dashboard",
  driver_bonuses: "bonus",
  bonus_rules: "bonus-rules",
  partner: "partners",
  debts: "dashboard",
  debt_payments: "dashboard",
  expenses: "spending",
  payment_vouchers: "spending",
  vehicle: "vehicles",
  vehicle_groups: "vehicles",
  maintenance_record: "vehicles",
  incidents: "dashboard",
  orders: "dashboard",
  shipments: "dashboard",
  receipt: "dashboard",
  reports: "business-report",
  users: "users",
};
const VALID_VIEWS = Object.keys(VIEW_META);

const getInitialView = () => {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved && VALID_VIEWS.includes(saved)) return saved;
  } catch { /* localStorage bị chặn thì dùng mặc định */ }
  return "dashboard";
};

export default function ManagerPage({ user, onLogout }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [activeView, setActiveView] = useState(getInitialView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleViewChange = (view) => {
    setActiveView(view);
    try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch { /* ignore */ }
  };

  // Bấm 1 thông báo → nhảy tới màn liên quan (theo entity_type backend gắn).
  const handleNotificationSelect = (notification) => {
    const view = NOTIFICATION_VIEW_BY_ENTITY[notification?.entity_type];
    if (view) handleViewChange(view);
  };

  const handleLogout = () => onLogout?.();

  const handleProfileUpdated = (nextProfile) => {
    const merged = { ...currentUser, ...nextProfile };
    setCurrentUser(merged);
    saveSession({ user: merged });
  };

  const meta = VIEW_META[activeView] ?? VIEW_META.dashboard;

  return (
    <HeroUIProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-[#0e1016] overflow-hidden">
        <Sidebar
          navGroups={NAV_GROUPS}
          brandLabel="LogisCount"
          brandSubLabel="Quản lý"
          activeView={activeView}
          onViewChange={handleViewChange}
          user={currentUser}
          onLogout={handleLogout}
          onProfile={() => setProfileOpen(true)}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar title={meta.title} subtitle={meta.subtitle} onNotificationSelect={handleNotificationSelect} />

          <main className="flex-1 overflow-y-auto p-6">
            {activeView === "dashboard" && <DashboardView user={currentUser} />}
            {activeView === "business-report" && <BusinessReportView />}
            {activeView === "partners" && <PartnersView user={currentUser} />}
            {activeView === "customers" && <CustomersView />}
            {activeView === "users" && <UsersView user={currentUser} />}
            {activeView === "vehicles" && <VehiclesView user={currentUser} />}
            {activeView === "payroll" && <PayrollView />}
            {activeView === "bonus" && <BonusView />}
            {activeView === "bonus-rules" && <BonusRulesView />}
            {activeView === "kpi" && <KpiView />}
            {activeView === "holidays" && <HolidaysView />}
            {activeView === "spending" && (
              <Suspense fallback={<div className="p-6 text-sm text-gray-500">Đang tải quản lý chi...</div>}>
                <SpendingView />
              </Suspense>
            )}
          </main>
        </div>
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onProfileUpdated={handleProfileUpdated}
      />
    </HeroUIProvider>
  );
}
