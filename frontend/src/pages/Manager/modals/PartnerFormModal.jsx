import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea } from "@heroui/react";
import {
  RiBuilding2Line, RiBuildingLine, RiUserLine, RiPhoneLine, RiMailLine,
  RiCalendarLine, RiMapPinLine, RiPriceTag3Line, RiFileList3Line,
  RiBankLine, RiBankCardLine, RiUser3Line, RiStickyNoteLine,
} from "react-icons/ri";

const ic = (Icon) => <Icon size={16} className="text-gray-400 dark:text-gray-400 shrink-0" />;

export default function PartnerFormModal({ open, editing, form, setForm, saving, onClose, onSubmit }) {
  const update = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{editing ? "Cập nhật đối tác" : "Thêm đối tác"}</ModalHeader>
        <ModalBody className="gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Tên công ty *" value={form.company_name} onValueChange={update("company_name")} variant="bordered" startContent={ic(RiBuilding2Line)} />
            <Input label="Tên viết tắt" value={form.short_name} onValueChange={update("short_name")} variant="bordered" startContent={ic(RiBuildingLine)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Người liên hệ" value={form.contact_person} onValueChange={update("contact_person")} variant="bordered" startContent={ic(RiUserLine)} />
            <Input label="Số điện thoại" value={form.phone} onValueChange={update("phone")} variant="bordered" startContent={ic(RiPhoneLine)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" value={form.email} onValueChange={update("email")} variant="bordered" startContent={ic(RiMailLine)} />
            <Input label="Hạn thanh toán (ngày)" type="number" min="0" value={form.payment_term_days} onValueChange={update("payment_term_days")} variant="bordered" startContent={ic(RiCalendarLine)} />
          </div>
          <Textarea label="Địa chỉ" value={form.address} onValueChange={update("address")} minRows={2} variant="bordered" startContent={ic(RiMapPinLine)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mã số thuế" value={form.tax_code} onValueChange={update("tax_code")} variant="bordered" startContent={ic(RiPriceTag3Line)} />
            <Input label="Số đăng ký kinh doanh" value={form.business_registration_number} onValueChange={update("business_registration_number")} variant="bordered" startContent={ic(RiFileList3Line)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ngân hàng" value={form.bank_name} onValueChange={update("bank_name")} variant="bordered" startContent={ic(RiBankLine)} />
            <Input label="Số tài khoản" value={form.bank_account_number} onValueChange={update("bank_account_number")} variant="bordered" startContent={ic(RiBankCardLine)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Chủ tài khoản" value={form.bank_account_name} onValueChange={update("bank_account_name")} variant="bordered" startContent={ic(RiUser3Line)} />
            <Input label="Ghi chú" value={form.notes} onValueChange={update("notes")} variant="bordered" startContent={ic(RiStickyNoteLine)} />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Hủy</Button>
          <Button color="primary" isLoading={saving} onPress={onSubmit}>{editing ? "Lưu thay đổi" : "Tạo đối tác"}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
