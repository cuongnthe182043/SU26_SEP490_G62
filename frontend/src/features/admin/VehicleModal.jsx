import React, { useEffect, useState } from "react";
import { Alert, Form, Input, InputNumber, Modal, Select, Typography, message } from "antd";
import { Calendar, CarFront, Check, Factory, Hash, Layers, User, Weight, X } from "lucide-react";
import { fetchDriverOptions } from "./vehicleManagementApi";

const { Text } = Typography;
const SW = 1.75;

export default function VehicleModal({ open, onClose, onSubmit, editingVehicle, vehicleGroups }) {
  const [form] = Form.useForm();
  const [driverOptions, setDriverOptions] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  useEffect(() => {
    if (!open) return;
    const loadDrivers = async () => {
      try {
        setLoadingDrivers(true);
        const data = await fetchDriverOptions(editingVehicle?.id);
        setDriverOptions(data.drivers || []);
      } catch (err) {
        message.error(err.message);
      } finally {
        setLoadingDrivers(false);
      }
    };
    loadDrivers();
  }, [editingVehicle?.id, open]);

  useEffect(() => {
    if (!open) return;
    if (editingVehicle) {
      form.setFieldsValue({
        plate_number:       editingVehicle.plate_number,
        vehicle_group_id:   editingVehicle.vehicle_group_id,
        brand:              editingVehicle.brand              || "",
        model:              editingVehicle.model              || "",
        load_capacity_kg:   editingVehicle.load_capacity_kg   ? Number(editingVehicle.load_capacity_kg) : null,
        manufacture_year:   editingVehicle.manufacture_year   || null,
        purchase_date:      editingVehicle.purchase_date      || null,
        assigned_driver_id: editingVehicle.assigned_driver_id || null,
      });
    } else {
      form.resetFields();
    }
  }, [editingVehicle, form, open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      open={open}
      title={
        <div style={{ paddingBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: '#0B1C30' }}>
            <CarFront size={18} strokeWidth={SW} />
            {editingVehicle ? 'Chỉnh sửa xe' : 'Thêm xe mới'}
          </div>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {editingVehicle
              ? `Cập nhật thông tin xe ${editingVehicle.plate_number}`
              : 'Thêm xe vào đội xe của hệ thống'}
          </Text>
        </div>
      }
      onCancel={onClose}
      onOk={handleOk}
      okText={editingVehicle ? 'Lưu thay đổi' : 'Thêm xe'}
      cancelText="Hủy"
      okButtonProps={{ icon: <Check size={15} strokeWidth={SW} />, style: { borderRadius: 8 } }}
      cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} />, style: { borderRadius: 8 } }}
      width={680}
      destroyOnClose
      styles={{ body: { paddingTop: 20 } }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {editingVehicle && (
          <Alert
            type="info"
            showIcon
            message="Trạng thái xe được quản lý qua nút thao tác trên bảng danh sách."
            style={{ marginBottom: 20, borderRadius: 8 }}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Form.Item
            label="Biển số xe"
            name="plate_number"
            rules={[{ required: true, message: "Vui lòng nhập biển số xe" }]}
          >
            <Input prefix={<Hash size={15} strokeWidth={SW} />} placeholder="VD: 51H-12345" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            label="Nhóm xe"
            name="vehicle_group_id"
            rules={[{ required: true, message: "Vui lòng chọn nhóm xe" }]}
          >
            <Select
              prefix={<Layers size={15} strokeWidth={SW} />}
              placeholder="Chọn nhóm xe"
              style={{ borderRadius: 8 }}
              options={vehicleGroups.map(g => ({ label: `${g.name} (#${g.id})`, value: g.id }))}
            />
          </Form.Item>

          <Form.Item label="Hãng xe" name="brand">
            <Input prefix={<Factory size={15} strokeWidth={SW} />} placeholder="VD: Hyundai" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item label="Dòng xe" name="model">
            <Input prefix={<CarFront size={15} strokeWidth={SW} />} placeholder="VD: Porter" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            label="Tải trọng (kg)"
            name="load_capacity_kg"
            rules={[{ type: "number", min: 0.01, message: "Tải trọng phải lớn hơn 0" }]}
          >
            <InputNumber
              prefix={<Weight size={15} strokeWidth={SW} />}
              style={{ width: "100%", borderRadius: 8 }}
              min={0.01}
              precision={2}
              placeholder="VD: 1250"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="Năm sản xuất"
            name="manufacture_year"
            rules={[{
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                if (value > new Date().getFullYear())
                  return Promise.reject(new Error("Năm không thể lớn hơn năm hiện tại"));
                return Promise.resolve();
              },
            }]}
          >
            <InputNumber
              prefix={<Factory size={15} strokeWidth={SW} />}
              style={{ width: "100%", borderRadius: 8 }}
              min={1900}
              precision={0}
              placeholder="VD: 2020"
            />
          </Form.Item>

          <Form.Item label="Ngày mua" name="purchase_date">
            <Input type="date" prefix={<Calendar size={15} strokeWidth={SW} />} style={{ borderRadius: 8 }} />
          </Form.Item>
        </div>

        <Form.Item label="Tài xế phụ trách" name="assigned_driver_id">
          <Select
            allowClear
            loading={loadingDrivers}
            prefix={<User size={15} strokeWidth={SW} />}
            placeholder="Chọn tài xế (tuỳ chọn)"
            style={{ borderRadius: 8 }}
            options={driverOptions.map(d => ({
              label: `${d.full_name} — ${d.email}${d.current_vehicle_plate ? ` (${d.current_vehicle_plate})` : ''}`,
              value: d.id,
              disabled: !d.is_assignable,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
