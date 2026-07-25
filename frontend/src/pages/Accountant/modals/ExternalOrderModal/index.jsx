import { useState, useCallback, useEffect } from "react";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Input, Divider, Select, SelectItem,
} from "@heroui/react";
import { RiAddLine, RiFileAddLine } from "react-icons/ri";
import { CustomerSection } from "./CustomerSection";
import { ShipmentForm } from "./ShipmentForm";
import { accountantService } from "../../services/accountant.service";
import { notify } from "../../../../components/shared-ui/Toast";

const EMPTY_SHIPMENT = () => ({
  pickup_addresses: [""],
  delivery_address: "",
  cargo_name: "",
  cargo_weight: "",
  cargo_fee: "",
  payment_type: "cash",
  driver_payment_state: "company_received",
  driver_name: "",
  driver_id: null,
  vehicle_plate: "",
  expenses: [],
  notes: "",
});

const VN_PHONE_RE = /^0\d{8,10}$/;

const validate = (customer, shipments) => {
  const errors = {};

  if (!customer.name.trim()) {
    errors.customer_name = "Bắt buộc";
  }
  if (!customer.phone.trim()) {
    errors.customer_phone = "Bắt buộc";
  } else if (!VN_PHONE_RE.test(customer.phone.trim())) {
    errors.customer_phone = "Định dạng không hợp lệ (VD: 0901234567)";
  }

  shipments.forEach((s, i) => {
    const hasPickup = (s.pickup_addresses ?? []).some((a) => a.trim());
    if (!hasPickup) errors[`shipment_${i}_pickup`] = "Cần ít nhất 1 điểm lấy hàng";
    if (!s.delivery_address?.trim()) errors[`shipment_${i}_delivery`] = "Cần điểm giao hàng";

    const fee = Number(s.cargo_fee);
    if (isNaN(fee) || fee < 0) errors[`shipment_${i}_fee`] = "Cước xe không được âm";

    if (s.payment_type === "client_credit" && s.driver_payment_state === "driver_holding") {
      errors[`shipment_${i}_payment`] = "Ghi nợ khách không thể kết hợp với 'Tài xế đang giữ tiền'";
    }

    (s.expenses ?? []).forEach((e, j) => {
      const amt = Number(e.amount);
      if (e.amount !== "" && (isNaN(amt) || amt < 0)) {
        errors[`shipment_${i}_expense_${j}_amount`] = "Không được âm";
      }
    });
  });

  return errors;
};

