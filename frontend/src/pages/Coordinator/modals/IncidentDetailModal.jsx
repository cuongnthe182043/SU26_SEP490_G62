import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Select, SelectItem, Textarea, Input, Checkbox,
} from "@heroui/react";

export default function IncidentDetailModal({ open, incident, incidentForm, setIncidentForm, saving, drivers, onClose, onSubmit, compensation, setCompensation }) {
  if (!incident) return null;

  const replacementOptions = drivers.filter((driver) => {
    if (!driver?.vehicle_id) return false;
    if (driver.has_active_trip) return false;
    return Number(driver.id) !== Number(incident.current_driver_id || incident.reported_by);
  });

  const showCompensation = Boolean(compensation && setCompensation);
  const updateCompensation = (patch) => setCompensation?.((prev) => ({ ...prev, ...patch }));

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-base font-bold text-gray-900">Sự cố #{incident.id}</span>
          <span className="text-xs font-normal text-gray-400">{incident.description || "Không có mô tả."}</span>
        </ModalHeader>
        <ModalBody className="gap-4">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Chuyến" value={incident.shipment_id ? `#${incident.shipment_id}` : "-"} isReadOnly variant="bordered" />
            <Input label="Tài xế báo cáo" value={incident.reported_by_name || "-"} isReadOnly variant="bordered" />
            <Input
              label="Quy tắc doanh thu"
              value={incident.pickup_completed ? "Đã lấy hàng - chia 50/50" : "Chưa lấy hàng - tài xế thay thế nhận 100%"}
              isReadOnly
              variant="bordered"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Trạng thái"
              selectedKeys={[incidentForm.status]}
              onSelectionChange={(keys) => setIncidentForm((prev) => ({ ...prev, status: [...keys][0] }))}
              variant="bordered"
            >
              <SelectItem key="open">Mới tiếp nhận</SelectItem>
              <SelectItem key="investigating">Đang xử lý</SelectItem>
              <SelectItem key="resolved">Đã giải quyết</SelectItem>
              <SelectItem key="closed">Đã đóng</SelectItem>
            </Select>
            <Select
              label="Tài xế thay thế"
              placeholder="Không đổi tài xế"
              selectedKeys={incidentForm.replacement_driver_id ? [incidentForm.replacement_driver_id] : []}
              onSelectionChange={(keys) => setIncidentForm((prev) => ({ ...prev, replacement_driver_id: [...keys][0] ?? "" }))}
              variant="bordered"
            >
              {replacementOptions.map((driver) => (
                <SelectItem key={String(driver.id)}>{`${driver.full_name} - ${driver.plate_number || "Chưa có xe"}`}</SelectItem>
              ))}
            </Select>
            <Input label="Đã thay thế" value={incident.replacement_driver_name || "-"} isReadOnly variant="bordered" />
          </div>

          <Textarea
            label="Phản hồi / ghi chú"
            placeholder="Nhập cách xử lý hoặc lý do điều chuyển"
            value={incidentForm.resolution}
            onValueChange={(v) => setIncidentForm((prev) => ({ ...prev, resolution: v }))}
            minRows={4}
            variant="bordered"
          />

          {showCompensation && (
            <div className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
              <Checkbox
                isSelected={compensation.enabled}
                onValueChange={(v) => updateCompensation(
                  v && !compensation.payee && incident.customer_name
                    ? { enabled: v, payee: incident.customer_name }
                    : { enabled: v }
                )}
                size="sm"
              >
                <span className="text-sm font-semibold text-gray-800">Tạo khoản đền bù hàng hóa hư hại</span>
              </Checkbox>
              <p className="text-xs text-gray-400 -mt-1">
                Khi lưu, hệ thống tạo một phiếu chi loại “Đền bù hàng hóa” (chờ Manager duyệt, Kế toán chi).
              </p>

              {compensation.enabled && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      min={0}
                      label="Số tiền đền bù (đồng)"
                      placeholder="0"
                      value={compensation.amount}
                      onValueChange={(v) => updateCompensation({ amount: v })}
                      variant="bordered"
                      isRequired
                    />
                    <Select
                      label="Hình thức chi"
                      selectedKeys={[compensation.payment_method]}
                      onSelectionChange={(keys) => updateCompensation({ payment_method: [...keys][0] })}
                      variant="bordered"
                    >
                      <SelectItem key="cash">Tiền mặt</SelectItem>
                      <SelectItem key="bank_transfer">Chuyển khoản</SelectItem>
                    </Select>
                  </div>
                  <Input
                    label="Người / đơn vị nhận đền bù"
                    placeholder="VD: Khách hàng, chủ hàng..."
                    value={compensation.payee}
                    onValueChange={(v) => updateCompensation({ payee: v })}
                    variant="bordered"
                    isRequired
                  />
                  {incident.customer_name && (
                    <div className="flex items-center gap-2 flex-wrap text-xs -mt-1">
                      <span className="text-gray-500">
                        Khách hàng của đơn{incident.order_id ? ` #${incident.order_id}` : ""}:
                      </span>
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="h-7"
                        onPress={() => updateCompensation({ payee: incident.customer_name })}
                      >
                        Dùng “{incident.customer_name}”
                      </Button>
                    </div>
                  )}
                  <Textarea
                    label="Mô tả hàng hóa hư hại"
                    placeholder="Mô tả thiệt hại làm căn cứ đền bù"
                    value={compensation.reason}
                    onValueChange={(v) => updateCompensation({ reason: v })}
                    minRows={2}
                    variant="bordered"
                  />
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Đóng</Button>
          <Button color="primary" isLoading={saving} onPress={onSubmit}>Lưu xử lý</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
