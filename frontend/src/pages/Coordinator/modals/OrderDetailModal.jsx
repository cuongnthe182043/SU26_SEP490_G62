import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip } from "@heroui/react";
import {
  RiCalendarLine, RiFileTextLine, RiMoneyDollarCircleLine, RiPhoneLine, RiShoppingBag3Line,
  RiScales3Line, RiTruckLine, RiUserLine,
} from "react-icons/ri";
import { RouteStops } from "../../../components/shared-ui/RouteStops";
import { StatusBadge } from "../../../components/shared-ui/StatusBadge";
import { formatCurrency } from "../utils";

const infoIcon = (Icon) => <Icon size={15} className="text-gray-400 dark:text-gray-400 shrink-0" />;

function InfoTile({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{value || "-"}</div>
    </div>
  );
}

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

export default function OrderDetailModal({ open, order, onClose }) {
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
            <InfoTile icon={infoIcon(RiMoneyDollarCircleLine)} label="Ứng trước" value={formatCurrency(order.prepaidAmount)} />
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
