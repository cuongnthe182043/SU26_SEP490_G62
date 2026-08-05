import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Textarea } from "@heroui/react";
import { RiAlertLine, RiQuestionLine } from "react-icons/ri";

/**
 * Hộp thoại xác nhận dùng chung (giữa màn hình) — thay cho window.confirm().
 * Trả về Promise<boolean>:
 *   if (await confirmDialog({ title, description, danger })) { ... }
 *   if (await confirmDialog("Bạn có chắc?")) { ... }
 *
 * `description` giữ nguyên xuống dòng (`\n`), nên cảnh báo dài xuống dòng được.
 *
 * Truyền thêm `input: { label, placeholder, required }` khi cần lấy một dòng ghi chú
 * kèm theo xác nhận — khi đó Promise trả về `{ ok, value }` thay vì boolean. Không
 * truyền `input` thì vẫn là boolean như cũ, mọi chỗ gọi hiện tại không đổi.
 * Đặt <ConfirmRoot /> một lần ở App.
 */

let opener = null;

export function confirmDialog(options = {}) {
  const opts = typeof options === "string" ? { description: options } : options;
  return new Promise((resolve) => {
    if (!opener) {
      // Fallback nếu ConfirmRoot chưa mount (hiếm khi xảy ra)
      const ok = window.confirm(opts.description || opts.title || "Bạn có chắc chắn?");
      resolve(opts.input ? { ok, value: "" } : ok);
      return;
    }
    opener({ opts, resolve });
  });
}

export function ConfirmRoot() {
  const [state, setState] = useState(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    opener = setState;
    return () => { opener = null; };
  }, []);

  // Ô ghi chú phải sạch mỗi lần mở, nếu không lần xác nhận sau thừa hưởng chữ của lần trước.
  useEffect(() => { if (state) setValue(""); }, [state]);

  const o = state?.opts ?? {};
  const danger = Boolean(o.danger);
  const Icon = danger ? RiAlertLine : RiQuestionLine;
  const trimmed = value.trim();
  const blocked = Boolean(o.input?.required) && !trimmed;

  const finish = (ok) => {
    state?.resolve(o.input ? { ok, value: ok ? trimmed : "" } : ok);
    setState(null);
  };

  return (
    <Modal isOpen={!!state} onOpenChange={(open) => !open && finish(false)} placement="center" size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
          <Icon size={20} className={danger ? "text-rose-500" : "text-blue-500"} />
          {o.title ?? "Xác nhận"}
        </ModalHeader>
        <ModalBody>
          {o.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">
              {o.description}
            </p>
          )}
          {o.input && (
            <Textarea
              size="sm"
              minRows={2}
              label={o.input.label}
              placeholder={o.input.placeholder}
              value={value}
              onValueChange={setValue}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => finish(false)}>{o.cancelLabel ?? "Hủy"}</Button>
          <Button color={danger ? "danger" : "primary"} isDisabled={blocked} onPress={() => finish(true)}>
            {o.confirmLabel ?? "Xác nhận"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default ConfirmRoot;
