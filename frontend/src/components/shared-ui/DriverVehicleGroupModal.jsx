import { useEffect, useState } from "react";
import { notify } from "./Toast";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Select, SelectItem, Input, Spinner,
} from "@heroui/react";
import { RiHistoryLine } from "react-icons/ri";

/**
 * Sửa nhóm xe KPI cố định của tài xế (BR: gắn chết 1 nhóm, không tự đổi theo xe hiện tại).
 * Dùng chung cho Manager/Coordinator (màn KPI, chi tiết xe) và Accountant (màn Bảng lương).
 */
export function DriverVehicleGroupModal({ open, driver, vehicleGroups, onSave, onClose, getHistory }) {
  const [vehicleGroupId, setVehicleGroupId] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open || !driver) return;
    setVehicleGroupId(driver.vehicle_group_id ? String(driver.vehicle_group_id) : null);
    setReason("");

    // Đổi nhóm ảnh hưởng ngưỡng thưởng và bảng tranh giải — cho người bấm xem ai đã
    // đổi trước đó, tránh hai người sửa qua sửa lại mà không biết.
    if (!getHistory) { setHistory([]); return; }
    setLoadingHistory(true);
    getHistory(driver.driver_id)
      .then((res) => setHistory(res?.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [open, driver, getHistory]);

  if (!driver) return null;

  const handleSave = async () => {
    if (!vehicleGroupId) return;
    setSaving(true);
    try {
      // Backend trả về thông điệp nói rõ doanh thu tháng này có chuyển nhóm hay không
      // (còn tuỳ bảng lương kỳ đó đã chốt chưa) — hiển thị đúng câu đó thay vì báo chung chung.
      const res = await onSave(driver.driver_id, Number(vehicleGroupId), reason.trim() || undefined);
      const message = res?.message ?? res?.driver?.message;
      if (res?.driver?.payroll_locked) notify.warning(message);
      else notify.success(message || "Đã cập nhật nhóm xe KPI.");
      onClose();
    } catch (e) {
      notify.error(e.message || "Lỗi cập nhật nhóm xe KPI");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="sm">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>Sửa nhóm xe KPI</span>
          <span className="text-xs font-normal text-gray-400 dark:text-gray-400">{driver.driver_name}</span>
        </ModalHeader>
        <ModalBody className="gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Nhóm xe này dùng để tính KPI/doanh thu/xếp hạng cố định cho tài xế — không tự đổi
            dù tài chạy tạm xe nhóm khác (điều chuyển sự cố...). Chỉ đổi khi gán nhầm, hoặc tài
            chuyển hẳn sang nhóm xe khác lâu dài.
          </p>
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 p-2.5">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Khi đổi: <b>toàn bộ doanh thu tháng này</b> chuyển sang nhóm mới (không tách được
              nửa tháng). <b>Các tháng trước giữ nguyên</b> nhóm cũ. Nếu lương tháng này đã duyệt
              hoặc đã chi thì KPI giữ nguyên, nhóm mới chỉ áp dụng từ kỳ sau.
            </p>
          </div>
          <Select
            label="Nhóm xe KPI"
            selectedKeys={vehicleGroupId ? [vehicleGroupId] : []}
            onSelectionChange={(keys) => setVehicleGroupId([...keys][0] ?? null)}
            variant="bordered"
          >
            {(vehicleGroups || []).map((g) => (
              <SelectItem key={String(g.id)}>{g.name}</SelectItem>
            ))}
          </Select>

          <Input
            label="Lý do đổi nhóm"
            placeholder="VD: gán nhầm lúc tạo tài khoản, điều chuyển biên chế..."
            value={reason}
            onValueChange={setReason}
            variant="bordered"
            maxLength={300}
            description="Được lưu vào lịch sử để đối chiếu về sau"
          />

          {/* Lịch sử đổi nhóm: thao tác này đụng tới ngưỡng thưởng và bảng tranh giải,
              cho người bấm thấy ai đã đổi trước đó thay vì sửa qua sửa lại. */}
          {getHistory && (
            <div className="rounded-lg border border-gray-200 dark:border-white/10 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <RiHistoryLine size={13} className="text-gray-400 dark:text-gray-400" />
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-400">
                  Lịch sử đổi nhóm
                </span>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-2"><Spinner size="sm" /></div>
              ) : history.length === 0 ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-400 italic">Chưa từng đổi nhóm.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                      <div>
                        <b>{h.from_group_name || "(chưa có)"}</b> → <b>{h.to_group_name}</b>
                        <span className="text-gray-400 dark:text-gray-500">
                          {" · "}{new Date(h.created_at).toLocaleString("vi-VN", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500">
                        bởi {h.changed_by_name}
                        {h.kpi_synced
                          ? ` · KPI kỳ ${h.applied_periods} đã chuyển theo`
                          : " · không kỳ nào chuyển (lương đã chốt)"}
                      </div>
                      {h.reason && (
                        <div className="italic text-gray-400 dark:text-gray-500">Lý do: {h.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving}>Hủy</Button>
          <Button color="primary" onPress={handleSave} isLoading={saving} isDisabled={!vehicleGroupId}>Lưu</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default DriverVehicleGroupModal;
