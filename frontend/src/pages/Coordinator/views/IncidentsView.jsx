import { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useState } from "react";
import { notify } from "../../../components/shared-ui/Toast";
import { Button, Spinner, Select, SelectItem, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react";
import { RiEyeLine, RiFlag2Line, RiAlertLine, RiSortDesc, RiToolsLine } from "react-icons/ri";

const ic = (Icon) => <Icon size={16} className="text-gray-400 dark:text-gray-400 shrink-0" />;
import { StatusBadge } from "../../../components/shared-ui/StatusBadge";
import IncidentDetailModal from "../modals/IncidentDetailModal";
import CreateIncidentModal from "../modals/CreateIncidentModal";
import { coordinatorService } from "../services/coordinator.service";
import { incidentTypeLabel } from "../utils";

const EMPTY_CREATE_FORM = { incidentType: "", severityLevel: "medium", shipmentId: "", description: "", location: "" };
const EMPTY_COMPENSATION = { enabled: false, amount: "", payee: "", reason: "", payment_method: "cash" };

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "open", label: "Mới tiếp nhận" },
  { value: "investigating", label: "Đang xử lý" },
  { value: "resolved", label: "Đã giải quyết" },
  { value: "closed", label: "Đã đóng" },
];

const SEVERITY_FILTER_OPTIONS = [
  { value: "", label: "Tất cả mức độ" },
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "critical", label: "Khẩn cấp" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "severity", label: "Mức độ nghiêm trọng" },
];

