import React, { useState } from 'react';
import {
    SafeAreaView,
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';

export default function DriverLogin({ onLoginSuccess }) {
    const [email, setEmail] = useState('driver@example.com');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Lỗi', 'Vui lòng nhập email và mật khẩu');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('http://192.168.1.100:9999/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Đăng nhập thất bại');
            }

            const data = await response.json();
            if (data.user.role !== 'driver') {
                throw new Error('Tài khoản này không phải tài xế');
            }

            Alert.alert('Thành công', `Xin chào ${data.user.full_name}!`);
            if (onLoginSuccess) onLoginSuccess(data.user);
        } catch (err) {
            Alert.alert('Lỗi', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>Đăng Nhập Tài Xế</Text>
                    <Text style={styles.subtitle}>Vui lòng nhập thông tin của bạn</Text>

                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#A0AEC0"
                            value={email}
                            onChangeText={setEmail}
                            editable={!loading}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Mật khẩu"
                            placeholderTextColor="#A0AEC0"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            editable={!loading}
                        />

                        <TouchableOpacity
                            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.loginBtnText}>Đăng Nhập</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>Tài Khoản Demo:</Text>
                        <Text style={styles.infoText}>Email: driver@example.com</Text>
                        <Text style={styles.infoText}>Mật khẩu: (từ admin)</Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    keyboardAvoid: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#6366F1',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#718096',
        marginBottom: 30,
        textAlign: 'center',
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    input: {
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 16,
        color: '#2D3748',
    },
    loginBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 8,
        paddingVertical: 14,
        marginTop: 10,
        alignItems: 'center',
    },
    loginBtnDisabled: {
        opacity: 0.6,
    },
    loginBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    infoBox: {
        backgroundColor: '#E0E7FF',
        borderRadius: 8,
        padding: 16,
        marginTop: 30,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6366F1',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: '#2D3748',
        marginBottom: 4,
    },
});
