import React, { useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DriverLogin from './DriverLogin';

export default function App() {
    const [driver, setDriver] = useState(null);

    const handleLoginSuccess = (driverData) => {
        setDriver(driverData);
    };

    const handleLogout = () => {
        setDriver(null);
    };

    if (!driver) {
        return <DriverLogin onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Tài Xế Dashboard</Text>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Đăng Xuất</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Thông Tin Tài Xế</Text>
                    <Text style={styles.info}>Tên: {driver.full_name}</Text>
                    <Text style={styles.info}>Email: {driver.email}</Text>
                    <Text style={styles.info}>Vai Trò: <Text style={styles.role}>{driver.role}</Text></Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Chức Năng</Text>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Text style={styles.actionText}>📍 Xem Lộ Trình</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Text style={styles.actionText}>📦 Giao Hàng</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn}>
                        <Text style={styles.actionText}>📊 Thống Kê</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        backgroundColor: '#6366F1',
        paddingHorizontal: 16,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
    },
    logoutBtn: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    logoutText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#6366F1',
        marginBottom: 12,
    },
    info: {
        fontSize: 14,
        color: '#2D3748',
        marginBottom: 8,
    },
    role: {
        backgroundColor: '#E0E7FF',
        color: '#6366F1',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        fontWeight: '600',
    },
    actionBtn: {
        backgroundColor: '#F3F4F6',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#6366F1',
    },
    actionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#2D3748',
    },
});
