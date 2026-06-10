import React, { useEffect, useState } from "react";
import {
  Button,
  Descriptions,
  Dropdown,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import {
  CarOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  SearchOutlined,
  ToolOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import VehicleModal from "./VehicleModal";
import PageContainer, { CardSection } from "../../components/common/PageContainer";
import {
  assignVehicleDriver,
  createVehicle,
  fetchVehicleDetail,
  fetchDriverOptions,
  fetchVehicleGroups,
  fetchVehicles,
  markVehicleBroken,
  retireVehicle,
  restoreVehicle,
  sendVehicleToMaintenance,
  updateVehicle,
  verifyVehicleMaintenance,
} from "./vehicleManagementApi";
import VehicleGroupList from "./VehicleGroupList";

const { Text, Title } = Typography;

const STATUS_COLOR = {
  active: "green",
  maintenance: "orange",
  broken: "red",
  retired: "default",
};

const STATUS_LABEL = {
  active: "Hoạt động",
  maintenance: "Bảo dưỡng",
  broken: "Hỏng",
  retired: "Nghỉ",
};

const STATUS_OPTIONS = [
  { label: "Tất cả trạng thái", value: "" },
  { label: "Hoạt động", value: "active" },
  { label: "Bảo dưỡng", value: "maintenance" },
  { label: "Hỏng", value: "broken" },
  { label: "Nghỉ", value: "retired" },
];

const formatDateTime = (value) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
};

const MAINTENANCE_ACTIONS = new Set(["send_to_maintenance", "complete_maintenance"]);
const INCIDENT_ACTIONS = new Set(["mark_broken", "restore_vehicle"]);

const normalizeBillPics = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim());
};

const buildActionMenuItems = (record, handlers) => {
  const items = [
    {
      key: "details",
      icon: <EyeOutlined />,
      label: "Details",
      onClick: () => handlers.openDetail(record),
    },
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "Edit",
      onClick: () => handlers.handleOpenEdit(record),
    },
    {
      key: "assign",
      icon: <UserSwitchOutlined />,
      label: record.assigned_driver_id ? "Unassign Driver" : "Assign Driver",
      disabled: record.status !== "active",
      onClick: () => handlers.handleDriverToggle(record),
    },
  ];

  if (record.status === "active") {
    items.push(
      {
        key: "maintenance",
        icon: <ToolOutlined />,
        label: "Send to Maintenance",
        onClick: () => handlers.handleSendToMaintenance(record),
      },
      {
        key: "broken",
        icon: <WarningOutlined />,
        label: "Mark Broken",
        danger: true,
        onClick: () => handlers.handleMarkBroken(record),
      },
      {
        key: "retire",
        icon: <DeleteOutlined />,
        label: "Retire",
        onClick: () => handlers.handleRetire(record),
      }
    );
  }

  if (record.status === "maintenance") {
    items.push({
      key: "verify-maintenance",
      icon: <ToolOutlined />,
      label: record.active_maintenance_status === "pending_verification" ? "Verify Maintenance" : "Check Maintenance",
      onClick: () => handlers.handleVerifyMaintenance(record),
    });
  }

  if (record.status === "broken") {
    items.push({
      key: "restore",
      icon: <ToolOutlined />,
      label: "Restore",
      onClick: () => handlers.handleRestore(record),
    });
  }

  return items;
};

const buildHistoryTimelineItems = (items) =>
  items.map((item) => ({
    color: statusColorMap[item.to_status] || "blue",
    children: (
      <Space direction="vertical" size={0}>
        <Text strong>{item.action_type}</Text>
        <Text type="secondary">
          {String(item.from_status).toUpperCase()} {"->"} {String(item.to_status).toUpperCase()}
        </Text>
        <Text type="secondary">
          {item.created_by_name || "Manager"} | {formatDateTime(item.created_at)}
        </Text>
        {item.note ? <Text>{item.note}</Text> : null}
      </Space>
    ),
  }));

