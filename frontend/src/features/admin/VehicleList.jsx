import React, { useEffect, useState } from "react";
import {
  Button,
  Descriptions,
  Dropdown,
  Form,
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
  AlertTriangle,
  Ban,
  Calendar,
  Check,
  CircleDot,
  ClipboardCheck,
  Coins,
  Eye,
  FileText,
  Gauge,
  History,
  Layers,
  ListFilter,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Trash2,
  User,
  UserCog,
  Wrench,
  X,
} from "lucide-react";

const SW = 1.75;
import VehicleModal from "./VehicleModal";
import PageContainer, { CardSection } from "../../components/common/PageContainer";
import {
  assignVehicleDriver,
  completeVehicleMaintenance,
  createVehicle,
  fetchVehicleDetail,
  fetchVehicles,
  markVehicleBroken,
  retireVehicle,
  restoreVehicle,
  sendVehicleToMaintenance,
  updateVehicle,
} from "./vehicleManagementApi";

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

// Label kèm icon — dùng cho các trường TextArea (không hỗ trợ prefix)
const fieldLabel = (Icon, text) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <Icon size={13} strokeWidth={SW} /> {text}
  </span>
);

export default function VehicleList({ vehicleGroups }) {
  const [vehicles, setVehicles] = useState([]);
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
  const [completeMaintenanceForm] = Form.useForm();
  const [restoreForm] = Form.useForm();
  const [retireForm] = Form.useForm();

  const [maintenanceTarget, setMaintenanceTarget] = useState(null);
  const [completeMaintenanceTarget, setCompleteMaintenanceTarget] = useState(null);
  const [brokenTarget, setBrokenTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [retireTarget, setRetireTarget] = useState(null);

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

  useEffect(() => { loadVehicles({ page: 1 }); }, []);

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

  const handleSendToMaintenance = (vehicle) => {
    maintenanceForm.resetFields();
    maintenanceForm.setFieldsValue({
      maintenance_type: "scheduled",
      maintenance_date: new Date().toISOString().slice(0, 10),
    });
    setMaintenanceTarget(vehicle);
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

  const handleCompleteMaintenance = (vehicle) => {
    completeMaintenanceForm.resetFields();
    setCompleteMaintenanceTarget(vehicle);
  };

  const submitCompleteMaintenance = async () => {
    try {
      const values = await completeMaintenanceForm.validateFields();
      await completeVehicleMaintenance(completeMaintenanceTarget.id, values);
      message.success("Hoàn thành bảo dưỡng");
      setCompleteMaintenanceTarget(null);
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
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<Eye size={14} strokeWidth={SW} />}
            onClick={() => openDetail(record)}
          >
            Xem
          </Button>
          <Button
            type="text"
            icon={<Pencil size={14} strokeWidth={SW} />}
            onClick={() => handleOpenEdit(record)}
          >
            Sửa
          </Button>
          <Dropdown menu={buildMoreMenu(record)} trigger={["click"]} placement="bottomRight">
            <Button type="text" icon={<MoreVertical size={16} strokeWidth={SW} />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <CardSection>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Danh sách xe</Title>
            <Text type="secondary">{pagination.total} xe</Text>
          </div>
          <Button type="primary" icon={<Plus size={15} strokeWidth={SW} />} onClick={handleOpenCreate}>
            Thêm xe
          </Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10 }}>
          <Input
            allowClear
            prefix={<Search size={15} strokeWidth={SW} />}
            placeholder="Tìm theo biển số..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleFilterSubmit}
          />
          <Select
            prefix={<CircleDot size={15} strokeWidth={SW} />}
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Trạng thái"
          />
          <Select
            prefix={<Layers size={15} strokeWidth={SW} />}
            options={[
              { label: "Tất cả nhóm", value: "" },
              ...vehicleGroups.map((g) => ({ label: g.name, value: g.id })),
            ]}
            value={groupFilter}
            onChange={setGroupFilter}
            placeholder="Nhóm xe"
          />
          <Button type="primary" icon={<ListFilter size={15} strokeWidth={SW} />} onClick={handleFilterSubmit}>Lọc</Button>
        </div>
      </CardSection>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={vehicles}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} xe`,
          style: { padding: '12px 24px' },
        }}
        onChange={handleTableChange}
        scroll={{ x: "max-content" }}
      />

      <VehicleModal
        open={modalOpen}
        editingVehicle={editingVehicle}
        vehicleGroups={vehicleGroups}
        onClose={() => { setModalOpen(false); setEditingVehicle(null); }}
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
              <Descriptions.Item label="ID">{detailVehicle.id}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_COLOR[detailVehicle.status] || "default"}>
                  {STATUS_LABEL[detailVehicle.status] || String(detailVehicle.status).toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nhóm xe">{detailVehicle.vehicle_group_name}</Descriptions.Item>
              <Descriptions.Item label="Giá / km">{Number(detailVehicle.price_per_km).toLocaleString()} đ</Descriptions.Item>
              <Descriptions.Item label="Hãng xe">{detailVehicle.brand || "Chưa có"}</Descriptions.Item>
              <Descriptions.Item label="Mẫu xe">{detailVehicle.model || "Chưa có"}</Descriptions.Item>
              <Descriptions.Item label="Tải trọng">
                {detailVehicle.load_capacity_kg ? `${detailVehicle.load_capacity_kg} kg` : "Chưa có"}
              </Descriptions.Item>
              <Descriptions.Item label="Năm sản xuất">{detailVehicle.manufacture_year || "Chưa có"}</Descriptions.Item>
              <Descriptions.Item label="Ngày mua">{detailVehicle.purchase_date || "Chưa có"}</Descriptions.Item>
              <Descriptions.Item label="Tài xế phụ trách">
                {detailVehicle.assigned_driver_name
                  ? `${detailVehicle.assigned_driver_name} (${detailVehicle.assigned_driver_email})`
                  : "Chưa phân công"}
              </Descriptions.Item>
              <Descriptions.Item label="Bằng lái">
                {detailVehicle.assigned_driver_license_number || "Chưa có"}
              </Descriptions.Item>
              <Descriptions.Item label="Bảo dưỡng hiện tại">
                {detailVehicle.active_maintenance_id
                  ? `#${detailVehicle.active_maintenance_id} · ${detailVehicle.active_maintenance_type} · ${detailVehicle.active_maintenance_description || "Không có mô tả"}`
                  : "Không có"}
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
              <Title level={5} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <History size={16} strokeWidth={SW} />
                Lịch sử trạng thái
              </Title>
              <Timeline
                items={(detailVehicle.status_history || []).map((item) => ({
                  color: STATUS_COLOR[item.to_status] || "blue",
                  children: (
                    <Space direction="vertical" size={0}>
                      <Text strong>{item.action_type}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {String(item.from_status).toUpperCase()} → {String(item.to_status).toUpperCase()}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.created_by_name || "Quản lý"} · {formatDateTime(item.created_at)}
                      </Text>
                      {item.note && <Text style={{ fontSize: 13 }}>{item.note}</Text>}
                    </Space>
                  ),
                }))}
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* Bảo dưỡng xe */}
      <Modal
        open={Boolean(maintenanceTarget)}
        title={maintenanceTarget ? `Gửi bảo dưỡng: ${maintenanceTarget.plate_number}` : "Gửi bảo dưỡng"}
        onCancel={() => setMaintenanceTarget(null)}
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
          <Form.Item label="Người thực hiện" name="performed_by">
            <Input prefix={<User size={15} strokeWidth={SW} />} />
          </Form.Item>
          <Form.Item label={fieldLabel(StickyNote, "Ghi chú")} name="note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Hoàn thành bảo dưỡng */}
      <Modal
        open={Boolean(completeMaintenanceTarget)}
        title={completeMaintenanceTarget ? `Hoàn thành bảo dưỡng: ${completeMaintenanceTarget.plate_number}` : "Hoàn thành bảo dưỡng"}
        onCancel={() => setCompleteMaintenanceTarget(null)}
        onOk={submitCompleteMaintenance}
        okText="Hoàn thành"
        cancelText="Hủy"
        okButtonProps={{ icon: <ClipboardCheck size={15} strokeWidth={SW} /> }}
        cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} /> }}
      >
        <Form form={completeMaintenanceForm} layout="vertical">
          <Form.Item label={fieldLabel(FileText, "Ghi chú hoàn thành")} name="completion_note" rules={[{ required: true, message: "Vui lòng nhập ghi chú" }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Người thực hiện" name="performed_by">
            <Input prefix={<User size={15} strokeWidth={SW} />} />
          </Form.Item>
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
    </PageContainer>
  );
}
