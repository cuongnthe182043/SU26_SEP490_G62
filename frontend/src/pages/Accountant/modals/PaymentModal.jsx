import { useState, useEffect, useCallback } from "react";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Input, Select, SelectItem, Divider, Spinner, Chip,
} from "@heroui/react";
import {
  RiBankCard2Line, RiHistoryLine, RiCheckboxCircleLine,
  RiAlertLine, RiArrowRightLine, RiMoneyDollarCircleLine, RiStickyNoteLine,
} from "react-icons/ri";
import { accountantService } from "../services/accountant.service";
import { notify } from "../../../components/shared-ui/Toast";
import { confirmDialog } from "../../../components/shared-ui/confirm";

const ic = (Icon) => <Icon size={16} className="text-gray-400 dark:text-gray-400 shrink-0" />;
import { MoneyText } from "../components/shared/MoneyText";

const PAYMENT_METHODS = [
  { key: "cash",          label: "Tiá»n máº·t" },
  { key: "bank_transfer", label: "Chuyá»ƒn khoáº£n" },
];

const METHOD_LABEL = {
  cash:          "Tiá»n máº·t",
  bank_transfer: "Chuyá»ƒn khoáº£n",
  offset:        "Cáº¥n trá»«",
};

const PAYMENT_STATUS_CHIP = {
  confirmed: { label: "ÄÃ£ xÃ¡c nháº­n",  color: "success" },
  pending:   { label: "Chá» xÃ¡c nháº­n", color: "warning" },
  rejected:  { label: "Tá»« chá»‘i",      color: "danger"  },
  voided:    { label: "ÄÃ£ há»§y",       color: "default" },
};

