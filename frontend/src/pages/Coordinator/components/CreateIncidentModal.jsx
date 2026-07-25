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

const INCIDENT_TYPES = [
  { value: "vehicle_breakdown", label: "Sự cố xe" },
  { value: "cargo_damage", label: "Hàng hóa bị hỏng" },
  { value: "road_incident", label: "Đường sá / giao thông" },
  { value: "customer_refusal", label: "Khách từ chối nhận" },
  { value: "traffic_jam", label: "Tắc đường" },
];

const SEVERITY_LEVELS = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "critical", label: "Khẩn cấp" },
];

export default function CreateIncidentModal({ open, form, setForm, saving, onClose, onSubmit }) {
  return (
    <Modal isOpen={open} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Tạo sự cố thủ công</ModalHeader>
        <ModalBody className="pb-6">
          <p style={{ marginTop: -8, color: "#6b7280" }}>
            Dùng khi khách gọi điện báo sự cố, hoặc điều phối/quản lý phát hiện sự cố mà tài xế chưa kịp báo cáo.
          </p>

          <div className="create-form" style={{ paddingTop: 12 }}>
            <div className="form-row form-row-3">
              <label>
                <span>Loại sự cố</span>
                <Select
                  selectedKeys={form.incidentType ? [form.incidentType] : []}
                  placeholder="Chọn loại sự cố"
                  onSelectionChange={(keys) => setForm((prev) => ({ ...prev, incidentType: [...keys][0] || "" }))}
                >
                  {INCIDENT_TYPES.map((option) => (
                    <SelectItem key={option.value}>{option.label}</SelectItem>
                  ))}
                </Select>
              </label>
              <label>
                <span>Mức độ</span>
                <Select
                  selectedKeys={[form.severityLevel || "medium"]}
                  onSelectionChange={(keys) => setForm((prev) => ({ ...prev, severityLevel: [...keys][0] || "medium" }))}
                >
                  {SEVERITY_LEVELS.map((option) => (
                    <SelectItem key={option.value}>{option.label}</SelectItem>
                  ))}
                </Select>
              </label>
              <label>
                <span>Mã chuyến nếu có</span>
                <Input
                  value={form.shipmentId || ""}
                  placeholder="VD: 100023"
                  onValueChange={(value) => setForm((prev) => ({ ...prev, shipmentId: value }))}
                />
              </label>
            </div>

            <label className="full-width">
              <span>Mô tả tối thiểu 10 ký tự</span>
              <Textarea
                minRows={4}
                value={form.description || ""}
                onValueChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
                placeholder="Mô tả chi tiết sự cố"
              />
            </label>

            <label className="full-width">
              <span>Vị trí không bắt buộc</span>
              <Input
                value={form.location || ""}
                onValueChange={(value) => setForm((prev) => ({ ...prev, location: value }))}
                placeholder="VD: Quốc lộ 13, Thủ Đức"
              />
            </label>

            <div className="form-actions">
              <Button variant="flat" className="coordinator-secondary-btn" onPress={onClose}>
                Đóng
              </Button>
              <Button color="primary" className="coordinator-primary-btn" isLoading={saving} onPress={onSubmit}>
                Tạo sự cố
              </Button>
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
