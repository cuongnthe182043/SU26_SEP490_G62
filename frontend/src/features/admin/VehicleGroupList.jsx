import React, { useEffect, useState } from "react";
import { Button, Descriptions, Dropdown, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, EllipsisOutlined, EyeOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import VehicleGroupModal from "./VehicleGroupModal";
import {
  createVehicleGroup,
  deleteVehicleGroup,
  fetchVehicleGroupDetail,
  fetchVehicleGroups,
  updateVehicleGroup,
} from "./vehicleManagementApi";

const { Text, Title } = Typography;

export default function VehicleGroupList() {
  const [vehicleGroups, setVehicleGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [detailGroup, setDetailGroup] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadVehicleGroups = async () => {
    try {
      setLoading(true);
      const data = await fetchVehicleGroups();
      setVehicleGroups(data.vehicleGroups || []);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicleGroups();
  }, []);

  const filteredGroups = vehicleGroups.filter((group) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      String(group.id).includes(query) ||
      String(group.name || "").toLowerCase().includes(query) ||
      String(group.description || "").toLowerCase().includes(query)
    );
  });

  const handleOpenCreate = () => {
    setEditingGroup(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (group) => {
    setEditingGroup(group);
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      if (editingGroup) {
        await updateVehicleGroup(editingGroup.id, values);
        message.success("Vehicle group updated");
      } else {
        await createVehicleGroup(values);
        message.success("Vehicle group created");
      }

      setModalOpen(false);
      setEditingGroup(null);
      await loadVehicleGroups();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleOpenDetail = async (group) => {
    try {
      setDetailLoading(true);
      const data = await fetchVehicleGroupDetail(group.id);
      setDetailGroup(data.vehicleGroup);
    } catch (err) {
      message.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = (group) => {
    Modal.confirm({
      title: `Delete vehicle group ${group.name}?`,
      content: "This only works when no vehicle is using the group.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await deleteVehicleGroup(group.id);
          message.success("Vehicle group deleted");
          await loadVehicleGroups();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (value) => value || <Text type="secondary">No description</Text>,
    },
    {
      title: "Capacity",
      dataIndex: "max_load_weight_kg",
      key: "max_load_weight_kg",
      render: (value) => (value ? `${value} kg` : <Text type="secondary">Not set</Text>),
    },
    {
      title: "Rate",
      dataIndex: "price_per_km",
      key: "price_per_km",
      render: (value) => `${Number(value).toLocaleString()} / km`,
    },
    {
      title: "Vehicles",
      dataIndex: "vehicle_count",
      key: "vehicle_count",
      render: (_, record) => (
        <Space wrap>
          <Tag color="blue">{record.vehicle_count} total</Tag>
          <Tag color="green">{record.active_vehicle_count} active</Tag>
          <Tag color="orange">{record.maintenance_vehicle_count} maintenance</Tag>
          <Tag color="red">{record.broken_vehicle_count} broken</Tag>
          <Tag>{record.retired_vehicle_count} retired</Tag>
        </Space>
      ),
    },
    {
      title: "Upgrade",
      dataIndex: "upgrade_allowed",
      key: "upgrade_allowed",
      render: (value) => <Tag color={value ? "gold" : "default"}>{value ? "Allowed" : "No"}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, record) => {
        const items = [
          {
            key: "details",
            icon: <EyeOutlined />,
            label: "Details",
            onClick: () => handleOpenDetail(record),
          },
          {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit",
            onClick: () => handleOpenEdit(record),
          },
          {
            key: "delete",
            icon: <DeleteOutlined />,
            label: "Delete",
            danger: true,
            onClick: () => handleDelete(record),
          },
        ];

        return (
          <Dropdown menu={{ items }} trigger={["click"]}>
            <Button icon={<EllipsisOutlined />} aria-label={`Actions for vehicle group ${record.name}`} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Vehicle Groups
          </Title>
          <Text type="secondary">{filteredGroups.length} groups</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          Add Vehicle Group
        </Button>
      </div>

      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        placeholder="Search by id, name, description"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{ marginBottom: 16 }}
      />

      <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredGroups} pagination={{ pageSize: 10 }} />

      <VehicleGroupModal
        open={modalOpen}
        editingGroup={editingGroup}
        onClose={() => {
          setModalOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleSubmit}
      />

      <Modal
        open={Boolean(detailGroup)}
        title={detailGroup ? `Vehicle Group: ${detailGroup.name}` : "Vehicle Group Details"}
        onCancel={() => setDetailGroup(null)}
        footer={null}
        confirmLoading={detailLoading}
      >
        {detailGroup ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">{detailGroup.id}</Descriptions.Item>
            <Descriptions.Item label="Description">{detailGroup.description || "No description"}</Descriptions.Item>
            <Descriptions.Item label="Max Load Weight">
              {detailGroup.max_load_weight_kg ? `${detailGroup.max_load_weight_kg} kg` : "Not set"}
            </Descriptions.Item>
            <Descriptions.Item label="Price Per Km">
              {Number(detailGroup.price_per_km).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Depreciation Per Km">
              {Number(detailGroup.depreciation_per_km).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Upgrade Allowed">{detailGroup.upgrade_allowed ? "Yes" : "No"}</Descriptions.Item>
            <Descriptions.Item label="Vehicle Summary">
              {detailGroup.vehicle_count} total, {detailGroup.active_vehicle_count} active,{" "}
              {detailGroup.maintenance_vehicle_count} maintenance, {detailGroup.broken_vehicle_count} broken,{" "}
              {detailGroup.retired_vehicle_count} retired
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
