import React, { useEffect, useState } from "react";
import {
  Button,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CarOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import VehicleModal from "./VehicleModal";
import {
  assignVehicleDriver,
  changeVehicleStatus,
  createVehicle,
  fetchVehicleDetail,
  fetchVehicles,
  softDeleteVehicle,
  updateVehicle,
} from "./vehicleManagementApi";

const { Text, Title } = Typography;

const statusColorMap = {
  available: "green",
  in_delivery: "blue",
  maintenance: "orange",
  inactive: "default",
};

const statusOptions = [
  { label: "All Statuses", value: "" },
  { label: "Available", value: "available" },
  { label: "In Delivery", value: "in_delivery" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Inactive", value: "inactive" },
];

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
        page,
        limit,
        search: searchValue,
        status: statusValue,
        vehicle_group_id: groupValue,
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
    loadVehicles({ page: 1 });
  }, []);

  const handleTableChange = (nextPagination) => {
    loadVehicles({
      page: nextPagination.current,
      limit: nextPagination.pageSize,
    });
  };

  const handleFilterSubmit = () => {
    loadVehicles({ page: 1, searchValue: search, statusValue: statusFilter, groupValue: groupFilter });
  };

  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (vehicle) => {
    setEditingVehicle(vehicle);
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, values);
        message.success("Vehicle updated");
      } else {
        await createVehicle(values);
        message.success("Vehicle created");
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

  const handleStatusChange = (vehicle, status) => {
    Modal.confirm({
      title: `Change status of ${vehicle.plate_number}?`,
      content: `Set vehicle status to ${status}.`,
      onOk: async () => {
        try {
          await changeVehicleStatus(vehicle.id, status);
          message.success("Vehicle status updated");
          await loadVehicles();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const handleDriverToggle = (vehicle) => {
    if (vehicle.assigned_driver_id) {
      Modal.confirm({
        title: `Unassign driver from ${vehicle.plate_number}?`,
        onOk: async () => {
          try {
            await assignVehicleDriver(vehicle.id, null);
            message.success("Driver unassigned");
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

  const handleSoftDelete = (vehicle) => {
    Modal.confirm({
      title: `Mark ${vehicle.plate_number} as inactive?`,
      content: "This is a soft delete and keeps the record in the system.",
      okType: "danger",
      onOk: async () => {
        try {
          await softDeleteVehicle(vehicle.id);
          message.success("Vehicle marked inactive");
          await loadVehicles();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: "Plate",
      dataIndex: "plate_number",
      key: "plate_number",
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: "Group",
      key: "vehicle_group",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.vehicle_group_name}</Text>
          <Text type="secondary">#{record.vehicle_group_id}</Text>
        </Space>
      ),
    },
    {
      title: "Vehicle",
      key: "vehicle",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{[record.brand, record.model].filter(Boolean).join(" ") || "Not set"}</Text>
          <Text type="secondary">
            {record.load_capacity_kg ? `${record.load_capacity_kg} kg` : "No capacity"}{record.manufacture_year ? ` • ${record.manufacture_year}` : ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "Assigned Driver",
      key: "assigned_driver",
      render: (_, record) =>
        record.assigned_driver_id ? (
          <Space direction="vertical" size={0}>
            <Text>{record.assigned_driver_name}</Text>
            <Text type="secondary">{record.assigned_driver_email}</Text>
          </Space>
        ) : (
          <Text type="secondary">Unassigned</Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={statusColorMap[status] || "default"}>{status}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => openDetail(record)}>
            Details
          </Button>
          <Button icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            Edit
          </Button>
          <Button icon={<UserSwitchOutlined />} onClick={() => handleDriverToggle(record)}>
            {record.assigned_driver_id ? "Unassign" : "Assign"}
          </Button>
          <Select
            size="small"
            value={record.status}
            style={{ width: 140 }}
            onChange={(value) => handleStatusChange(record, value)}
            options={statusOptions.slice(1)}
          />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleSoftDelete(record)}>
            Inactivate
          </Button>
        </Space>
      ),
    },
  ];

  return (
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

      <VehicleModal
        open={modalOpen}
        editingVehicle={editingVehicle}
        vehicleGroups={vehicleGroups}
        onClose={() => {
          setModalOpen(false);
          setEditingVehicle(null);
        }}
        onSubmit={handleSubmit}
      />

      <Modal
        open={Boolean(detailVehicle)}
        title={detailVehicle ? `Vehicle: ${detailVehicle.plate_number}` : "Vehicle Details"}
        onCancel={() => setDetailVehicle(null)}
        footer={null}
        width={760}
      >
        {detailVehicle ? (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="ID">{detailVehicle.id}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColorMap[detailVehicle.status] || "default"}>{detailVehicle.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Vehicle Group">{detailVehicle.vehicle_group_name}</Descriptions.Item>
            <Descriptions.Item label="Price Per Km">{Number(detailVehicle.price_per_km).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Brand">{detailVehicle.brand || "Not set"}</Descriptions.Item>
            <Descriptions.Item label="Model">{detailVehicle.model || "Not set"}</Descriptions.Item>
            <Descriptions.Item label="Load Capacity">
              {detailVehicle.load_capacity_kg ? `${detailVehicle.load_capacity_kg} kg` : "Not set"}
            </Descriptions.Item>
            <Descriptions.Item label="Manufacture Year">{detailVehicle.manufacture_year || "Not set"}</Descriptions.Item>
            <Descriptions.Item label="Purchase Date">{detailVehicle.purchase_date || "Not set"}</Descriptions.Item>
            <Descriptions.Item label="Upgrade Allowed">{detailVehicle.upgrade_allowed ? "Yes" : "No"}</Descriptions.Item>
            <Descriptions.Item label="Assigned Driver">
              {detailVehicle.assigned_driver_name
                ? `${detailVehicle.assigned_driver_name} (${detailVehicle.assigned_driver_email})`
                : "Unassigned"}
            </Descriptions.Item>
            <Descriptions.Item label="Driver License">
              {detailVehicle.assigned_driver_license_number || "Not set"}
            </Descriptions.Item>
            <Descriptions.Item label="Created At">{detailVehicle.created_at}</Descriptions.Item>
            <Descriptions.Item label="Updated At">{detailVehicle.updated_at}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
