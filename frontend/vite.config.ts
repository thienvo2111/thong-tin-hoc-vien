import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Thay thẻ meta tĩnh trong index.html lúc build từ src/content/gioiThieu.ts
// (Zalo/Facebook không chạy JS khi tạo bản xem trước — xem dac-ta-cong-hoc-vien.md § M0 "Chia sẻ & quảng bá")
function metaTuNoiDung() {
  return {
    name: 'meta-tu-noi-dung',
    transformIndexHtml(html: string) {
      const src = readFileSync(fileURLToPath(new URL('./src/content/gioiThieu.ts', import.meta.url)), 'utf-8');
      const get = (re: RegExp) => re.exec(src)?.[1] ?? '';
      const tieuDe = get(/tieuDe:\s*'([^']*)'/);
      const moTa = get(/moTa:\s*'([^']*)'/);
      const anh = get(/anhChiaSe:\s*'([^']*)'/);
      const baseUrl = process.env.VITE_SITE_URL ?? '';
      return html
        .replace(/__TIEU_DE__/g, tieuDe)
        .replace(/__MO_TA__/g, moTa)
        .replace(/__ANH_CHIA_SE__/g, anh.startsWith('http') ? anh : `${baseUrl}${anh}`)
        .replace(/__SITE_URL__/g, baseUrl);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), metaTuNoiDung(), mode === 'analyze' && visualizer({ open: true, gzipSize: true, filename: 'dist/bundle-stats.html' })].filter(
    Boolean,
  ),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2018',
    sourcemap: mode === 'analyze',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    globals: true,
    // Test thao tác form bằng user-event mất 2–3 giây khi chạy riêng; chạy cả suite song song trên máy
    // 4 nhân thì vượt ngưỡng 5 giây mặc định.
    testTimeout: 15000,
  },
}));
