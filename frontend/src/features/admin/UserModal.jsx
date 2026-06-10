import React, { useEffect } from 'react';
import { Form, Input, Modal, Select, Typography } from 'antd';
import { Check, Mail, Phone, ShieldCheck, User, X } from 'lucide-react';

const { Text } = Typography;
const SW = 1.75;

const ROLES = [
  { value: 'coordinator', label: 'Điều phối viên' },
  { value: 'accountant',  label: 'Kế toán' },
  { value: 'driver',      label: 'Tài xế' },
];

export default function UserModal({ isOpen, onClose, onSave, editingUser }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!isOpen) return;
    if (editingUser) {
      form.setFieldsValue({
        email:     editingUser.email     || '',
        full_name: editingUser.full_name || '',
        phone:     editingUser.phone     || '',
        role:      editingUser.role      || 'driver',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ role: 'driver' });
    }
  }, [editingUser, isOpen, form]);

  const handleOk = () => {
    form.validateFields()
      .then(values => onSave(values))
      .catch(() => {});
  };

  return (
    <Modal
      open={isOpen}
      title={
        <div style={{ paddingBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: '#0B1C30' }}>
            <User size={18} strokeWidth={SW} />
            {editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
          </div>
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {editingUser
              ? 'Cập nhật thông tin tài khoản'
              : 'Tạo tài khoản mới trong hệ thống'}
          </Text>
        </div>
      }
      onOk={handleOk}
      onCancel={onClose}
      okText={editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
      cancelText="Hủy"
      okButtonProps={{ icon: <Check size={15} strokeWidth={SW} />, style: { borderRadius: 8 } }}
      cancelButtonProps={{ icon: <X size={15} strokeWidth={SW} />, style: { borderRadius: 8 } }}
      width={480}
      destroyOnClose
      styles={{ body: { paddingTop: 20 } }}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Địa chỉ email không hợp lệ' },
          ]}
        >
          <Input
            disabled={!!editingUser}
            prefix={<Mail size={15} strokeWidth={SW} />}
            placeholder="example@company.com"
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="full_name"
          label="Họ và tên"
          rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
        >
          <Input prefix={<User size={15} strokeWidth={SW} />} placeholder="Nguyễn Văn A" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[
            { required: true, message: 'Vui lòng nhập số điện thoại' },
            {
              pattern: /^(0[3|5|7|8|9])+([0-9]{8})\b/,
              message: 'Số điện thoại không hợp lệ (VD: 0912345678)',
            },
          ]}
        >
          <Input prefix={<Phone size={15} strokeWidth={SW} />} placeholder="0912 345 678" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item
          name="role"
          label="Vai trò"
          rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
        >
          <Select
            prefix={<ShieldCheck size={15} strokeWidth={SW} />}
            placeholder="Chọn vai trò"
            options={ROLES}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
