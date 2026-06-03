import React, { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import '../../styles/admin/UserModal.css';

export default function UserModal({ isOpen, onClose, onSave, editingUser }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        form.setFieldsValue({
          email: editingUser.email || '',
          password: '',
          full_name: editingUser.full_name || '',
          phone: editingUser.phone || '',
          role: editingUser.role || 'driver'
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ role: 'driver' });
      }
    }
  }, [editingUser, isOpen, form]);

  const handleOk = () => {
    form.validateFields().then(values => {
      onSave(values);
    }).catch(info => {
      console.log('Validate Failed:', info);
    });
  };

  return (
    <Modal
      title={editingUser ? 'Sửa thông tin người dùng' : 'Thêm người dùng mới'}
      open={isOpen}
      onOk={handleOk}
      onCancel={onClose}
      okText="Lưu lại"
      cancelText="Hủy"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        name="userForm"
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: 'Vui lòng nhập email!' },
            { type: 'email', message: 'Email không hợp lệ!' }
          ]}
        >
          <Input disabled={!!editingUser} placeholder="Nhập địa chỉ email" />
        </Form.Item>

        <Form.Item
          name="full_name"
          label="Họ và Tên"
          rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
        >
          <Input placeholder="Nhập họ và tên" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[
            { required: true, message: 'Vui lòng nhập số điện thoại!' },
            { pattern: /^(0[3|5|7|8|9])+([0-9]{8})\b/, message: 'Số điện thoại không hợp lệ (phải bắt đầu bằng 03, 05, 07, 08, 09 và có 10 chữ số)!' }
          ]}
        >
          <Input placeholder="Nhập số điện thoại" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Vai trò"
          rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
        >
          <Select placeholder="Chọn vai trò">
            <Select.Option value="coordinator">Coordinator (Điều phối)</Select.Option>
            <Select.Option value="accountant">Accountant (Kế toán)</Select.Option>
            <Select.Option value="driver">Driver (Tài xế)</Select.Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
}
