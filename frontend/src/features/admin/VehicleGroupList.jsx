import React, { useEffect, useState } from "react";
import {
  Button, Descriptions, Dropdown, Input, Modal,
  Space, Table, Tag, Typography, message,
} from "antd";
import { Eye, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";

const SW = 1.75;
import VehicleGroupModal from "./VehicleGroupModal";
import PageContainer, { CardSection } from "../../components/common/PageContainer";
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
        message.success("Cập nhật nhóm xe thành công");
      } else {
        await createVehicleGroup(values);
        message.success("Tạo nhóm xe thành công");
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
      title: `Xóa nhóm xe "${group.name}"?`,
      content: "Chỉ xóa được khi không có xe nào đang sử dụng nhóm này.",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await deleteVehicleGroup(group.id);
          message.success("Xóa nhóm xe thành công");
          await loadVehicleGroups();
        } catch (err) {
          message.error(err.message);
        }
      },
    });
  };

  const buildMoreMenu = (record) => ({
    items: [
      {
        key: 'delete',
        icon: <Trash2 size={14} strokeWidth={SW} />,
        label: 'Xóa nhóm xe',
        danger: true,
        onClick: () => handleDelete(record),
      },
    ],
  });

  const columns = [
    {
      title: "Tên nhóm",
      dataIndex: "name",
      key: "name",
      render: (value) => <Text strong>{value}</Text>,
    },
    {
      title: "Mô tả",
      dataIndex: "description",
      key: "description",
      render: (value) => value || <Text type="secondary">Chưa có mô tả</Text>,
    },
    {
      title: "Tải trọng tối đa",
      dataIndex: "max_load_weight_kg",
      key: "max_load_weight_kg",
      render: (value) =>
        value ? `${Number(value).toLocaleString()} kg` : <Text type="secondary">Chưa thiết lập</Text>,
    },
    {
      title: "Giá / km",
      dataIndex: "price_per_km",
      key: "price_per_km",
      render: (value) => `${Number(value).toLocaleString()} đ/km`,
    },
    {
      title: "Số lượng xe",
      key: "vehicle_count",
      render: (_, record) => (
        <Space size={4} wrap>
          <Tag color="blue">{record.vehicle_count} tổng</Tag>
          <Tag color="green">{record.active_vehicle_count} hoạt động</Tag>
          <Tag color="orange">{record.maintenance_vehicle_count} bảo dưỡng</Tag>
          <Tag color="red">{record.broken_vehicle_count} hỏng</Tag>
          {record.retired_vehicle_count > 0 && (
            <Tag>{record.retired_vehicle_count} nghỉ</Tag>
          )}
        </Space>
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
            onClick={() => handleOpenDetail(record)}
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
            <Title level={4} style={{ margin: 0 }}>Danh sách nhóm xe</Title>
            <Text type="secondary">{filteredGroups.length} nhóm xe</Text>
          </div>
          <Button type="primary" icon={<Plus size={15} strokeWidth={SW} />} onClick={handleOpenCreate}>
            Thêm nhóm xe
          </Button>
        </div>
        <Input
          allowClear
          prefix={<Search size={15} strokeWidth={SW} />}
          placeholder="Tìm kiếm theo ID, tên, mô tả..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </CardSection>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filteredGroups}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} nhóm`,
          style: { padding: '12px 24px' },
        }}
        scroll={{ x: 'max-content' }}
      />

      <VehicleGroupModal
        open={modalOpen}
        editingGroup={editingGroup}
        onClose={() => { setModalOpen(false); setEditingGroup(null); }}
        onSubmit={handleSubmit}
      />

      <Modal
        open={Boolean(detailGroup)}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Eye size={18} strokeWidth={SW} />
            {detailGroup ? `Chi tiết nhóm xe: ${detailGroup.name}` : "Chi tiết nhóm xe"}
          </span>
        }
        onCancel={() => setDetailGroup(null)}
        footer={null}
        confirmLoading={detailLoading}
      >
        {detailGroup && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="ID">{detailGroup.id}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">
              {detailGroup.description || "Chưa có mô tả"}
            </Descriptions.Item>
            <Descriptions.Item label="Tải trọng tối đa">
              {detailGroup.max_load_weight_kg
                ? `${Number(detailGroup.max_load_weight_kg).toLocaleString()} kg`
                : "Chưa thiết lập"}
            </Descriptions.Item>
            <Descriptions.Item label="Giá / km">
              {Number(detailGroup.price_per_km).toLocaleString()} đ
            </Descriptions.Item>
            <Descriptions.Item label="Khấu hao / km">
              {Number(detailGroup.depreciation_per_km).toLocaleString()} đ
            </Descriptions.Item>
            <Descriptions.Item label="Tổng quan xe">
              {detailGroup.vehicle_count} tổng &bull; {detailGroup.active_vehicle_count} hoạt động &bull;{" "}
              {detailGroup.maintenance_vehicle_count} bảo dưỡng &bull; {detailGroup.broken_vehicle_count} hỏng &bull;{" "}
              {detailGroup.retired_vehicle_count} nghỉ
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </PageContainer>
  );
}
