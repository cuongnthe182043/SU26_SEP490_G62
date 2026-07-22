const { getDefaultConfig } = require('expo/metro-config');

// Đã BỎ `withTamagui` (bộ biên dịch Tamagui): nó nạp @tamagui/core + tamagui.config.ts
// qua esbuild-register, vốn lỗi "Unexpected token '{'" trên Node 24. Bỏ đi thì Tamagui
// chạy thuần runtime — giao diện y hệt, chỉ mất tối ưu compile-time (không đáng kể).
// Muốn bật lại tối ưu (khi chạy Node 20 LTS), khôi phục:
//   const { withTamagui } = require('@tamagui/metro-plugin');
//   module.exports = withTamagui(config, { components: ['tamagui'], config: './tamagui.config.ts' });
const config = getDefaultConfig(__dirname);

module.exports = config;
