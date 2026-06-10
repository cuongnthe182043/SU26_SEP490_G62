import React, { useEffect, useState } from "react";
import UserList from "../../features/admin/UserList";
import VehicleGroupList from "../../features/admin/VehicleGroupList";
import VehicleList from "../../features/admin/VehicleList";
import { fetchVehicleGroups } from "../../features/admin/vehicleManagementApi";
import AppSidebar from "../../components/layout/AppSidebar";
import AppHeader from "../../components/layout/AppHeader";
import { C } from "../../styles/theme";


export default function AdminPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("users");
  const [collapsed, setCollapsed] = useState(false);
  const [vehicleGroups, setVehicleGroups] = useState([]);

  useEffect(() => {
    if (activeTab !== "vehicle-groups" && activeTab !== "vehicles") return;
    fetchVehicleGroups()
      .then((data) => setVehicleGroups(data.vehicleGroups || []))
      .catch(() => setVehicleGroups([]));
  }, [activeTab]);

  const handleLogout = () => {
    if (onLogout) { onLogout(); return; }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.surface }}>

      <AppSidebar
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={collapsed}
        onCollapse={setCollapsed}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader user={user} onLogout={handleLogout} />

        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 1440,
          width: '100%',
          margin: '0 auto',
          alignSelf: 'stretch',
        }}>

          {/* ── Feature content ── */}
          <div>
            {activeTab === "users" && <UserList />}
            {activeTab === "vehicle-groups" && <VehicleGroupList />}
            {activeTab === "vehicles" && <VehicleList vehicleGroups={vehicleGroups} />}
          </div>

        </main>
      </div>
    </div>
  );
}
