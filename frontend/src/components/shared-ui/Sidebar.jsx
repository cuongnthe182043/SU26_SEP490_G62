import { Tooltip } from "@heroui/react";
import {
  RiLogoutBoxLine,
  RiArrowRightSLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
} from "react-icons/ri";
import Logo from "../../theme/Logo";
import { confirmDialog } from "./confirm";
import { APP_NAME } from "../../constants/brand";

function NavItem({ navKey, label, icon: Icon, disabled, active, collapsed, onViewChange }) {
  const base =
    "flex items-center gap-3 rounded-xl w-full text-left text-sm transition-all duration-150 " +
    (collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5");

  const button = (
    <button
      disabled={disabled}
      onClick={() => !disabled && onViewChange(navKey)}
      className={`group ${base}
        ${disabled
          ? "text-gray-300 dark:text-gray-600 cursor-not-allowed select-none"
          : active
            ? "bg-blue-600 text-white font-semibold shadow-sm shadow-blue-200 dark:shadow-none"
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-100"
        }`}
    >
      <Icon
        size={18}
        className={
          disabled
            ? "text-gray-300 dark:text-gray-600"
            : active
              ? "text-white shrink-0"
              : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 shrink-0"
        }
      />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && active && !disabled && (
        <RiArrowRightSLine size={16} className="text-blue-200" />
      )}
    </button>
  );

  if (collapsed || disabled) {
    return (
      <Tooltip content={disabled ? "Đang phát triển" : label} placement="right" color="foreground">
        {button}
      </Tooltip>
    );
  }

  return button;
}

/**
 * Sidebar dùng chung cho Accountant/Coordinator/Manager.
 * navGroups: [{ label, items: [{ key, label, icon, disabled }] }]
 */
function getDisplayName(user, fallback) {
  return user?.full_name || user?.email || fallback;
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function UserAvatar({ user, collapsed, fallbackName }) {
  const displayName = getDisplayName(user, fallbackName);
  const avatarUrl = user?.avatar_url || user?.avatarUrl || "";
  const sizeClass = collapsed ? "w-8 h-8" : "w-7 h-7";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className={`${sizeClass} rounded-full object-cover object-center shrink-0 border border-gray-100 dark:border-white/10 bg-gray-100 dark:bg-white/10`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold ${collapsed ? "text-[11px]" : "text-[10px]"} shrink-0`}
      title={displayName}
    >
      {getInitials(displayName)}
    </div>
  );
}

export function Sidebar({
  navGroups,
  brandLabel = APP_NAME,
  brandSubLabel = "",
  activeView,
  onViewChange,
  user,
  onLogout,
  onProfile,
  collapsed,
  onToggle,
}) {
  const displayName = getDisplayName(user, brandLabel);
  const handleLogout = async () => {
    if (await confirmDialog({
      title: "Đăng xuất",
      description: "Bạn có chắc muốn đăng xuất khỏi phiên làm việc hiện tại?",
      confirmLabel: "Đăng xuất",
      danger: true,
    })) {
      onLogout?.();
    }
  };

  return (
    <aside
      className={`g62-sidebar flex flex-col min-h-screen bg-white dark:bg-[#161922] border-r border-gray-200 dark:border-white/10 shrink-0
                  transition-all duration-200 ${collapsed ? "w-15" : "w-55"}`}
    >
      <div className={`flex items-center h-16 border-b border-gray-100 dark:border-white/10
                       ${collapsed ? "justify-center px-0" : "gap-3 px-4"}`}>
        {!collapsed && (
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-gray-50 dark:bg-white/10 border border-gray-100 dark:border-white/10">
            <Logo className="w-full h-full rounded-xl object-cover object-top" />
          </div>
        )}
        {!collapsed && (
          <div className="flex flex-col flex-1 min-w-0">
            <span className="font-bold text-sm text-gray-800 dark:text-gray-100 leading-none truncate">{brandLabel}</span>
            {brandSubLabel && <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{brandSubLabel}</span>}
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-gray-400
                     hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-gray-200 transition-colors shrink-0"
          title={collapsed ? "Mở sidebar" : "Thu sidebar"}
        >
          {collapsed ? <RiMenuUnfoldLine size={17} /> : <RiMenuFoldLine size={17} />}
        </button>
      </div>

      <nav className={`flex-1 py-4 flex flex-col gap-5 overflow-y-auto overflow-x-hidden
                       ${collapsed ? "px-1" : "px-3"}`}>
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {label}
              </p>
            )}
            {collapsed && <div className="mb-1.5 border-t border-gray-100 dark:border-white/10 mx-1" />}
            <div className="flex flex-col gap-0.5">
              {items.map(({ key, label: itemLabel, icon, disabled }) => (
                <NavItem
                  key={key}
                  navKey={key}
                  label={itemLabel}
                  icon={icon}
                  disabled={disabled}
                  active={activeView === key}
                  collapsed={collapsed}
                  onViewChange={onViewChange}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={`pb-4 flex flex-col gap-1 border-t border-gray-100 dark:border-white/10 pt-3
                       ${collapsed ? "px-1 items-center" : "px-3"}`}>
        {collapsed ? (
          <>
            <Tooltip content={displayName || "Hồ sơ"} placement="right" color="foreground">
              <button
                onClick={onProfile}
                className="w-8 h-8 rounded-full flex items-center justify-center
                           hover:ring-2 hover:ring-blue-300 transition-all overflow-hidden"
              >
                <UserAvatar user={user} collapsed fallbackName={brandLabel} />
              </button>
            </Tooltip>
            <Tooltip content="Đăng xuất" placement="right" color="foreground">
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-8 h-8 rounded-lg
                           bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300
                           hover:bg-red-700 hover:text-white dark:hover:bg-red-600 dark:hover:text-white transition-colors"
              >
                <RiLogoutBoxLine size={16} />
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              onClick={onProfile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full text-left
                         text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-100
                         transition-colors duration-150"
            >
              <UserAvatar user={user} fallbackName={brandLabel} />
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-gray-700 dark:text-gray-200 truncate text-xs leading-tight">
                  {displayName}
                </span>
                <span className="text-gray-400 dark:text-gray-500 truncate text-[11px] mt-0.5">
                  {user?.email ?? ""}
                </span>
              </div>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-xl w-full text-left
                         text-sm bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300
                         hover:bg-red-700 hover:text-white dark:hover:bg-red-600 dark:hover:text-white
                         transition-colors duration-150"
            >
              <RiLogoutBoxLine size={16} />
              <span>Đăng xuất</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
