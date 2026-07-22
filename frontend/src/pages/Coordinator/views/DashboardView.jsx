import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";
import {
  RiTruckLine,
  RiInboxLine,
  RiRoadMapLine,
  RiAlertLine,
  RiFileList3Line,
  RiWallet3Line,
} from "react-icons/ri";
import { StatCard } from "../../../components/shared-ui/StatCard";
import { Section } from "../../../components/shared-ui/Section";
import { StatusBadge } from "../../../components/shared-ui/StatusBadge";
import { coordinatorService } from "../services/coordinator.service";
import { incidentTypeLabel } from "../utils";

const CARD_META = [
  { key: "active_orders", label: "Đơn đang xử lý", icon: RiInboxLine, gradient: "from-blue-500 to-blue-600", lightBg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-300", border: "border-blue-100 dark:border-blue-500/20" },
  { key: "pool_trips", label: "Chuyến trong Trip Pool", icon: RiRoadMapLine, gradient: "from-sky-500 to-sky-600", lightBg: "bg-sky-50 dark:bg-sky-500/10", text: "text-sky-600 dark:text-sky-300", border: "border-sky-100 dark:border-sky-500/20" },
  { key: "active_trips", label: "Chuyến đang chạy", icon: RiTruckLine, gradient: "from-teal-500 to-teal-600", lightBg: "bg-teal-50 dark:bg-teal-500/10", text: "text-teal-600 dark:text-teal-300", border: "border-teal-100 dark:border-teal-500/20" },
  { key: "open_incidents", label: "Sự cố đang mở", icon: RiAlertLine, gradient: "from-rose-500 to-rose-600", lightBg: "bg-rose-50 dark:bg-rose-500/10", text: "text-rose-600 dark:text-rose-300", border: "border-rose-100 dark:border-rose-500/20" },
  { key: "pending_receipts", label: "Phiếu thu chờ duyệt", icon: RiFileList3Line, gradient: "from-amber-500 to-amber-600", lightBg: "bg-amber-50 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-300", border: "border-amber-100 dark:border-amber-500/20" },
  { key: "pending_expenses", label: "Chi phí chờ duyệt", icon: RiWallet3Line, gradient: "from-purple-500 to-purple-600", lightBg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-600 dark:text-purple-300", border: "border-purple-100 dark:border-purple-500/20" },
];

export default function DashboardView({ refreshKey }) {
  const [overview, setOverview] = useState({});
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    coordinatorService.getDashboard()
      .then((data) => {
        if (cancelled) return;
        setOverview(data.overview || {});
        setIncidents(data.recent_incidents || []);
      })
      .catch((err) => !cancelled && setError(err.message ?? "Không thể tải tổng quan."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner color="primary" label="Đang tải tổng quan..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
          <RiAlertLine size={22} className="text-rose-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-6 gap-4">
        {CARD_META.map(({ key, label, icon, gradient, lightBg, text, border }) => (
          <StatCard
            key={key}
            label={label}
            value={overview[key] ?? 0}
            icon={icon}
            gradient={gradient}
            lightBg={lightBg}
            text={text}
            border={border}
          />
        ))}
      </div>

      <Section title="Sự cố đang mở gần đây" icon={RiAlertLine}>
        {incidents.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-400 text-center py-8">Không có sự cố nào đang mở.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50 dark:divide-white/10">
            {incidents.map((incident) => (
              <div key={incident.id} className="flex items-center justify-between py-3 gap-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">#{incident.id}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-400">{incidentTypeLabel(incident.incident_type)}</span>
                    {incident.shipment_id && (
                      <span className="text-xs text-gray-400 dark:text-gray-400">· Chuyến #{incident.shipment_id}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{incident.reported_by_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={incident.severity_level} />
                  <StatusBadge status={incident.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
