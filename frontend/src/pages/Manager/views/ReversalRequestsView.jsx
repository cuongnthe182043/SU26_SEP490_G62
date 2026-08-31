import { useEffect, useState } from "react";
import {
  Button, Chip, Textarea,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from "@heroui/react";
import { RiArrowGoBackLine, RiCheckLine, RiCloseLine, RiAlertLine } from "react-icons/ri";

import { notify } from "../../../components/shared-ui/Toast";
import LoadingState from "../../../components/LoadingState";
import { reversalRequestService } from "../../../services/reversalRequest.service";

const KIND_LABEL = {
  "expense.approve": "Gỡ duyệt chi phí",
  "repayment.confirm": "Huỷ xác nhận khoản nộp",
  "voucher.approve": "Huỷ phiếu chi",
  "payroll.review": "Trả phiếu lương về tính lại",
  "vehicle.retire": "Khôi phục xe đã ngừng dùng",
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} `
    + `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// Bao lâu rồi kể từ lúc gửi — người duyệt cần thấy cái nào đang để lâu, vì mỗi giờ trôi
// qua là một giờ số liệu sai còn nằm trong báo cáo.
const soLau = (iso) => {
  const phut = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (phut < 1) return "vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  const gio = Math.floor(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  return `${Math.floor(gio / 24)} ngày trước`;
};

function DecisionModal({ request, mode, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const laTuChoi = mode === "reject";

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = laTuChoi
        ? await reversalRequestService.reject(request.id, note.trim())
        : await reversalRequestService.approve(request.id, note.trim());

      // Duyệt xong mà không lùi được vẫn là kết quả hợp lệ (khoản đã chi mất rồi chẳng
      // hạn). Phải nói rõ, không được báo "thành công" rồi để người dùng tự phát hiện.
      if (res?.request?.execution_error) {
        notify.error(`Đã ghi nhận duyệt nhưng không lùi được: ${res.request.execution_error}`);
      } else {
        notify.success(laTuChoi ? "Đã từ chối yêu cầu." : "Đã duyệt và hoàn tác xong.");
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
      notify.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>{laTuChoi ? "Từ chối yêu cầu hoàn tác" : "Duyệt yêu cầu hoàn tác"}</span>
          <span className="text-sm font-normal text-gray-400">
            {KIND_LABEL[request.kind] ?? request.kind} — {request.entity_type} #{request.entity_id}
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="rounded-lg bg-gray-50 dark:bg-white/5 p-3 text-sm">
            <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">
              {request.requested_by_name} gửi {soLau(request.requested_at)}
            </div>
            <div className="text-gray-800 dark:text-gray-100">{request.reason}</div>
          </div>

          {!laTuChoi && (
            <div className="flex gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-lg">
              <RiAlertLine size={14} className="shrink-0 mt-0.5" />
              <span>
                Duyệt là hệ thống hoàn tác luôn. Thao tác này để lại vết trong nhật ký
                và không tự quay lại được.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">
              <RiAlertLine size={13} /> {error}
            </div>
          )}

          <Textarea
            isRequired={laTuChoi}
            label={laTuChoi ? "Vì sao từ chối" : "Ghi chú (tuỳ chọn)"}
            placeholder={laTuChoi
              ? "Người gửi cần biết để xử lý cách khác"
              : "Ví dụ: đã đối chiếu lại ảnh hoá đơn"}
            value={note}
            onValueChange={setNote}
            minRows={2}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>Đóng</Button>
          <Button
            color={laTuChoi ? "danger" : "primary"}
            onPress={submit}
            isLoading={saving}
            isDisabled={laTuChoi && !note.trim()}
          >
            {laTuChoi ? "Từ chối" : "Duyệt và hoàn tác"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default function ReversalRequestsView() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);   // { request, mode }

  const load = async () => {
    setLoading(true);
    try {
      const data = await reversalRequestService.listPending();
      setRequests(data.requests || []);
    } catch (err) {
      notify.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
        <RiArrowGoBackLine size={32} />
        <p className="text-sm">Không có yêu cầu hoàn tác nào đang chờ.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {requests.length} yêu cầu đang chờ. Cũ nhất xếp trước — mỗi giờ chờ là một giờ
        số liệu sai còn nằm trong báo cáo.
      </p>

      {requests.map((r) => (
        <div
          key={r.id}
          className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Chip size="sm" variant="flat" color="warning">
                  {KIND_LABEL[r.kind] ?? r.kind}
                </Chip>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {r.entity_type} #{r.entity_id}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{r.reason}</p>

              <p className="mt-1.5 text-xs text-gray-400">
                {r.requested_by_name} · {soLau(r.requested_at)} · {fmtTime(r.requested_at)}
              </p>
            </div>

            <div className="flex gap-2 shrink-0">
              <Button
                size="sm" color="danger" variant="flat"
                startContent={<RiCloseLine size={15} />}
                onPress={() => setTarget({ request: r, mode: "reject" })}
              >
                Từ chối
              </Button>
              <Button
                size="sm" color="primary"
                startContent={<RiCheckLine size={15} />}
                onPress={() => setTarget({ request: r, mode: "approve" })}
              >
                Duyệt
              </Button>
            </div>
          </div>
        </div>
      ))}

      {target && (
        <DecisionModal
          request={target.request}
          mode={target.mode}
          onClose={() => setTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
