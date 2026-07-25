import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spinner, Chip, Input, Select, SelectItem } from "@heroui/react";
import { RiMoneyDollarCircleLine, RiBankCardLine } from "react-icons/ri";
import { notify } from "../../../components/shared-ui/Toast";

const ic = (Icon) => <Icon size={16} className="text-gray-400 dark:text-gray-400 shrink-0" />;
import { managerService } from "../services/manager.service";

const fmt = (v) => Number(v || 0).toLocaleString("vi-VN") + " đ";

const DEBT_STATUS_LABEL = { paid: "Đã thu đủ", partial: "Thu một phần", unpaid: "Chưa thu", overdue: "Quá hạn" };
const DEBT_STATUS_COLOR = { paid: "success", partial: "warning", unpaid: "danger", overdue: "danger" };

export default function PartnerDebtModal({ open, partner, debts, loading, onClose, onPaid }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!partner) return null;

  const totalAmount = debts.reduce((sum, d) => sum + Number(d.total_amount || 0), 0);
  const totalRemaining = debts.reduce((sum, d) => sum + Number(d.remaining || 0), 0);

  const handlePay = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Số tiền phải lớn hơn 0."); return; }
    if (amt > totalRemaining + 0.01) { setError("Số tiền vượt quá công nợ còn lại."); return; }
    setSaving(true);
    setError(null);
    try {
      await managerService.recordPartnerPayment(partner.id, { amount: amt, payment_method: method });
      setAmount("");
      notify.success("Đã ghi nhận thanh toán đối tác.");
      onPaid?.(partner.id);
    } catch (err) {
      setError(err.message ?? "Lỗi khi ghi nhận thanh toán.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()} size="4xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Công nợ đối tác: {partner.company_name}</ModalHeader>
        <ModalBody>
          {loading ? (
            <div className="flex justify-center py-10"><Spinner color="primary" /></div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-gray-400 dark:text-gray-400 block">Tên viết tắt</span><strong>{partner.short_name || "Chưa cập nhật"}</strong></div>
                <div><span className="text-xs text-gray-400 dark:text-gray-400 block">Người liên hệ</span><strong>{partner.contact_person || "Chưa cập nhật"}</strong></div>
                <div><span className="text-xs text-gray-400 dark:text-gray-400 block">Số điện thoại</span><strong>{partner.phone || "Chưa cập nhật"}</strong></div>
                <div><span className="text-xs text-gray-400 dark:text-gray-400 block">Email</span><strong>{partner.email || "Chưa cập nhật"}</strong></div>
                <div><span className="text-xs text-gray-400 dark:text-gray-400 block">Mã số thuế</span><strong>{partner.tax_code || "Chưa cập nhật"}</strong></div>
                <div><span className="text-xs text-gray-400 dark:text-gray-400 block">Hạn thanh toán</span><strong>{partner.payment_term_days ? `${partner.payment_term_days} ngày` : "Chưa cập nhật"}</strong></div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-100 dark:border-white/10 p-3 text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-400">Số khoản nợ</div>
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{debts.length}</div>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-white/10 p-3 text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-400">Tổng nợ</div>
                  <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{fmt(totalAmount)}</div>
                </div>
                <div className="rounded-xl border border-gray-100 dark:border-white/10 p-3 text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-400">Còn lại</div>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-300">{fmt(totalRemaining)}</div>
                </div>
              </div>

              {debts.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-400 text-center py-8">Đối tác này hiện không có công nợ.</p>
              ) : (
                <div className="flex flex-col divide-y divide-gray-50 dark:divide-white/10">
                  {debts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-3 gap-4">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Đơn #{d.order_id || "-"} · Chuyến #{d.shipment_id || "-"}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-400">{d.customer_company || d.customer_name || "Không có"} · {d.cargo_name || "Không có hàng hóa"}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div><div className="text-[10px] text-gray-400 dark:text-gray-400">Tổng nợ</div><div className="text-sm font-semibold">{fmt(d.total_amount)}</div></div>
                        <div><div className="text-[10px] text-gray-400 dark:text-gray-400">Đã thu</div><div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{fmt(d.paid_amount)}</div></div>
                        <div><div className="text-[10px] text-gray-400 dark:text-gray-400">Còn lại</div><div className="text-sm font-bold text-rose-600 dark:text-rose-300">{fmt(d.remaining)}</div></div>
                        <Chip size="sm" variant="flat" color={DEBT_STATUS_COLOR[d.status] || "default"}>{DEBT_STATUS_LABEL[d.status] || d.status}</Chip>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalRemaining > 0.01 && (
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    <RiMoneyDollarCircleLine size={16} /> Ghi nhận đối tác thanh toán
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Số tiền được phân bổ tự động vào các khoản nợ cũ nhất trước (FIFO). Tối đa {fmt(totalRemaining)}.
                  </p>
                  {error && <div className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-lg p-2">{error}</div>}
                  <div className="flex items-end gap-3 flex-wrap">
                    <Input
                      type="number" min={0} label="Số tiền" size="sm" className="w-48"
                      value={amount} onValueChange={setAmount}
                      startContent={ic(RiMoneyDollarCircleLine)}
                      endContent={<span className="text-xs text-gray-400 dark:text-gray-400">đ</span>}
                    />
                    <Select
                      label="Hình thức" size="sm" className="w-44"
                      selectedKeys={new Set([method])}
                      onChange={(e) => setMethod(e.target.value)}
                      startContent={ic(RiBankCardLine)}
                    >
                      <SelectItem key="bank_transfer" textValue="Chuyển khoản">Chuyển khoản</SelectItem>
                      <SelectItem key="cash" textValue="Tiền mặt">Tiền mặt</SelectItem>
                    </Select>
                    <Button color="success" size="sm" isLoading={saving} onPress={handlePay}>
                      Ghi nhận thanh toán
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Đóng</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