export function ExternalOrderModal({ isOpen, onClose, onOrderCreated }) {
  const [customer, setCustomer] = useState({ name: "", phone: "", company: "" });
  const [orderDate, setOrderDate] = useState("");
  const [notes, setNotes] = useState("");
  const [shipments, setShipments] = useState([EMPTY_SHIPMENT()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [isPartner, setIsPartner] = useState(false);
  const [partnerId, setPartnerId] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    accountantService.getLookup()
      .then((data) => setDrivers(data.drivers || []))
      .catch(() => {});
    accountantService.getPartners()
      .then((data) => setPartners(data.partners || []))
      .catch(() => {});
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setCustomer({ name: "", phone: "", company: "" });
    setOrderDate("");
    setNotes("");
    setShipments([EMPTY_SHIPMENT()]);
    setErrors({});
    setApiError(null);
    setIsPartner(false);
    setPartnerId("");
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateShipment = (index, field, value) => {
    setShipments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addShipment = () => setShipments((prev) => [...prev, EMPTY_SHIPMENT()]);

  const removeShipment = (index) =>
    setShipments((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    const validationErrors = validate(customer, shipments);
    if (isPartner && !partnerId) validationErrors.partner = "Vui lòng chọn đối tác.";
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const selectedPartner = partners.find((p) => String(p.id) === String(partnerId));

    setSubmitting(true);
    setApiError(null);
    try {
      await accountantService.createOrder({
        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        customer_company: customer.company.trim() || undefined,
        partner_id: isPartner ? Number(partnerId) : undefined,
        partner_name: isPartner ? (selectedPartner?.company_name || undefined) : undefined,
        order_date: orderDate || undefined,
        notes: notes.trim() || undefined,
        shipments: shipments.map((s) => ({
          pickup_addresses: s.pickup_addresses.filter((a) => a.trim()),
          delivery_address: s.delivery_address.trim(),
          cargo_name: s.cargo_name.trim() || undefined,
          cargo_weight: Number(s.cargo_weight) || undefined,
          cargo_fee: Number(s.cargo_fee) || 0,
          payment_type: s.payment_type,
          driver_payment_state: s.driver_payment_state,
          driver_name: s.driver_name.trim() || undefined,
          driver_id: s.driver_id || undefined,
          vehicle_plate: s.vehicle_plate.trim() || undefined,
          expenses: (s.expenses ?? [])
            .filter((e) => Number(e.amount) > 0)
            .map((e) => ({
              expense_type: e.expense_type,
              amount: Number(e.amount),
              description: e.description?.trim() || undefined,
            })),
          notes: s.notes?.trim() || undefined,
        })),
      });
      onOrderCreated();
      notify.success("Đã tạo đơn hàng ngoài hệ thống.");
      handleClose();
    } catch (err) {
      setApiError(err.message ?? "Lỗi khi tạo đơn hàng.");
      notify.error(err.message ?? "Không thể tạo đơn hàng ngoài hệ thống.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <RiFileAddLine size={16} className="text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <p className="text-base font-bold">Nhập đơn ngoài hệ thống</p>
            <p className="text-xs font-normal text-gray-400 dark:text-gray-400">Tạo đơn và ghi nhận doanh thu thủ công</p>
          </div>
        </ModalHeader>

        <ModalBody>
          <CustomerSection
            name={customer.name}
            onNameChange={(v) => setCustomer((c) => ({ ...c, name: v }))}
            phone={customer.phone}
            onPhoneChange={(v) => setCustomer((c) => ({ ...c, phone: v }))}
            company={customer.company}
            onCompanyChange={(v) => setCustomer((c) => ({ ...c, company: v }))}
            errors={errors}
          />

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              className="w-fit"
              color={isPartner ? "primary" : "default"}
              variant={isPartner ? "solid" : "flat"}
              onPress={() => { setIsPartner((v) => !v); if (isPartner) setPartnerId(""); }}
            >
              Đơn từ đối tác liên kết
            </Button>
            <p className="text-xs text-gray-400 dark:text-gray-400">
              Đơn đối tác: đối tác thuê công ty chở, đối tác là bên trả cước / chịu công nợ (khách chỉ là điểm giao).
            </p>
            {isPartner && (
              <Select
                label="Đối tác"
                placeholder="Chọn đối tác"
                selectedKeys={partnerId ? [String(partnerId)] : []}
                onSelectionChange={(keys) => setPartnerId([...keys][0] ?? "")}
                isInvalid={!!errors.partner}
                errorMessage={errors.partner}
              >
                {partners.map((p) => (
                  <SelectItem key={String(p.id)} textValue={p.company_name}>
                    {p.contact_person ? `${p.company_name} - ${p.contact_person}` : p.company_name}
                  </SelectItem>
                ))}
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ngày đơn"
              type="date"
              value={orderDate}
              onValueChange={setOrderDate}
            />
            <Input
              label="Ghi chú đơn"
              placeholder="Tuỳ chọn"
              value={notes}
              onValueChange={setNotes}
            />
          </div>

          <Divider />

          {}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Danh sách chuyến ({shipments.length})
              </span>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<RiAddLine size={15} />}
                onPress={addShipment}
              >
                Thêm chuyến
              </Button>
            </div>

            {shipments.map((s, i) => (
              <ShipmentForm
                key={i}
                index={i}
                shipment={s}
                errors={errors}
                onChange={(field, value) => updateShipment(i, field, value)}
                onRemove={() => removeShipment(i)}
                canRemove={shipments.length > 1}
                drivers={drivers}
              />
            ))}
          </div>

          {apiError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{apiError}</p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={handleClose} disabled={submitting}>
            Huỷ
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={submitting}>
            Tạo đơn
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
