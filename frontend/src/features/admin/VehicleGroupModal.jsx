import React, { useEffect } from "react";
import { Form, Input, InputNumber, Modal, Typography } from "antd";
import { Check, Coins, FileText, Tag as TagIcon, TrendingDown, Weight, X } from "lucide-react";

const { Text } = Typography;
const SW = 1.75;

export default function VehicleGroupModal({ open, onClose, onSubmit, editingGroup }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    if (editingGroup) {
      form.setFieldsValue({
        name:                editingGroup.name,
        description:         editingGroup.description || "",
        max_load_weight_kg:  editingGroup.max_load_weight_kg ? Number(editingGroup.max_load_weight_kg) : null,
        price_per_km:        Number(editingGroup.price_per_km),
        depreciation_per_km: Number(editingGroup.depreciation_per_km || 0),
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ depreciation_per_km: 0 });
    }
  }, [editingGroup, form, open]);

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
            <TagIcon size={18} strokeWidth={SW} />
            {editingGroup ? 'Chỉnh sửa nhóm xe' : 'Thêm nhóm xe mới'}
          </div>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {editingGroup
              ? `Cập nhật thông tin nhóm "${editingGroup.name}"`
              : 'Cấu hình nhóm xe theo tải trọng và giá cước'}
          </Text>
        </div>
      }
      onCancel={onClose}
      onOk={handleOk}
      okText={editingGroup ? 'Lưu thay đổi' : 'Tạo nhóm xe'}
      cancelText="Hủy"
      okButtonProps={{ icon: <Check size={15} strokeWidth={SW} />, style: { borderRadius: 8 } }}
      cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} />, style: { borderRadius: 8 } }}
      width={520}
      destroyOnClose
      styles={{ body: { paddingTop: 20 } }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label="Tên nhóm xe"
          name="name"
          rules={[{ required: true, message: "Vui lòng nhập tên nhóm xe" }]}
        >
          <Input prefix={<TagIcon size={15} strokeWidth={SW} />} placeholder="VD: 1T25, 5m2, 8m2..." style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item label={<span><FileText size={13} strokeWidth={SW} style={{ verticalAlign: -2, marginRight: 6 }} />Mô tả</span>} name="description">
          <Input.TextArea
            rows={3}
            placeholder="Mô tả đặc điểm của nhóm xe này..."
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Form.Item
            label="Tải trọng tối đa (kg)"
            name="max_load_weight_kg"
            rules={[{ type: "number", min: 0.01, message: "Phải lớn hơn 0" }]}
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
            label="Giá / km (đ)"
            name="price_per_km"
            rules={[{ required: true, message: "Vui lòng nhập giá/km" }]}
          >
            <InputNumber
              prefix={<Coins size={15} strokeWidth={SW} />}
              style={{ width: "100%", borderRadius: 8 }}
              min={0}
              precision={0}
              placeholder="VD: 15000"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="Khấu hao / km (đ)"
            name="depreciation_per_km"
            rules={[{ required: true, message: "Vui lòng nhập khấu hao/km" }]}
          >
            <InputNumber
              prefix={<TrendingDown size={15} strokeWidth={SW} />}
              style={{ width: "100%", borderRadius: 8 }}
              min={0}
              precision={0}
              placeholder="VD: 3000"
              formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
