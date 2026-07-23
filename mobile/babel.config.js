module.exports = function (api) {
  api.cache(true);

  // Đã BỎ '@tamagui/babel-plugin': plugin này nạp @tamagui/core + tamagui.config.ts
  // qua esbuild-register → lỗi "Unexpected token '{'" trên Node 24. Bỏ đi thì Tamagui
  // chạy thuần runtime (giao diện y hệt, chỉ mất tối ưu compile-time). babel-preset-expo
  // vẫn tự lo reanimated & các default của Expo. Muốn bật lại (khi dùng Node 20 LTS),
  // thêm lại plugin ['@tamagui/babel-plugin', { components: ['tamagui'], config: './tamagui.config.ts', disableExtraction: true }].
  return {
    presets: ['babel-preset-expo'],
  };
};
