import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import {
  RiMailLine, RiShieldUserLine, RiUserLine, RiPhoneLine, RiUserSmileLine,
  RiMapPin2Line, RiFlag2Line, RiMapPinLine, RiIdCardLine,
  RiPriceTag3Line, RiContactsLine, RiStickyNoteLine,
} from "react-icons/ri";
import { notify } from "../../../components/shared-ui/Toast";

const ic = (Icon) => <Icon size={16} className="text-gray-400 dark:text-gray-400 shrink-0" />;

const EMPTY_FORM = {
  email: "", role: "driver", full_name: "", phone: "", gender: "", dob: "",
  city: "", country: "VN", address: "", national_id: "", tax_code: "",
  emergency_contact_name: "", emergency_contact_phone: "", notes: "",
};

export default function UserFormModal({ isOpen, onClose, onSave, editingUser }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingUser) {
      setForm({
        email: editingUser.email || "", role: editingUser.role || "driver",
        full_name: editingUser.full_name || "", phone: editingUser.phone || "",
        gender: editingUser.gender || "", dob: editingUser.dob ? String(editingUser.dob).slice(0, 10) : "",
        city: editingUser.city || "", country: editingUser.country || "VN",
        address: editingUser.address || "", national_id: editingUser.national_id || "",
        tax_code: editingUser.tax_code || "", emergency_contact_name: editingUser.emergency_contact_name || "",
        emergency_contact_phone: editingUser.emergency_contact_phone || "", notes: editingUser.notes || "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [editingUser, isOpen]);

  const update = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const showError = (message) => {
    setError(message);
    notify.error(message);
  };

  const handleOk = () => {
    if (!form.email.trim()) return showError("Vui lòng nhập email.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return showError("Email không hợp lệ.");
    if (!form.full_name.trim()) return showError("Vui lòng nhập họ và tên.");
    if (!/^0\d{9,10}$/.test(form.phone)) return showError("Số điện thoại không hợp lệ.");
    if (form.emergency_contact_phone && !/^0\d{9,10}$/.test(form.emergency_contact_phone)) {
      return showError("Số điện thoại khẩn cấp không hợp lệ.");
    }
    setError(null);
    onSave({ ...form, dob: form.dob || null });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{editingUser ? "Sửa thông tin người dùng" : "Thêm người dùng mới"}</ModalHeader>
        <ModalBody className="gap-4">
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email *" value={form.email} onValueChange={update("email")} variant="bordered" startContent={ic(RiMailLine)} />
            <Select label="Vai trò *" selectedKeys={[form.role]} onSelectionChange={(k) => update("role")([...k][0])} variant="bordered" startContent={ic(RiShieldUserLine)}>
              <SelectItem key="coordinator">Coordinator (Điều phối)</SelectItem>
              <SelectItem key="accountant">Accountant (Kế toán)</SelectItem>
              <SelectItem key="driver">Driver (Tài xế)</SelectItem>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Họ và tên *" value={form.full_name} onValueChange={update("full_name")} variant="bordered" startContent={ic(RiUserLine)} />
            <Input label="Số điện thoại *" value={form.phone} onValueChange={update("phone")} variant="bordered" startContent={ic(RiPhoneLine)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Giới tính" selectedKeys={form.gender ? [form.gender] : []} onSelectionChange={(k) => update("gender")([...k][0] ?? "")} variant="bordered" startContent={ic(RiUserSmileLine)}>
              <SelectItem key="male">Nam</SelectItem>
              <SelectItem key="female">Nữ</SelectItem>
              <SelectItem key="other">Khác</SelectItem>
            </Select>
            <Input type="date" label="Ngày sinh" value={form.dob} onValueChange={update("dob")} variant="bordered" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quê quán" value={form.city} onValueChange={update("city")} variant="bordered" startContent={ic(RiMapPin2Line)} />
            <Input label="Quốc gia" value={form.country} onValueChange={update("country")} variant="bordered" startContent={ic(RiFlag2Line)} />
          </div>
          <Textarea label="Địa chỉ" value={form.address} onValueChange={update("address")} minRows={2} variant="bordered" startContent={ic(RiMapPinLine)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Số giấy tờ (CCCD/Passport)" value={form.national_id} onValueChange={update("national_id")} variant="bordered" startContent={ic(RiIdCardLine)} />
            <Input label="Mã số thuế cá nhân" value={form.tax_code} onValueChange={update("tax_code")} variant="bordered" startContent={ic(RiPriceTag3Line)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Liên hệ khẩn cấp" value={form.emergency_contact_name} onValueChange={update("emergency_contact_name")} variant="bordered" startContent={ic(RiContactsLine)} />
            <Input label="SĐT khẩn cấp" value={form.emergency_contact_phone} onValueChange={update("emergency_contact_phone")} variant="bordered" startContent={ic(RiPhoneLine)} />
          </div>
          <Textarea label="Ghi chú" value={form.notes} onValueChange={update("notes")} minRows={2} variant="bordered" startContent={ic(RiStickyNoteLine)} />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Hủy</Button>
          <Button color="primary" onPress={handleOk}>Lưu lại</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
