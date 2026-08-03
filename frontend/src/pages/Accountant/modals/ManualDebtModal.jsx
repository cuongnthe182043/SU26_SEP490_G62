import { useEffect, useMemo, useState } from "react";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Input, Select, SelectItem, Autocomplete, AutocompleteItem, Textarea,
} from "@heroui/react";
import { RiAlertLine, RiInformationLine } from "react-icons/ri";

import { accountantService } from "../services/accountant.service";
import { notify } from "../../../components/shared-ui/Toast";

/**
 * Khai một khoản công nợ có từ TRƯỚC khi dùng phần mềm.
 *
 * Vì sao cần: công nợ hiện chỉ sinh ra từ chuyến. Nợ cũ không có chuyến nào trong hệ
 * thống nên không khai được, làm màn Công nợ chỉ phản ánh phần phát sinh sau khi dùng
 * phần mềm — đối chiếu với sổ tay của doanh nghiệp là lệch.
 */

const DEBT_TYPES = [
  { key: "customer", label: "Khách hàng nợ công ty" },
  { key: "driver",   label: "Tài xế giữ tiền của công ty" },
  { key: "partner",  label: "Đối tác nợ công ty" },
];

const OWNER_LABEL = {
  customer: "Khách hàng",
  driver:   "Tài xế",
  partner:  "Đối tác",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const parseAmount = (v) => {
  const digits = String(v ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
};

export function ManualDebtModal({ open, debt, onClose, onSaved }) {
  const isEdit = Boolean(debt?.id);

  const [debtType, setDebtType] = useState("customer");
  const [ownerId, setOwnerId]   = useState(null);
  const [owners, setOwners]     = useState([]);
  const [loadingOwners, setLoadingOwners] = useState(false);

  const [amount, setAmount]         = useState("");
  const [incurredOn, setIncurredOn] = useState(todayISO());
  const [dueDate, setDueDate]       = useState("");
  const [notes, setNotes]           = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  // Nạp lại khi mở: sửa thì đổ dữ liệu cũ vào, tạo mới thì về mặc định
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (isEdit) {
      setDebtType(debt.debt_type);
      setAmount(String(Number(debt.total_amount || 0)));
      setIncurredOn(debt.incurred_on ? String(debt.incurred_on).slice(0, 10) : todayISO());
      setDueDate(debt.due_date ? String(debt.due_date).slice(0, 10) : "");
      setNotes(debt.notes ?? "");
    } else {
      setDebtType("customer");
      setOwnerId(null);
      setAmount("");
      setIncurredOn(todayISO());
      setDueDate("");
      setNotes("");
    }
  }, [open, isEdit, debt]);

  // Đổi loại nợ thì danh sách đối tượng phải nạp lại — và bỏ chọn cũ đi, nếu không
  // sẽ giữ nguyên id của loại trước và gán nợ nhầm đối tượng.
  useEffect(() => {
    if (!open || isEdit) return;
    let huy = false;
    setLoadingOwners(true);
    setOwnerId(null);
    accountantService.searchDebtOwners(debtType)
      .then((res) => { if (!huy) setOwners(res.owners || []); })
      .catch(() => { if (!huy) setOwners([]); })
      .finally(() => { if (!huy) setLoadingOwners(false); });
    return () => { huy = true; };
  }, [open, isEdit, debtType]);

  const amountNumber = parseAmount(amount);

  const canSave = useMemo(() => (
    amountNumber > 0
    && incurredOn
    && notes.trim().length > 0
    && (isEdit || ownerId)
    && !saving
  ), [amountNumber, incurredOn, notes, isEdit, ownerId, saving]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        total_amount: amountNumber,
        incurred_on: incurredOn,
        due_date: dueDate || null,
        notes: notes.trim(),
      };
      if (isEdit) {
        await accountantService.updateManualDebt(debt.id, body);
        notify.success("Đã cập nhật công nợ.");
      } else {
        await accountantService.createManualDebt({ ...body, debt_type: debtType, owner_id: Number(ownerId) });
        notify.success("Đã ghi nhận công nợ.");
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const message = err.message ?? "Không lưu được công nợ.";
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>{isEdit ? "Sửa công nợ" : "Khai công nợ có sẵn"}</span>
          <span className="text-sm font-normal text-gray-400 dark:text-gray-400">
            {isEdit
              ? "Chỉ sửa được khi khoản này chưa phát sinh thanh toán nào"
              : "Dùng cho công nợ phát sinh trước khi dùng phần mềm"}
          </span>
        </ModalHeader>

        <ModalBody className="gap-3">
          <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-lg p-3">
            <RiInformationLine size={15} className="shrink-0 mt-0.5" />
            <span>
              Khoản này sẽ được ghi vào sổ tài chính dưới dạng <b>số dư đầu kỳ</b> theo đúng
              ngày phát sinh, để lúc thu tiền sổ vẫn cân.
            </span>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">
              <RiAlertLine size={14} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {!isEdit && (
            <>
              <Select
                label="Loại công nợ"
                selectedKeys={new Set([debtType])}
                onChange={(e) => setDebtType(e.target.value)}
                isRequired
              >
                {DEBT_TYPES.map(({ key, label }) => (
                  <SelectItem key={key} textValue={label}>{label}</SelectItem>
                ))}
              </Select>

              <Autocomplete
                label={OWNER_LABEL[debtType]}
                placeholder={loadingOwners ? "Đang tải..." : `Chọn ${OWNER_LABEL[debtType].toLowerCase()}`}
                selectedKey={ownerId ? String(ownerId) : null}
                onSelectionChange={(k) => setOwnerId(k)}
                isDisabled={loadingOwners}
                isRequired
              >
                {owners.map((o) => (
                  <AutocompleteItem key={String(o.id)} textValue={`${o.name}${o.phone ? ` · ${o.phone}` : ""}`}>
                    {o.name}{o.phone ? <span className="text-gray-400"> · {o.phone}</span> : null}
                  </AutocompleteItem>
                ))}
              </Autocomplete>
            </>
          )}

          <Input
            label="Số tiền"
            value={amount ? Number(parseAmount(amount)).toLocaleString("vi-VN") : ""}
            onValueChange={(v) => setAmount(String(parseAmount(v)))}
            endContent={<span className="text-xs text-gray-400">đ</span>}
            isRequired
          />

          <div className="flex gap-3">
            <Input
              type="date" label="Ngày phát sinh" value={incurredOn}
              onValueChange={setIncurredOn} max={todayISO()} isRequired
              description="Ngày khoản nợ thật sự phát sinh, không phải hôm nay"
            />
            <Input
              type="date" label="Hạn thanh toán" value={dueDate}
              onValueChange={setDueDate} min={incurredOn || undefined}
              description="Bỏ trống nếu chưa hẹn"
            />
          </div>

          <Textarea
            label="Diễn giải"
            placeholder="Ví dụ: Nợ tồn từ sổ tay tháng 3/2026, đã đối chiếu với khách"
            value={notes}
            onValueChange={setNotes}
            maxRows={3}
            isRequired
          />

          {debtType === "driver" && !isEdit && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg p-3">
              <RiAlertLine size={14} className="shrink-0 mt-0.5" />
              <span>
                Nợ tài xế sẽ được <b>khấu trừ dần vào lương</b> các kỳ tới, mỗi kỳ tối đa
                theo trần công ty đặt (mặc định 30% số thực nhận) để tài xế vẫn có lương.
              </span>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>Huỷ</Button>
          <Button color="primary" onPress={handleSave} isDisabled={!canSave} isLoading={saving}>
            {isEdit ? "Lưu thay đổi" : "Ghi nhận công nợ"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