export default function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleGroups, setVehicleGroups] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [detailVehicle, setDetailVehicle] = useState(null);

  const [maintenanceForm] = Form.useForm();
  const [failureForm] = Form.useForm();
  const [verifyMaintenanceForm] = Form.useForm();
  const [restoreForm] = Form.useForm();
  const [retireForm] = Form.useForm();

  const [maintenanceTarget, setMaintenanceTarget] = useState(null);
  const [verifyMaintenanceTarget, setVerifyMaintenanceTarget] = useState(null);
  const [brokenTarget, setBrokenTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [retireTarget, setRetireTarget] = useState(null);
  const [maintenanceDriverOptions, setMaintenanceDriverOptions] = useState([]);
  const [loadingMaintenanceDrivers, setLoadingMaintenanceDrivers] = useState(false);

  const loadMaintenanceDriverOptions = async (vehicle) => {
    if (!vehicle?.id) {
      setMaintenanceDriverOptions([]);
      return [];
    }

    try {
      setLoadingMaintenanceDrivers(true);
      const data = await fetchDriverOptions(vehicle.id);
      const drivers = data.drivers || [];
      setMaintenanceDriverOptions(drivers);
      return drivers;
    } catch (err) {
      setMaintenanceDriverOptions([]);
      message.error(err.message);
      return [];
    } finally {
      setLoadingMaintenanceDrivers(false);
    }
  };

  const maintenanceDriverSelectOptions = maintenanceDriverOptions.map((driver) => ({
    label: `${driver.full_name} - ${driver.email}${driver.is_selected_vehicle_driver ? " (assigned driver)" : ""}${driver.has_active_shipment ? " - delivering" : ""}`,
    value: driver.id,
    disabled: !driver.is_maintenance_eligible,
  }));

  const loadVehicleGroups = async () => {
    try {
      const data = await fetchVehicleGroups();
      setVehicleGroups(data.vehicleGroups || []);
    } catch (err) {
      message.error(err.message);
    }
  };

  const loadVehicles = async ({
    page = pagination.current,
    limit = pagination.pageSize,
    searchValue = search,
    statusValue = statusFilter,
    groupValue = groupFilter,
  } = {}) => {
    try {
      setLoading(true);
      const data = await fetchVehicles({
        page, limit, search: searchValue, status: statusValue, vehicle_group_id: groupValue,
      });
      setVehicles(data.items || []);
      setPagination({
        current: data.pagination?.page || page,
        pageSize: data.pagination?.limit || limit,
        total: data.pagination?.total || 0,
      });
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicleGroups();
    loadVehicles({ page: 1 });
  }, []);

  const handleTableChange = (next) => loadVehicles({ page: next.current, limit: next.pageSize });

  const handleFilterSubmit = () =>
    loadVehicles({ page: 1, searchValue: search, statusValue: statusFilter, groupValue: groupFilter });

  const handleOpenCreate = () => { setEditingVehicle(null); setModalOpen(true); };
  const handleOpenEdit = (vehicle) => { setEditingVehicle(vehicle); setModalOpen(true); };

  const handleSubmit = async (values) => {
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, values);
        message.success("Cập nhật xe thành công");
      } else {
        await createVehicle(values);
        message.success("Thêm xe thành công");
      }
      setModalOpen(false);
      setEditingVehicle(null);
      await loadVehicles();
    } catch (err) {
      message.error(err.message);
    }
  };

  const openDetail = async (vehicle) => {
    try {
      const data = await fetchVehicleDetail(vehicle.id);
      setDetailVehicle(data.vehicle);
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleDriverToggle = (vehicle) => {
    if (vehicle.assigned_driver_id) {
      Modal.confirm({
        title: `Hủy phân công tài xế khỏi xe ${vehicle.plate_number}?`,
        okText: "Xác nhận",
        cancelText: "Hủy",
        onOk: async () => {
          try {
            await assignVehicleDriver(vehicle.id, null);
            message.success("Hủy phân công thành công");
            await loadVehicles();
          } catch (err) {
            message.error(err.message);
          }
        },
      });
      return;
    }
    handleOpenEdit(vehicle);
  };

  const handleSendToMaintenance = async (vehicle) => {
    maintenanceForm.resetFields();
    maintenanceForm.setFieldsValue({
      maintenance_type: "scheduled",
      maintenance_date: new Date().toISOString().slice(0, 10),
      performed_by: vehicle.assigned_driver_id || undefined,
    });
    setMaintenanceTarget(vehicle);
    await loadMaintenanceDriverOptions(vehicle);
  };

  const submitMaintenance = async () => {
    try {
      const values = await maintenanceForm.validateFields();
      await sendVehicleToMaintenance(maintenanceTarget.id, values);
      message.success("Gửi xe đi bảo dưỡng thành công");
      setMaintenanceTarget(null);
      await loadVehicles();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message);
    }
  };

  const handleVerifyMaintenance = async (vehicle) => {
    try {
      verifyMaintenanceForm.resetFields();
      const data = await fetchVehicleDetail(vehicle.id);
      setVerifyMaintenanceTarget(data.vehicle);
    } catch (err) {
      message.error(err.message);
    }
  };

  const submitVerifyMaintenance = async () => {
    try {
      const values = await verifyMaintenanceForm.validateFields();
      await verifyVehicleMaintenance(verifyMaintenanceTarget.id, values);
      message.success("Maintenance verified");
      setVerifyMaintenanceTarget(null);
      await loadVehicles();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message);
    }
  };

  const handleMarkBroken = (vehicle) => {
    failureForm.resetFields();
    failureForm.setFieldsValue({ severity_level: "medium" });
    setBrokenTarget(vehicle);
  };

  const submitBroken = async () => {
    try {
      const values = await failureForm.validateFields();
      await markVehicleBroken(brokenTarget.id, values);
      message.success("Đã đánh dấu xe hỏng");
      setBrokenTarget(null);
      await loadVehicles();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message);
    }
  };

  const handleRestore = (vehicle) => {
    restoreForm.resetFields();
    setRestoreTarget(vehicle);
  };

  const submitRestore = async () => {
    try {
      const values = await restoreForm.validateFields();
      await restoreVehicle(restoreTarget.id, values);
      message.success("Khôi phục xe thành công");
      setRestoreTarget(null);
      await loadVehicles();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message);
    }
  };

  const handleRetire = (vehicle) => {
    retireForm.resetFields();
    setRetireTarget(vehicle);
  };

  const submitRetire = async () => {
    try {
      const values = await retireForm.validateFields();
      await retireVehicle(retireTarget.id, values);
      message.success("Ngừng sử dụng xe thành công");
      setRetireTarget(null);
      await loadVehicles();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.message);
    }
  };

  const buildMoreMenu = (record) => {
    const items = [
      {
        key: 'assign',
        icon: <UserCog size={14} strokeWidth={SW} />,
        label: record.assigned_driver_id ? 'Hủy phân công' : 'Phân công tài xế',
        disabled: record.status !== 'active',
        onClick: () => handleDriverToggle(record),
      },
      { type: 'divider' },
    ];

    if (record.status === 'active') {
      items.push(
        { key: 'maintenance', icon: <Wrench size={14} strokeWidth={SW} />, label: 'Gửi bảo dưỡng', onClick: () => handleSendToMaintenance(record) },
        { key: 'broken', icon: <AlertTriangle size={14} strokeWidth={SW} />, label: 'Đánh dấu hỏng', danger: true, onClick: () => handleMarkBroken(record) },
        { key: 'retire', icon: <Trash2 size={14} strokeWidth={SW} />, label: 'Ngừng sử dụng', onClick: () => handleRetire(record) },
      );
    }

    if (record.status === 'maintenance') {
      items.push({
        key: 'complete-maintenance',
        icon: <Check size={14} strokeWidth={SW} />,
        label: 'Hoàn thành bảo dưỡng',
        onClick: () => handleCompleteMaintenance(record),
      });
    }

    if (record.status === 'broken') {
      items.push({
        key: 'restore',
        icon: <Wrench size={14} strokeWidth={SW} />,
        label: 'Khôi phục xe',
        onClick: () => handleRestore(record),
      });
    }

    return { items };
  };

  const columns = [
    {
      title: "Biển số",
      dataIndex: "plate_number",
      key: "plate_number",
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: "Nhóm xe",
      key: "vehicle_group",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.vehicle_group_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>#{record.vehicle_group_id}</Text>
        </Space>
      ),
    },
    {
      title: "Thông tin xe",
      key: "vehicle",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{[record.brand, record.model].filter(Boolean).join(" ") || "Chưa cập nhật"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.load_capacity_kg ? `${record.load_capacity_kg} kg` : "Chưa có tải trọng"}
            {record.manufacture_year ? ` · ${record.manufacture_year}` : ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "Tài xế phụ trách",
      key: "assigned_driver",
      render: (_, record) =>
        record.assigned_driver_id ? (
          <Space direction="vertical" size={0}>
            <Text>{record.assigned_driver_name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.assigned_driver_email}</Text>
          </Space>
        ) : (
          <Text type="secondary">Chưa phân công</Text>
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={STATUS_COLOR[status] || "default"}>
          {STATUS_LABEL[status] || String(status).toUpperCase()}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: buildActionMenuItems(record, {
              openDetail,
              handleOpenEdit,
              handleDriverToggle,
              handleSendToMaintenance,
              handleVerifyMaintenance,
              handleMarkBroken,
              handleRestore,
              handleRetire,
            }),
          }}
        >
          <Button icon={<EllipsisOutlined />} aria-label={`Actions for vehicle ${record.plate_number}`} />
        </Dropdown>
      ),
    },
  ];

  const maintenanceHistory = (detailVehicle?.status_history || []).filter((item) => MAINTENANCE_ACTIONS.has(item.action_type));
  const incidentHistory = (detailVehicle?.status_history || []).filter((item) => INCIDENT_ACTIONS.has(item.action_type));
  const currentEditingGroupMissing = editingVehicle?.vehicle_group_id
    && !vehicleGroups.some((group) => Number(group.id) === Number(editingVehicle.vehicle_group_id));
  const selectableVehicleGroups = currentEditingGroupMissing
    ? [
        ...vehicleGroups,
        {
          id: editingVehicle.vehicle_group_id,
          name: editingVehicle.vehicle_group_name || `Group #${editingVehicle.vehicle_group_id}`,
          status: editingVehicle.vehicle_group_status || "hidden",
        },
      ]
    : vehicleGroups;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <VehicleGroupList
        embedded
        vehicleGroups={vehicleGroups}
        onVehicleGroupsChange={setVehicleGroups}
      />

      <div style={{ padding: 24, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              Vehicles
            </Title>
            <Text type="secondary">{pagination.total} vehicles</Text>
          </div>
          <Button type="primary" icon={<CarOutlined />} onClick={handleOpenCreate}>
            Add Vehicle
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search by plate number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onPressEnter={handleFilterSubmit}
          />
          <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
          <Select
            options={[{ label: "All Groups", value: "" }, ...vehicleGroups.map((group) => ({ label: group.name, value: group.id }))]}
            value={groupFilter}
            onChange={setGroupFilter}
          />
          <Button type="primary" onClick={handleFilterSubmit}>
            Apply
          </Button>
        </div>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={vehicles}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: "max-content" }}
        />
      </div>

      <VehicleModal
        open={modalOpen}
        editingVehicle={editingVehicle}
        vehicleGroups={selectableVehicleGroups}
        onClose={() => {
          setModalOpen(false);
          setEditingVehicle(null);
        }}
        onSubmit={handleSubmit}
      />

      {/* Chi tiết xe */}
      <Modal
        open={Boolean(detailVehicle)}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Eye size={18} strokeWidth={SW} />
            {detailVehicle ? `Xe: ${detailVehicle.plate_number}` : "Chi tiết xe"}
          </span>
        }
        onCancel={() => setDetailVehicle(null)}
        footer={null}
        width={900}
      >
        {detailVehicle && (
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Status">
                <Tag color={statusColorMap[detailVehicle.status] || "default"}>{String(detailVehicle.status).toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nhóm xe">{detailVehicle.vehicle_group_name}</Descriptions.Item>
              <Descriptions.Item label="Giá / km">{Number(detailVehicle.price_per_km).toLocaleString()} đ</Descriptions.Item>
              <Descriptions.Item label="Hãng xe">{detailVehicle.brand || "Chưa có"}</Descriptions.Item>
              <Descriptions.Item label="Mẫu xe">{detailVehicle.model || "Chưa có"}</Descriptions.Item>
              <Descriptions.Item label="Tải trọng">
                {detailVehicle.load_capacity_kg ? `${detailVehicle.load_capacity_kg} kg` : "Chưa có"}
              </Descriptions.Item>
              <Descriptions.Item label="Manufacture Year">{detailVehicle.manufacture_year || "Not set"}</Descriptions.Item>
              <Descriptions.Item label="Purchase Date">{detailVehicle.purchase_date || "Not set"}</Descriptions.Item>
              <Descriptions.Item label="Assigned Driver">
                {detailVehicle.assigned_driver_name
                  ? `${detailVehicle.assigned_driver_name} (${detailVehicle.assigned_driver_email})`
                  : "Chưa phân công"}
              </Descriptions.Item>
              <Descriptions.Item label="Bằng lái">
                {detailVehicle.assigned_driver_license_number || "Chưa có"}
              </Descriptions.Item>
              <Descriptions.Item label="Bảo dưỡng hiện tại">
                {detailVehicle.active_maintenance_id
                  ? `#${detailVehicle.active_maintenance_id} | ${detailVehicle.active_maintenance_type} | ${detailVehicle.active_maintenance_description || "No description"} | ${detailVehicle.active_maintenance_performed_by_name || "No driver"} | ${detailVehicle.active_maintenance_status || "open"}`
                  : "None"}
              </Descriptions.Item>
              <Descriptions.Item label="Sự cố hỏng hóc">
                {detailVehicle.active_failure_id
                  ? `#${detailVehicle.active_failure_id} · ${detailVehicle.active_failure_type} · ${detailVehicle.active_failure_severity}`
                  : "Không có"}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">{formatDateTime(detailVehicle.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">{formatDateTime(detailVehicle.updated_at)}</Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>Maintenance History</Title>
              {maintenanceHistory.length > 0 ? (
                <Timeline items={buildHistoryTimelineItems(maintenanceHistory)} />
              ) : (
                <Text type="secondary">No maintenance history.</Text>
              )}
            </div>

            <div>
              <Title level={5}>Incident History</Title>
              {incidentHistory.length > 0 ? (
                <Timeline items={buildHistoryTimelineItems(incidentHistory)} />
              ) : (
                <Text type="secondary">No incident history.</Text>
              )}
            </div>
          </Space>
        )}
      </Modal>

      {/* Bảo dưỡng xe */}
      <Modal
        open={Boolean(maintenanceTarget)}
        title={maintenanceTarget ? `Send ${maintenanceTarget.plate_number} to maintenance` : "Send to Maintenance"}
        onCancel={() => {
          setMaintenanceTarget(null);
          setMaintenanceDriverOptions([]);
        }}
        onOk={submitMaintenance}
        okText="Xác nhận"
        cancelText="Hủy"
        okButtonProps={{ icon: <Check size={15} strokeWidth={SW} /> }}
        cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} /> }}
      >
        <Form form={maintenanceForm} layout="vertical">
          <Form.Item label="Loại bảo dưỡng" name="maintenance_type" rules={[{ required: true, message: "Vui lòng chọn loại bảo dưỡng" }]}>
            <Select prefix={<Wrench size={15} strokeWidth={SW} />} options={[
              { label: "Định kỳ", value: "scheduled" },
              { label: "Sửa chữa", value: "repair" },
              { label: "Kiểm tra", value: "inspection" },
              { label: "Khẩn cấp", value: "emergency" },
            ]} />
          </Form.Item>
          <Form.Item label={fieldLabel(FileText, "Mô tả")} name="description" rules={[{ required: true, message: "Vui lòng nhập mô tả" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Ngày bảo dưỡng" name="maintenance_date" rules={[{ required: true, message: "Vui lòng chọn ngày" }]}>
            <Input type="date" prefix={<Calendar size={15} strokeWidth={SW} />} />
          </Form.Item>
          <Form.Item label="Chi phí (đ)" name="cost">
            <InputNumber prefix={<Coins size={15} strokeWidth={SW} />} style={{ width: "100%" }} min={0} precision={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item
            label="Performed By"
            name="performed_by"
            rules={[{ required: true, message: "Performed by driver is required" }]}
          >
            <Select
              loading={loadingMaintenanceDrivers}
              placeholder="Select maintenance driver"
              options={maintenanceDriverSelectOptions}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Hoàn thành bảo dưỡng */}
      <Modal
        open={Boolean(verifyMaintenanceTarget)}
        title={verifyMaintenanceTarget ? `Verify maintenance for ${verifyMaintenanceTarget.plate_number}` : "Verify Maintenance"}
        onCancel={() => {
          setVerifyMaintenanceTarget(null);
        }}
        onOk={submitVerifyMaintenance}
        okText="Verify"
        okButtonProps={{ disabled: verifyMaintenanceTarget?.active_maintenance_status !== "pending_verification" }}
      >
        <Form form={verifyMaintenanceForm} layout="vertical">
          <Form.Item label="Bill Images">
            {normalizeBillPics(verifyMaintenanceTarget?.active_maintenance_bill_pics).length > 0 ? (
              <Image.PreviewGroup>
                <Space wrap size="middle">
                  {normalizeBillPics(verifyMaintenanceTarget?.active_maintenance_bill_pics).map((url, index) => (
                    <Image
                      key={`${url}-${index}`}
                      src={url}
                      alt={`Maintenance bill ${index + 1}`}
                      width={120}
                      height={120}
                      style={{ objectFit: "cover", borderRadius: 8 }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            ) : (
              <Text type="secondary">No bill images uploaded yet.</Text>
            )}
          </Form.Item>
          <Form.Item label="Verification Note" name="verification_note" rules={[{ required: true, message: "Verification note is required" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          {verifyMaintenanceTarget?.active_maintenance_status !== "pending_verification" ? (
            <Text type="secondary">This maintenance is still waiting for the driver to upload bill images and mark it ready.</Text>
          ) : null}
        </Form>
      </Modal>

      {/* Đánh dấu hỏng */}
      <Modal
        open={Boolean(brokenTarget)}
        title={brokenTarget ? `Đánh dấu hỏng: ${brokenTarget.plate_number}` : "Đánh dấu hỏng"}
        onCancel={() => setBrokenTarget(null)}
        onOk={submitBroken}
        okText="Xác nhận"
        okButtonProps={{ danger: true, icon: <AlertTriangle size={15} strokeWidth={SW} /> }}
        cancelText="Hủy"
        cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} /> }}
      >
        <Form form={failureForm} layout="vertical">
          <Form.Item label="Loại lỗi" name="failure_type" rules={[{ required: true, message: "Vui lòng nhập loại lỗi" }]}>
            <Input prefix={<AlertTriangle size={15} strokeWidth={SW} />} placeholder="Ví dụ: hỏng động cơ" />
          </Form.Item>
          <Form.Item label="Mức độ nghiêm trọng" name="severity_level" rules={[{ required: true, message: "Vui lòng chọn mức độ" }]}>
            <Select prefix={<Gauge size={15} strokeWidth={SW} />} options={[
              { label: "Thấp", value: "low" },
              { label: "Trung bình", value: "medium" },
              { label: "Cao", value: "high" },
              { label: "Nghiêm trọng", value: "critical" },
            ]} />
          </Form.Item>
          <Form.Item label={fieldLabel(FileText, "Mô tả")} name="description" rules={[{ required: true, message: "Vui lòng nhập mô tả" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label={fieldLabel(StickyNote, "Ghi chú")} name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Khôi phục xe */}
      <Modal
        open={Boolean(restoreTarget)}
        title={restoreTarget ? `Khôi phục xe: ${restoreTarget.plate_number}` : "Khôi phục xe"}
        onCancel={() => setRestoreTarget(null)}
        onOk={submitRestore}
        okText="Khôi phục"
        cancelText="Hủy"
        okButtonProps={{ icon: <RotateCcw size={15} strokeWidth={SW} /> }}
        cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} /> }}
      >
        <Form form={restoreForm} layout="vertical">
          <Form.Item label={fieldLabel(FileText, "Ghi chú khôi phục")} name="resolution_note" rules={[{ required: true, message: "Vui lòng nhập ghi chú" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Ngừng sử dụng */}
      <Modal
        open={Boolean(retireTarget)}
        title={retireTarget ? `Ngừng sử dụng: ${retireTarget.plate_number}` : "Ngừng sử dụng xe"}
        onCancel={() => setRetireTarget(null)}
        onOk={submitRetire}
        okText="Xác nhận ngừng"
        okButtonProps={{ danger: true, icon: <Ban size={15} strokeWidth={SW} /> }}
        cancelText="Hủy"
        cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} /> }}
      >
        <Form form={retireForm} layout="vertical">
          <Form.Item label={fieldLabel(FileText, "Lý do ngừng sử dụng")} name="note" rules={[{ required: true, message: "Vui lòng nhập lý do" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
