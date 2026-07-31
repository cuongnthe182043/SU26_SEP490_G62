import { useState, useEffect, useMemo } from "react";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip,
  Checkbox, Select, SelectItem,
} from "@heroui/react";
import {
  RiCalendarLine, RiFileTextLine, RiMoneyDollarCircleLine, RiPhoneLine, RiShoppingBag3Line,
  RiScales3Line, RiTruckLine, RiUserLine, RiUserAddLine, RiErrorWarningLine,
} from "react-icons/ri";
import { RouteStops } from "../../../components/shared-ui/RouteStops";
import { StatusBadge } from "../../../components/shared-ui/StatusBadge";
import { formatCurrency } from "../utils";

const infoIcon = (Icon) => <Icon size={15} className="text-gray-400 dark:text-gray-400 shrink-0" />;

function InfoTile({ icon, label, value, extra }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{value || "-"}</div>
      {extra}
    </div>
  );
}

const PREPAID_STATUS_LABEL = {
  pending: { label: "Chờ xác nhận", color: "warning" },
  confirmed: { label: "Đã xác nhận", color: "success" },
};

function ShipmentCard({ shipment }) {
  const pickups = shipment.pickup_addresses?.length ? shipment.pickup_addresses : [shipment.pickup_address].filter(Boolean);
  const deliveries = shipment.delivery_addresses?.length ? shipment.delivery_addresses : [shipment.delivery_address].filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-xs font-bold text-blue-600 dark:text-blue-300">
            {shipment.shipment_index || "-"}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
              Chuyến {shipment.shipment_index || "-"}{shipment.shipment_id ? ` #${shipment.shipment_id}` : ""}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-400 truncate">
              {shipment.trip_code || shipment.plate || "Chưa có mã chuyến"}
            </div>
          </div>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <RouteStops pickups={pickups} deliveries={deliveries} className="text-xs text-gray-500 dark:text-gray-400" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <InfoTile icon={infoIcon(RiTruckLine)} label="BKS" value={shipment.plate} />
        <InfoTile icon={infoIcon(RiUserLine)} label="Tài xế" value={shipment.driverName} />
        <InfoTile icon={infoIcon(RiScales3Line)} label="Quãng đường" value={shipment.distance ? `${shipment.distance} km` : "-"} />
        <InfoTile icon={infoIcon(RiMoneyDollarCircleLine)} label="Cước" value={formatCurrency(shipment.fare)} />
      </div>
    </div>
  );
}