const IncidentsView = forwardRef(function IncidentsView({ search, refreshKey, onIncidentResolved, basePath }, ref) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [drivers, setDrivers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolvingFailed, setResolvingFailed] = useState(false);
  const [cancellingDamaged, setCancellingDamaged] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [detailIncident, setDetailIncident] = useState(null);
  const [form, setForm] = useState({ status: "investigating", resolution: "", replacement_driver_id: "" });
  const [compensation, setCompensation] = useState(EMPTY_COMPENSATION);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const deferredSearch = useDeferredValue(search);

  const loadIncidents = async (page = pagination.page) => {
    setLoading(true);
    try {
      const params = { page: String(page), limit: String(pagination.limit), sort: sortBy };
      if (deferredSearch?.trim()) params.search = deferredSearch.trim();
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity_level = severityFilter;
      const data = await coordinatorService.getIncidents(params);
      setIncidents(data.incidents || []);
      setPagination(data.pagination || { page, limit: pagination.limit, total: data.incidents?.length || 0, totalPages: 1 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, refreshKey, statusFilter, severityFilter, sortBy]);

  useEffect(() => {
    coordinatorService.getDrivers().then((data) => setDrivers(data.drivers || [])).catch(() => {});
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setSelectedIncident(null);
    setForm({ status: "investigating", resolution: "", replacement_driver_id: "" });
    setCompensation(EMPTY_COMPENSATION);
  };

  const buildIncidentForm = (incident) => ({
    status: incident.status === "open" ? "investigating" : incident.status || "investigating",
    resolution: incident.resolution || incident.resolution_note || "",
    replacement_driver_id: incident.replacement_driver_id ? String(incident.replacement_driver_id) : "",
  });

  const openModal = (incident) => {
    setSelectedIncident(incident);
    setForm(buildIncidentForm(incident));
    setCompensation(EMPTY_COMPENSATION);
    setModalOpen(true);
  };

  const openDetailModal = (incident) => {
    setDetailIncident(incident);
    setForm(buildIncidentForm(incident));
    setCompensation(EMPTY_COMPENSATION);
  };

  const handleSubmit = async () => {
    if (!selectedIncident) return;

    let compensationPayload = null;
    if (compensation.enabled) {
      if (!compensation.amount || Number(compensation.amount) <= 0) {
        notify.error("Nhập số tiền đền bù hợp lệ.");
        return;
      }
      if (!compensation.payee.trim()) {
        notify.error("Nhập người/đơn vị nhận đền bù.");
        return;
      }
      compensationPayload = {
        amount: Number(compensation.amount),
        payee: compensation.payee.trim(),
        reason: compensation.reason.trim() || null,
        payment_method: compensation.payment_method,
      };
    }

    setSaving(true);
    try {
      await coordinatorService.updateIncidentStatus(selectedIncident.id, {
        // Sự cố có đền bù bị khóa ở "đang xử lý" tới khi Manager duyệt khoản chi.
        // Backend cũng ép giá trị này, gửi đúng ngay từ đây để tránh lệch với thứ đang hiện trên form.
        status: compensationPayload ? "investigating" : form.status,
        resolution: form.resolution || null,
        replacementDriverId: form.replacement_driver_id ? Number(form.replacement_driver_id) : null,
        compensation: compensationPayload,
      });
      closeModal();
      loadIncidents();
      onIncidentResolved?.();
      notify.success("Đã cập nhật sự cố.");
    } catch (error) {
      notify.error(error.message || "Không thể cập nhật sự cố.");
    } finally {
      setSaving(false);
    }
  };

  // Giao thất bại: quyết định giao lại / hoàn hàng nằm ngay trong sự cố. Backend tự
  // đóng sự cố và (nếu hoàn hàng) chuyển chuyến sang 'returning' để tài chở hàng về.
  const handleResolveFailed = async (action) => {
    if (!selectedIncident?.shipment_id) return;
    setResolvingFailed(true);
    try {
      const res = await coordinatorService.resolveFailedShipment(selectedIncident.shipment_id, { action });
      closeModal();
      loadIncidents();
      onIncidentResolved?.();
      notify.success(res?.message || "Đã xử lý chuyến giao thất bại.");
    } catch (error) {
      notify.error(error.message || "Không thể xử lý chuyến giao thất bại.");
    } finally {
      setResolvingFailed(false);
    }
  };

  // Hàng hóa hư hại: outcome duy nhất là hủy dứt điểm chuyến — cho phép hủy dù đã lấy
  // hàng. Backend tự đóng sự cố và tính lại trạng thái đơn (completed/partial/cancelled)
  // trong cùng transaction, nên đơn không còn bị "treo" sau khi xử lý sự cố xong.
  const handleCancelDamagedShipment = async (reason) => {
    if (!selectedIncident?.id) return;
    if (!reason?.trim()) {
      notify.error("Nhập lý do hủy chuyến vào ô Phản hồi / ghi chú.");
      return;
    }
    setCancellingDamaged(true);
    try {
      const res = await coordinatorService.cancelDamagedShipment(selectedIncident.id, reason.trim());
      closeModal();
      loadIncidents();
      onIncidentResolved?.();
      notify.success(res?.message || "Đã hủy chuyến do hàng hóa hư hại.");
    } catch (error) {
      notify.error(error.message || "Không thể hủy chuyến.");
    } finally {
      setCancellingDamaged(false);
    }
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  };

  const openCreateModal = () => setCreateOpen(true);
  useImperativeHandle(ref, () => ({ openCreateModal }));

  const handleCreateIncident = async () => {
    if (!createForm.incidentType) {
      notify.error("Vui lòng chọn loại sự cố.");
      return;
    }
    if (!createForm.description?.trim() || createForm.description.trim().length < 10) {
      notify.error("Mô tả phải có ít nhất 10 ký tự.");
      return;
    }
    setCreating(true);
    try {
      await coordinatorService.createIncidentByStaff({
        shipmentId: createForm.shipmentId?.trim() || null,
        incidentType: createForm.incidentType,
        severityLevel: createForm.severityLevel,
        description: createForm.description.trim(),
        location: createForm.location?.trim() || null,
      });
      closeCreateModal();
      loadIncidents();
      notify.success("Đã tạo sự cố.");
    } catch (error) {
      notify.error(error.message || "Không thể tạo sự cố.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white dark:bg-[#161922] rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 gap-3 flex-wrap">
          <div>
            <div className="text-sm font-bold text-gray-800 dark:text-gray-100">Danh sách sự cố</div>
            <div className="text-xs text-gray-400 dark:text-gray-400">Nếu chưa lấy hàng, doanh thu thuộc về tài xế thay thế. Nếu đã lấy hàng, doanh thu chia 50/50.</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              size="sm"
              variant="bordered"
              className="w-44"
              startContent={ic(RiFlag2Line)}
              selectedKeys={new Set([statusFilter])}
              onSelectionChange={(keys) => setStatusFilter([...keys][0] ?? "")}
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} textValue={o.label}>{o.label}</SelectItem>
              ))}
            </Select>
            <Select
              size="sm"
              variant="bordered"
              className="w-40"
              startContent={ic(RiAlertLine)}
              selectedKeys={new Set([severityFilter])}
              onSelectionChange={(keys) => setSeverityFilter([...keys][0] ?? "")}
            >
              {SEVERITY_FILTER_OPTIONS.map((o) => (
                <SelectItem key={o.value} textValue={o.label}>{o.label}</SelectItem>
              ))}
            </Select>
            <Select
              size="sm"
              variant="bordered"
              className="w-44"
              placeholder="Sắp xếp"
              startContent={ic(RiSortDesc)}
              selectedKeys={new Set([sortBy])}
              onSelectionChange={(keys) => setSortBy([...keys][0] ?? "newest")}
            >
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} textValue={o.label}>{o.label}</SelectItem>
              ))}
            </Select>
            <span className="text-xs text-gray-400 dark:text-gray-400 whitespace-nowrap">{incidents.length} sự cố · {incidents.filter((i) => i.status === "open").length} mới tiếp nhận</span>
          </div>
        </div>

        <div className="overflow-x-auto">
        <Table
          removeWrapper
          aria-label="Danh sách sự cố"
          classNames={{ th: "px-4 first:pl-5 last:pr-5", td: "px-4 py-3 first:pl-5 last:pr-5" }}
          bottomContent={
            pagination.totalPages > 1 ? (
              <div className="flex justify-center py-3">
                <div className="flex gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => loadIncidents(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium ${p === pagination.page ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          }
        >
          <TableHeader>
            <TableColumn>SỰ CỐ</TableColumn>
            <TableColumn>CHUYẾN</TableColumn>
            <TableColumn>TÀI XẾ BÁO CÁO</TableColumn>
            <TableColumn>TÀI XẾ HIỆN TẠI</TableColumn>
            <TableColumn>MỐC LẤY HÀNG</TableColumn>
            <TableColumn>TRẠNG THÁI</TableColumn>
            <TableColumn> </TableColumn>
          </TableHeader>
          <TableBody
            items={incidents}
            isLoading={loading}
            loadingContent={<Spinner color="primary" />}
            emptyContent="Không có sự cố nào phù hợp."
          >
            {(incident) => (
              <TableRow key={incident.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">#{incident.id}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-400">{incidentTypeLabel(incident.incident_type)}</span>
                  </div>
                </TableCell>
                <TableCell>{incident.shipment_id ? `#${incident.shipment_id}` : "-"}</TableCell>
                <TableCell>{incident.reported_by_name || "-"}</TableCell>
                <TableCell>{incident.current_driver_name || "-"}</TableCell>
                <TableCell>{incident.pickup_completed ? "Đã lấy hàng" : "Chưa lấy hàng"}</TableCell>
                <TableCell><StatusBadge status={incident.status} /></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="flat"
                      className="h-8 px-3 text-xs gap-1.5 overflow-visible"
                      onPress={() => openDetailModal(incident)}
                    >
                      <RiEyeLine size={16} className="shrink-0 overflow-visible" />
                      <span>Chi tiết</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="primary"
                      className="h-8 px-3 text-xs gap-1.5 overflow-visible"
                      isDisabled={incident.status === "closed" || incident.status === "resolved"}
                      onPress={() => openModal(incident)}
                    >
                      <RiToolsLine size={16} className="shrink-0 overflow-visible" />
                      <span>Xử lý</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <IncidentDetailModal
        open={modalOpen}
        incident={selectedIncident}
        incidentForm={form}
        setIncidentForm={setForm}
        saving={saving}
        drivers={drivers}
        onClose={closeModal}
        onSubmit={handleSubmit}
        compensation={compensation}
        setCompensation={setCompensation}
        onResolveFailed={handleResolveFailed}
        resolvingFailed={resolvingFailed}
        onCancelDamagedShipment={handleCancelDamagedShipment}
        cancellingDamaged={cancellingDamaged}
      />

      <IncidentDetailModal
        open={!!detailIncident}
        incident={detailIncident}
        incidentForm={form}
        setIncidentForm={setForm}
        saving={false}
        drivers={drivers}
        onClose={() => setDetailIncident(null)}
        onSubmit={() => {}}
        compensation={compensation}
        setCompensation={setCompensation}
        readOnly
      />

      <CreateIncidentModal
        open={createOpen}
        form={createForm}
        setForm={setCreateForm}
        saving={creating}
        onClose={closeCreateModal}
        onSubmit={handleCreateIncident}
      />
    </div>
  );
});

export default IncidentsView;
