import React, { useState } from 'react';
import { Layout, Menu, Typography, Dropdown, Space, Avatar } from 'antd';
import { UserOutlined, SettingOutlined, LogoutOutlined, DashboardOutlined } from '@ant-design/icons';
import UserList from '../../features/admin/UserList';
import '../../styles/admin/Admin.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function AdminPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('users');
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Tổng quan',
      disabled: true,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: 'Người dùng',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt',
      disabled: true,
    },
  ];

  const userMenu = {
    items: [
      {
        key: '1',
        label: <Text strong>{user?.full_name || user?.email}</Text>,
        disabled: true,
      },
      { type: 'divider' },
      {
        key: '2',
        icon: <LogoutOutlined />,
        label: 'Đăng xuất',
        onClick: handleLogout,
        danger: true,
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        theme="dark"
        width={250}
        style={{
          boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)',
        }}
      >
        <div style={{ height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 0' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            {collapsed ? 'G62' : 'Admin Panel'}
          </Title>
        </div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={[activeTab]}
          onClick={(e) => setActiveTab(e.key)}
          items={menuItems}
        />
      </Sider>
      
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,21,41,.08)' }}>
          <Title level={4} style={{ margin: 0 }}>
            {activeTab === 'users' ? 'Quản lý Người dùng' : 'Trang chủ'}
          </Title>
          
          <Dropdown menu={userMenu} placement="bottomRight" arrow>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
              <Text strong>{user?.full_name || 'Admin'}</Text>
            </Space>
          </Dropdown>
        </Header>
        
        <Content style={{ margin: '24px 16px', padding: 0, minHeight: 280 }}>
          {activeTab === 'users' && <UserList />}
        </Content>
      </Layout>
    </Layout>
  );
}