// Chuyến giao thất bại được xử lý ở màn Sự cố: tài báo thất bại là hệ thống tự mở
// một sự cố "khách từ chối nhận", điều phối vào đó bấm cho giao lại / cho hoàn hàng.
// Ở đây chỉ nhắc để không ai ngồi chờ nút trong màn đơn hàng.
function FailedShipmentsNotice({ order }) {
  const failed = useMemo(
    () => (order.trips || []).filter((t) => t.shipment_id && t.status === "failed"),
    [order.trips],
  );

  if (failed.length === 0) return null;

  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-rose-50/60 dark:bg-rose-500/[0.07] p-4">
      <div className="flex items-center gap-2 mb-1">
        <RiErrorWarningLine size={15} className="text-rose-600 dark:text-rose-300" />
        <span className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
          Chuyến giao thất bại — xử lý ở màn Sự cố
        </span>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Mỗi chuyến giao thất bại đã tự sinh một sự cố. Mở <b>Sự cố</b> → <b>Xử lý</b> để cho giao
        lại hoặc cho hoàn hàng (hoàn hàng thì chuyến tính gấp đôi cước). Tài xế đang chờ quyết
        định và không tự chuyển trạng thái được.
      </p>
      <div className="flex flex-wrap gap-2">
        {failed.map((t) => (
          <span
            key={t.shipment_id}
            className="rounded-lg border border-rose-100 dark:border-rose-500/20 bg-white/70 dark:bg-white/[0.03] px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200"
          >
            <b>Chuyến {t.shipment_index}</b> <span className="text-gray-400 dark:text-gray-500">#{t.shipment_id}</span>
            {t.driverName ? ` · ${t.driverName}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// Gán trước chuyến cho tài xế. Chỉ chuyến còn 'available' và chưa có tài mới gán được.
// Một đơn có thể gán NHIỀU chuyến cho CÙNG một tài (chạy tuần tự), hoặc chia mỗi
// chuyến cho một tài khác nhau — backend chỉ chặn khi tài đang vướng đơn KHÁC.
function AssignShipmentsPanel({ order, drivers, onAssign }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [driverId, setDriverId] = useState(null);
  const [busy, setBusy] = useState(false);

  const assignable = useMemo(() => (order.trips || []).filter(
    (t) => t.shipment_id && t.status === "available" && !t.owner_driver_id,
  ), [order.trips]);

  // Đơn khác / vừa gán xong → bỏ lựa chọn cũ để không gửi id đã hết hiệu lực
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => assignable.some((t) => Number(t.shipment_id) === Number(id))));
  }, [assignable]);

  if (assignable.length === 0) return null;

  const toggle = (shipmentId) => setSelectedIds((prev) => (
    prev.includes(shipmentId) ? prev.filter((id) => id !== shipmentId) : [...prev, shipmentId]
  ));

  const handleAssign = async () => {
    setBusy(true);
    try {
      await onAssign({ shipmentIds: selectedIds, driverId: Number(driverId) });
      setSelectedIds([]);
      setDriverId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/[0.06] p-4">
      <div className="flex items-center gap-2 mb-1">
        <RiUserAddLine size={15} className="text-blue-600 dark:text-blue-300" />
        <span className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Gán chuyến cho tài xế
        </span>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        Chọn nhiều chuyến cho cùng một tài xế thì tài chạy lần lượt — xong chuyến trước, chuyến
        sau tự mở. Tài đang chạy chuyến của đơn khác sẽ không gán được.
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {assignable.map((t) => (
          <Checkbox
            key={t.shipment_id}
            size="sm"
            isSelected={selectedIds.includes(Number(t.shipment_id))}
            onValueChange={() => toggle(Number(t.shipment_id))}
          >
            <span className="text-xs text-gray-700 dark:text-gray-200">
              Chuyến {t.shipment_index} <span className="text-gray-400 dark:text-gray-500">#{t.shipment_id}</span>
              {t.pickup_address || t.delivery_address
                ? ` · ${[t.pickup_address, t.delivery_address].filter(Boolean).join(" → ")}`
                : ""}
            </span>
          </Checkbox>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <Select
          label="Tài xế"
          placeholder="Chọn tài xế"
          size="sm"
          className="flex-1"
          selectedKeys={driverId ? [String(driverId)] : []}
          onSelectionChange={(keys) => setDriverId([...keys][0] ?? null)}
          variant="bordered"
        >
          {(drivers || []).map((d) => (
            <SelectItem key={String(d.id)}>{d.full_name || d.name}</SelectItem>
          ))}
        </Select>
        <Button
          color="primary"
          size="md"
          isDisabled={selectedIds.length === 0 || !driverId}
          isLoading={busy}
          startContent={!busy && <RiUserAddLine size={16} />}
          onPress={handleAssign}
        >
          {selectedIds.length > 1 ? `Gán ${selectedIds.length} chuyến` : "Gán chuyến"}
        </Button>
      </div>
    </div>
  );
}

export default function OrderDetailModal({ open, order, onClose, drivers, onAssignShipments }) {
  if (!order) return null;

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <RiShoppingBag3Line size={17} />
            </span>
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">Chi tiết đơn hàng #{order.orderId}</span>
            <StatusBadge status={order.statusClass} />
          </div>
          <span className="text-xs font-normal text-gray-400 dark:text-gray-400">
            {order.customerName || "Khách hàng chưa cập nhật"}{order.customerPhone ? ` - ${order.customerPhone}` : ""}
          </span>
        </ModalHeader>

        <ModalBody className="gap-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile icon={infoIcon(RiUserLine)} label="Khách hàng" value={order.customerName} />
            <InfoTile icon={infoIcon(RiPhoneLine)} label="SĐT" value={order.customerPhone} />
            <InfoTile icon={infoIcon(RiCalendarLine)} label="Ngày" value={order.date || order.dateInput} />
            <InfoTile icon={infoIcon(RiMoneyDollarCircleLine)} label="Tổng cước" value={formatCurrency(order.fare)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile icon={infoIcon(RiFileTextLine)} label="Hàng hóa" value={order.cargoName} />
            <InfoTile icon={infoIcon(RiScales3Line)} label="Khối lượng" value={order.cargoWeightKg ? `${order.cargoWeightKg} kg` : "-"} />
            <InfoTile
              icon={infoIcon(RiMoneyDollarCircleLine)}
              label="Ứng trước"
              value={formatCurrency(order.prepaidAmount)}
              extra={PREPAID_STATUS_LABEL[order.prepaidStatus] && (
                <Chip size="sm" variant="flat" color={PREPAID_STATUS_LABEL[order.prepaidStatus].color} className="mt-1.5 text-[10px] h-5">
                  {PREPAID_STATUS_LABEL[order.prepaidStatus].label}
                </Chip>
              )}
            />
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400">Nguồn đơn</div>
              <div className="mt-1">
                <Chip size="sm" variant="flat" color={order.is_partner ? "secondary" : "primary"}>
                  {order.is_partner ? (order.partner_name || "Đối tác") : "Khách trực tiếp"}
                </Chip>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-400">
              Hành trình ({order.shipmentCount || order.trips?.length || 0} chuyến)
            </div>
            <div className="flex flex-col gap-3">
              {(order.trips || []).map((shipment) => (
                <ShipmentCard key={shipment.shipment_id || shipment.shipment_index} shipment={shipment} />
              ))}
            </div>
          </div>

          <FailedShipmentsNotice order={order} />

          {onAssignShipments && (
            <AssignShipmentsPanel order={order} drivers={drivers} onAssign={onAssignShipments} />
          )}

          {order.notes && (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400">Ghi chú</div>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Đóng</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
