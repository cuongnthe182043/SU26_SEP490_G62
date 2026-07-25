import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";

export default function IncidentDetailModal({
  open,
  incident,
  incidentForm,
  setIncidentForm,
  saving,
  drivers,
  onClose,
  onSubmit,
}) {
  if (!open || !incident) return null;

  const replacementOptions = drivers.filter((driver) => {
    if (!driver?.vehicle_id) return false;
    if (driver.has_active_trip) return false;
    return Number(driver.id) !== Number(incident.current_driver_id || incident.reported_by);
  });

  return (
    <Modal isOpen={open} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Sự cố #{incident.id}</ModalHeader>
        <ModalBody className="pb-6">
          <p style={{ marginTop: -8, color: "#6b7280" }}>{incident.description || "Không có mô tả."}</p>

          <div className="create-form" style={{ paddingTop: 12 }}>
            <div className="sheet-caption full">Thông tin xử lý</div>

            <div className="form-row form-row-3">
              <label>
                <span>Chuyến</span>
                <Input value={incident.shipment_id ? `#${incident.shipment_id}` : "-"} isDisabled />
              </label>
              <label>
                <span>Tài xế báo cáo</span>
                <Input value={incident.reported_by_name || "-"} isDisabled />
              </label>
              <label>
                <span>Quy tắc doanh thu</span>
                <Input
                  value={incident.pickup_completed ? "Đã lấy hàng - chia 50/50" : "Chưa lấy hàng - tài xế thay thế nhận 100%"}
                  isDisabled
                />
              </label>
            </div>

            <div className="form-row form-row-3">
              <label>
                <span>Trạng thái</span>
                <Select
                  selectedKeys={[incidentForm.status]}
                  onSelectionChange={(keys) => setIncidentForm((prev) => ({ ...prev, status: [...keys][0] || "investigating" }))}
                >
                  {["open", "investigating", "resolved", "closed"].map((status) => (
                    <SelectItem key={status}>{status}</SelectItem>
                  ))}
                </Select>
              </label>
              <label>
                <span>Tài xế thay thế</span>
                <Select
                  selectedKeys={incidentForm.replacement_driver_id ? [incidentForm.replacement_driver_id] : []}
                  placeholder="Không đổi tài xế"
                  onSelectionChange={(keys) => setIncidentForm((prev) => ({ ...prev, replacement_driver_id: [...keys][0] || "" }))}
                >
                  {replacementOptions.map((driver) => (
                    <SelectItem key={String(driver.id)}>
                      {driver.full_name} - {driver.plate_number || "Chưa có xe"}
                    </SelectItem>
                  ))}
                </Select>
              </label>
              <label>
                <span>Đã thay thế</span>
                <Input value={incident.replacement_driver_name || "-"} isDisabled />
              </label>
            </div>

            <label className="full-width">
              <span>Phản hồi / ghi chú</span>
              <Textarea
                minRows={4}
                value={incidentForm.resolution}
                onValueChange={(value) => setIncidentForm((prev) => ({ ...prev, resolution: value }))}
                placeholder="Nhập cách xử lý hoặc lý do điều chuyển"
              />
            </label>

            <div className="form-actions">
              <Button variant="flat" className="coordinator-secondary-btn" onPress={onClose}>
                Đóng
              </Button>
              <Button color="primary" className="coordinator-primary-btn" isLoading={saving} onPress={onSubmit}>
                Lưu xử lý
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