function HistoryItem({ payment, onVoid }) {
  const rawDate = payment.paid_at ?? payment.confirmed_at ?? payment.created_at;
  const date = rawDate
    ? new Date(rawDate).toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "â€”";
  const statusChip = PAYMENT_STATUS_CHIP[payment.payment_status] ?? PAYMENT_STATUS_CHIP.confirmed;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-white/10 last:border-0">
      <div className="flex flex-col gap-0.5">
        <MoneyText amount={payment.amount} className="text-xs font-bold text-emerald-600 dark:text-emerald-300" />
        <span className="text-[11px] text-gray-400 dark:text-gray-400">
          {METHOD_LABEL[payment.payment_method] ?? payment.payment_method ?? "â€”"} Â· {date}
          {payment.creator_name ? ` Â· ghi bá»Ÿi ${payment.creator_name}` : ""}
        </span>
        {payment.notes && (
          <span className="text-[11px] text-gray-400 dark:text-gray-400 italic">{payment.notes}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Chip size="sm" color={statusChip.color} variant="flat" className="text-[10px] h-5">
          <RiCheckboxCircleLine size={10} className="inline mr-0.5" />
          {statusChip.label}
        </Chip>
        {payment.payment_status === "confirmed" && onVoid && (
          <Button size="sm" variant="light" color="danger" className="h-5 min-w-0 px-2 text-[10px]"
            onPress={() => onVoid(payment)}>
            Há»§y
          </Button>
        )}
      </div>
    </div>
  );
}

function AllocationRow({ alloc, isCurrentOrder }) {
  const statusColor = {
    paid:    "success",
    partial: "warning",
    unpaid:  "danger",
  }[alloc.newStatus] ?? "default";

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <RiArrowRightLine size={11} className="text-gray-400 dark:text-gray-400 shrink-0" />
        <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
          ÄÆ¡n #{alloc.orderId}
          {isCurrentOrder && (
            <span className="ml-1 text-[10px] text-blue-500 font-medium">(Ä‘Æ¡n nÃ y)</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <MoneyText amount={alloc.allocated} className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300" />
        <Chip size="sm" color={statusColor} variant="flat" className="text-[10px] h-4 px-1">
          {alloc.newStatus === "paid" ? "Xong" : alloc.newStatus === "partial" ? "Má»™t pháº§n" : "CÃ²n ná»£"}
        </Chip>
      </div>
    </div>
  );
}

export function PaymentModal({ isOpen, onClose, order, onPaymentRecorded }) {
  const [amount, setAmount]        = useState("");
  const [method, setMethod]        = useState(new Set(["cash"]));
  const [notes, setNotes]          = useState("");
  const [submitting, setSubmit]    = useState(false);
  const [error, setError]          = useState(null);
  const [history, setHistory]      = useState([]);
  const [histLoading, setHistL]    = useState(false);
  const [customerDebt, setCustDebt] = useState(null);
  const [debtLoading, setDebtL]    = useState(false);
  const [result, setResult]        = useState(null);

  // Há»§y xÃ¡c nháº­n khoáº£n Ä‘Ã£ confirmed â€” ná»£ há»“i phá»¥c + há»‡ thá»‘ng tá»± ghi bÃºt toÃ¡n Ä‘áº£o
  const handleVoidPayment = async (payment) => {
    const confirmed = await confirmDialog({
      title: "Hủy khoản thanh toán",
      description: `Hủy xác nhận khoản ${Number(payment.amount).toLocaleString("vi-VN")}đ? Công nợ sẽ được khôi phục.`,
      confirmLabel: "Hủy khoản",
      danger: true,
    });
    if (!confirmed) return;
    const reason = "Kế toán hủy xác nhận từ giao diện web";
    try {
      await accountantService.voidRepayment(payment.id, reason.trim());
      await loadData();
      onPaymentRecorded?.();
      notify.success("ÄÃ£ há»§y khoáº£n thanh toÃ¡n.");
    } catch (err) {
      setError(err.message ?? "Há»§y xÃ¡c nháº­n tháº¥t báº¡i");
      notify.error(err.message ?? "Há»§y xÃ¡c nháº­n tháº¥t báº¡i");
    }
  };

  const loadData = useCallback(async () => {
    if (!order?.id) return;

    setHistL(true);
    setDebtL(true);

    const [histData, debtData] = await Promise.allSettled([
      accountantService.getPayments(order.id),
      accountantService.getCustomerDebt(order.id),
    ]);

    setHistory(histData.status === "fulfilled" && Array.isArray(histData.value)
      ? histData.value : []);
    setCustDebt(debtData.status === "fulfilled" ? debtData.value : null);
    setHistL(false);
    setDebtL(false);
  }, [order?.id]);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setMethod(new Set(["cash"]));
      setNotes("");
      setError(null);
      setResult(null);
      loadData();
    }
  }, [isOpen, loadData]);

  const totalOutstanding = customerDebt?.totalOutstanding ?? 0;

  const handleSubmit = async () => {
    const num = Number(String(amount).replace(/[^0-9.]/g, ""));
    if (!num || num <= 0) {
      setError("Sá»‘ tiá»n pháº£i lá»›n hÆ¡n 0.");
      return;
    }
    if (totalOutstanding > 0 && num > totalOutstanding + 0.01) {
      setError(
        `Sá»‘ tiá»n vÆ°á»£t quÃ¡ tá»•ng cÃ´ng ná»£ khÃ¡ch hÃ ng (${Math.round(totalOutstanding).toLocaleString("vi-VN")}Ä‘).`
      );
      return;
    }

    setSubmit(true);
    setError(null);
    try {
      const data = await accountantService.createPayment(order.id, {
        amount:        num,
        paymentMethod: [...method][0],
        notes:         notes.trim() || undefined,
      });
      setResult(data);
      onPaymentRecorded();
      notify.success("ÄÃ£ ghi nháº­n thanh toÃ¡n.");
      // Reload history vá»›i debt má»›i
      loadData();
      setAmount("");
      setNotes("");
    } catch (err) {
      setError(err.message ?? "Lá»—i khi ghi nháº­n thanh toÃ¡n.");
      notify.error(err.message ?? "Lá»—i khi ghi nháº­n thanh toÃ¡n.");
    } finally {
      setSubmit(false);
    }
  };

  const orderDebtRemaining = Number(order?.debt_remaining ?? 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <RiBankCard2Line size={16} className="text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">Ghi nháº­n thanh toÃ¡n</p>
              {order && (
                <p className="text-xs font-normal text-gray-400 dark:text-gray-400">
                  ÄÆ¡n #{order.id} Â· {order.customer_name}
                </p>
              )}
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="gap-4">
          {/* TÃ³m táº¯t cÃ´ng ná»£ */}
          {order && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                <span className="text-[10px] text-gray-400 dark:text-gray-400 font-semibold uppercase tracking-wide">
                  CÃ²n láº¡i Ä‘Æ¡n nÃ y
                </span>
                <MoneyText
                  amount={orderDebtRemaining}
                  className="text-sm font-bold text-red-600 dark:text-red-300"
                />
              </div>
              <div className="flex flex-col gap-0.5 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
                <span className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold uppercase tracking-wide">
                  Tá»•ng cÃ´ng ná»£ khÃ¡ch
                </span>
                {debtLoading ? (
                  <Spinner size="sm" className="mt-1" />
                ) : (
                  <MoneyText
                    amount={totalOutstanding}
                    className="text-sm font-bold text-amber-700 dark:text-amber-300"
                  />
                )}
              </div>
            </div>
          )}

          {/* Náº¿u vá»«a ghi nháº­n thÃ nh cÃ´ng â€” hiá»ƒn thá»‹ breakdown */}
          {result && (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{result.message}</p>
              {result.spreadAcrossOrders && (
                <div className="flex flex-col gap-0.5 mt-1">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-300 font-medium uppercase tracking-wide mb-0.5">
                    PhÃ¢n bá»• vÃ o cÃ¡c Ä‘Æ¡n
                  </span>
                  {result.allocations.map((alloc) => (
                    <AllocationRow
                      key={alloc.debtId}
                      alloc={alloc}
                      isCurrentOrder={alloc.orderId === order?.id}
                    />
                  ))}
                </div>
              )}
              {result.totalRemainingAfter > 0.01 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-1">
                  CÃ²n tá»•ng ná»£:{" "}
                  <MoneyText
                    amount={result.totalRemainingAfter}
                    className="font-bold inline"
                  />
                </p>
              )}
            </div>
          )}

          <Divider />

          {/* Form nháº­p */}
          <div className="flex flex-col gap-3">
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 p-3 rounded-lg">
                <RiAlertLine size={13} />
                {error}
              </div>
            )}
            <Input
              label="Sá»‘ tiá»n thu (VND)"
              placeholder="0"
              value={amount}
              onValueChange={(v) => { setAmount(v); setError(null); setResult(null); }}
              type="number"
              min={0}
              startContent={ic(RiMoneyDollarCircleLine)}
              description={
                totalOutstanding > 0
                  ? `Tá»•ng ná»£ khÃ¡ch: ${Math.round(totalOutstanding).toLocaleString("vi-VN")}Ä‘${
                      orderDebtRemaining > 0 && orderDebtRemaining < totalOutstanding
                        ? ` â€” ÄÆ¡n nÃ y: ${Math.round(orderDebtRemaining).toLocaleString("vi-VN")}Ä‘ (sá»‘ thá»«a tá»± Ä‘á»™ng trá»« Ä‘Æ¡n cÅ© hÆ¡n)`
                        : ""
                    }`
                  : undefined
              }
              isInvalid={!!error}
              classNames={{ inputWrapper: "bg-white dark:bg-[#161922]" }}
            />
            <Select
              label="HÃ¬nh thá»©c thanh toÃ¡n"
              selectedKeys={method}
              onSelectionChange={setMethod}
              startContent={ic(RiBankCard2Line)}
            >
              {PAYMENT_METHODS.map(({ key, label }) => (
                <SelectItem key={key}>{label}</SelectItem>
              ))}
            </Select>
            <Input
              label="Ghi chÃº"
              placeholder="MÃ£ GD, tÃªn ngÆ°á»i ná»™p... (tuá»³ chá»n)"
              value={notes}
              onValueChange={setNotes}
              maxLength={500}
              classNames={{ inputWrapper: "bg-white dark:bg-[#161922]" }}
              startContent={ic(RiStickyNoteLine)}
            />
          </div>

          {/* Lá»‹ch sá»­ */}
          <Divider />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              <RiHistoryLine size={13} className="text-gray-400 dark:text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-400 uppercase tracking-wide">
                Lá»‹ch sá»­ thanh toÃ¡n Ä‘Æ¡n nÃ y
              </span>
            </div>
            {histLoading ? (
              <div className="flex justify-center py-4"><Spinner size="sm" /></div>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-400 py-2 italic">ChÆ°a cÃ³ thanh toÃ¡n nÃ o.</p>
            ) : (
              history.map((p, i) => <HistoryItem key={i} payment={p} onVoid={handleVoidPayment} />)
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={submitting}>ÄÃ³ng</Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={submitting}
            isDisabled={!amount || Number(amount) <= 0}
            startContent={!submitting && <RiBankCard2Line size={15} />}
          >
            Ghi nháº­n
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
