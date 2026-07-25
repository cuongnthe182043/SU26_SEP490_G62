import { useDeferredValue, useEffect, useState } from "react";
import {
  Button,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { RiAddLine, RiEyeLine } from "react-icons/ri";
import { apiRequest } from "../../services/apiClient";
import { notify } from "../../components/shared-ui/Toast";
import IncidentDetailModal from "./components/IncidentDetailModal";
import CreateIncidentModal from "./components/CreateIncidentModal";
import StatusTag from "./components/StatusTag";
import LoadingState from "../../components/LoadingState";

const EMPTY_CREATE_FORM = { incidentType: "", severityLevel: "medium", shipmentId: "", description: "", location: "" };

export default function IncidentsPage({ search, refreshKey, onIncidentResolved, basePath = "/api/coordinator" }) {
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [drivers, setDrivers] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [form, setForm] = useState({ status: "investigating", resolution: "", replacement_driver_id: "" });

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);

  const deferredSearch = useDeferredValue(search);

  const loadIncidents = async (page = pagination.page) => {
    setIncidentsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });
      if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
      const queryString = params.toString();
      const data = await apiRequest(`${basePath}/incidents${queryString ? `?${queryString}` : ""}`);
      setIncidents(data.incidents || []);
      if (data.pagination) {
        setPagination(data.pagination);
      } else {
        setPagination({ page, limit: pagination.limit, total: data.incidents?.length || 0, totalPages: 1 });
      }
    } catch (error) {
      notify.error(error.message || "Không thể tải danh sách sự cố.");
    } finally {
      setIncidentsLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, refreshKey]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest("/api/drivers");
        setDrivers(data.drivers || []);
      } catch {
        notify.error("Không thể tải danh sách tài xế.");
      }
    })();
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setSelectedIncident(null);
    setForm({ status: "investigating", resolution: "", replacement_driver_id: "" });
  };

  const openModal = (incident) => {
    setSelectedIncident(incident);
    setForm({
      status: incident.status === "open" ? "investigating" : incident.status || "investigating",
      resolution: "",
      replacement_driver_id: incident.replacement_driver_id ? String(incident.replacement_driver_id) : "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedIncident) return;
    setSaving(true);
    try {
      await apiRequest(`/api/incidents/${selectedIncident.id}/status`, {
        method: "PATCH",
        body: {
          status: form.status,
          resolution: form.resolution || null,
          replacementDriverId: form.replacement_driver_id ? Number(form.replacement_driver_id) : null,
        },
      });
      notify.success("Cập nhật sự cố thành công.");
      closeModal();
      loadIncidents();
      onIncidentResolved?.();
    } catch (error) {
      notify.error(error.message || "Không thể cập nhật sự cố.");
    } finally {
      setSaving(false);
    }
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  };

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
      await apiRequest("/api/incidents/staff", {
        method: "POST",
        body: {
          shipmentId: createForm.shipmentId?.trim() || null,
          incidentType: createForm.incidentType,
          severityLevel: createForm.severityLevel,
          description: createForm.description.trim(),
          location: createForm.location?.trim() || null,
        },
      });
      notify.success("Đã tạo sự cố.");
      closeCreateModal();
      loadIncidents();
    } catch (error) {
      notify.error(error.message || "Không thể tạo sự cố.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <section className="hero hero-compact">
        <div>
          <h1>Xử lý sự cố</h1>
          <p>Theo dõi sự cố đang mở, chọn tài xế thay thế và áp dụng quy tắc chia doanh thu theo mốc lấy hàng.</p>
        </div>
        <div className="hero-metrics">
          <div className="upload-hint">
            {incidentsLoading ? (
              <LoadingState label="Đang tải..." size="sm" className="py-0 justify-start" />
            ) : `${incidents.length} sự cố`}
          </div>
          <div className="upload-hint">{incidents.filter((item) => item.status === "open").length} mới tiếp nhận</div>
          <div className="upload-hint">{incidents.filter((item) => item.pickup_completed).length} đã lấy hàng</div>
          <Button color="primary" className="coordinator-primary-btn" startContent={<RiAddLine />} onPress={() => setCreateOpen(true)}>
            Tạo sự cố
          </Button>
        </div>
      </section>

      <section className="orders-panel">
        <div className="panel-head">
          <div>
            <h2>Danh sách sự cố</h2>
            <p>Nếu chưa lấy hàng, doanh thu thuộc về tài xế thay thế. Nếu đã lấy hàng, doanh thu chia 50/50.</p>
          </div>
        </div>

        <Table
          aria-label="Danh sách sự cố"
          bottomContent={
            pagination.totalPages > 1 ? (
              <div className="flex justify-center py-2">
                <Pagination page={pagination.page} total={pagination.totalPages} onChange={(page) => loadIncidents(page)} showControls />
              </div>
            ) : null
          }
        >
          <TableHeader>
            <TableColumn>Sự cố</TableColumn>
            <TableColumn>Chuyến</TableColumn>
            <TableColumn>Tài xế báo cáo</TableColumn>
            <TableColumn>Tài xế hiện tại</TableColumn>
            <TableColumn>Trạng thái chuyến</TableColumn>
            <TableColumn>Mốc lấy hàng</TableColumn>
            <TableColumn>Quy tắc doanh thu</TableColumn>
            <TableColumn>Trạng thái sự cố</TableColumn>
            <TableColumn>Thao tác</TableColumn>
          </TableHeader>
          <TableBody
            isLoading={incidentsLoading}
            loadingContent={<LoadingState label="Đang tải..." size="sm" />}
            emptyContent="Không có sự cố nào phù hợp."
            items={incidents}
          >
            {(incident) => (
              <TableRow key={incident.id}>
                <TableCell>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>#{incident.id}</strong>
                    <span>{incident.incident_type}</span>
                  </div>
                </TableCell>
                <TableCell>{incident.shipment_id ? `#${incident.shipment_id}` : "-"}</TableCell>
                <TableCell>{incident.reported_by_name || "-"}</TableCell>
                <TableCell>{incident.current_driver_name || "-"}</TableCell>
                <TableCell><StatusTag status={incident.shipment_status} /></TableCell>
                <TableCell>{incident.pickup_completed ? "Đã lấy hàng" : "Chưa lấy hàng"}</TableCell>
                <TableCell>{incident.pickup_completed ? "Chia 50/50" : "Tài xế thay thế nhận 100%"}</TableCell>
                <TableCell><StatusTag status={incident.status} /></TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="light"
                    startContent={<RiEyeLine />}
                    isDisabled={incident.status === "closed" || incident.status === "resolved"}
                    onPress={() => openModal(incident)}
                  >
                    Xử lý
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <IncidentDetailModal
        open={modalOpen}
        incident={selectedIncident}
        incidentForm={form}
        setIncidentForm={setForm}
        saving={saving}
        drivers={drivers}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      <CreateIncidentModal
        open={createOpen}
        form={createForm}
        setForm={setCreateForm}
        saving={creating}
        onClose={closeCreateModal}
        onSubmit={handleCreateIncident}
      />
    </>
  );
}
