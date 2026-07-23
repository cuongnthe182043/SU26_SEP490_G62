import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { RiAlertLine, RiQuestionLine } from "react-icons/ri";

/**
 * Hộp thoại xác nhận dùng chung (giữa màn hình) — thay cho window.confirm().
 * Trả về Promise<boolean>:
 *   if (await confirmDialog({ title, description, danger })) { ... }
 *   if (await confirmDialog("Bạn có chắc?")) { ... }
 * Đặt <ConfirmRoot /> một lần ở App.
 */

let opener = null;

export function confirmDialog(options = {}) {
  const opts = typeof options === "string" ? { description: options } : options;
  return new Promise((resolve) => {
    if (!opener) {
      // Fallback nếu ConfirmRoot chưa mount (hiếm khi xảy ra)
      resolve(window.confirm(opts.description || opts.title || "Bạn có chắc chắn?"));
      return;
    }
    opener({ opts, resolve });
  });
}

export function ConfirmRoot() {
  const [state, setState] = useState(null);

  useEffect(() => {
    opener = setState;
    return () => { opener = null; };
  }, []);

  const finish = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const o = state?.opts ?? {};
  const danger = Boolean(o.danger);
  const Icon = danger ? RiAlertLine : RiQuestionLine;

  return (
    <Modal isOpen={!!state} onOpenChange={(open) => !open && finish(false)} placement="center" size="sm">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
          <Icon size={20} className={danger ? "text-rose-500" : "text-blue-500"} />
          {o.title ?? "Xác nhận"}
        </ModalHeader>
        <ModalBody>
          {o.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{o.description}</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => finish(false)}>{o.cancelLabel ?? "Hủy"}</Button>
          <Button color={danger ? "danger" : "primary"} onPress={() => finish(true)}>
            {o.confirmLabel ?? "Xác nhận"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default ConfirmRoot;
