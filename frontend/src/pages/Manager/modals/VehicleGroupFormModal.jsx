import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea, NumberInput } from "@heroui/react";
import { RiTruckLine, RiFileTextLine, RiScales3Line, RiMoneyDollarCircleLine } from "react-icons/ri";
import { notify } from "../../../components/shared-ui/Toast";

const ic = (Icon) => <Icon size={16} className="text-gray-400 dark:text-gray-400 shrink-0" />;

const EMPTY_FORM = { name: "", description: "", max_load_weight_kg: null, price_per_km: null };

export default function VehicleGroupFormModal({ open, editingGroup, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (editingGroup) {
      setForm({
        name: editingGroup.name,
        description: editingGroup.description || "",
        max_load_weight_kg: editingGroup.max_load_weight_kg ? Number(editingGroup.max_load_weight_kg) : null,
        price_per_km: Number(editingGroup.price_per_km),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [editingGroup, open]);

  const handleOk = () => {
    if (!form.name.trim()) {
      const message = "Tên nhóm xe là bắt buộc.";
      setError(message);
      notify.error(message);
      return;
    }
    if (form.price_per_km == null) {
      const message = "Đơn giá/km là bắt buộc.";
      setError(message);
      notify.error(message);
      return;
    }
    setError(null);
    onSubmit(form);
  };

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="lg">
      <ModalContent>
        <ModalHeader>{editingGroup ? "Cập nhật nhóm xe" : "Thêm nhóm xe"}</ModalHeader>
        <ModalBody className="gap-4">
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <Input label="Tên nhóm xe *" placeholder="1T25" value={form.name} onValueChange={(v) => setForm((p) => ({ ...p, name: v }))} variant="bordered" startContent={ic(RiTruckLine)} />
          <Textarea label="Mô tả" value={form.description} onValueChange={(v) => setForm((p) => ({ ...p, description: v }))} minRows={3} variant="bordered" startContent={ic(RiFileTextLine)} />
          <NumberInput label="Tải trọng tối đa (kg)" minValue={0.01} value={form.max_load_weight_kg} onValueChange={(v) => setForm((p) => ({ ...p, max_load_weight_kg: v }))} variant="bordered" startContent={ic(RiScales3Line)} />
          <NumberInput label="Đơn giá/km *" minValue={0} value={form.price_per_km} onValueChange={(v) => setForm((p) => ({ ...p, price_per_km: v }))} variant="bordered" startContent={ic(RiMoneyDollarCircleLine)} />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Hủy</Button>
          <Button color="primary" onPress={handleOk}>Lưu</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
