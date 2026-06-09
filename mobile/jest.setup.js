// Mock các native module không chạy được trong Jest (không có native runtime)

jest.mock('expo-secure-store', () => ({
    getItemAsync:    jest.fn(),
    setItemAsync:    jest.fn(),
    deleteItemAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
    router:                 { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams:   jest.fn(() => ({})),
    useRouter:              jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
    Link:                   ({ children }) => children,
}));

jest.mock('expo-constants', () => ({
    default: { expoConfig: { extra: {} } },
}));

jest.mock('expo-camera', () => ({
    CameraView:          'CameraView',
    useCameraPermissions: jest.fn(() => [{ granted: false }, jest.fn()]),
}));

jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
    launchCameraAsync:       jest.fn(),
    MediaTypeOptions:        { Images: 'Images' },
}));

jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(() => ({ status: 'granted' })),
    getCurrentPositionAsync:           jest.fn(() => ({ coords: { latitude: 0, longitude: 0 } })),
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
    SafeAreaProvider:  ({ children }) => children,
    SafeAreaView:      ({ children }) => children,
}));

// Silence React warnings trong test output
console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
    process.stderr.write(args.join(' ') + '\n');
};
