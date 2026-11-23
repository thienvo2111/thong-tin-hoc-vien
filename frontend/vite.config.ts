import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Thay thẻ meta tĩnh trong index.html lúc build từ src/content/gioiThieu.ts
// (Zalo/Facebook không chạy JS khi tạo bản xem trước — xem dac-ta-cong-hoc-vien.md § M0 "Chia sẻ & quảng bá").
// Issue #55: cong-don-vi.html (entry của Cổng đơn vị) lấy tiêu đề/mô tả từ src/content/congDonVi.ts, dùng chung ảnh chia sẻ.
function docNoiDung(tep: string) {
  const src = readFileSync(fileURLToPath(new URL(`./src/content/${tep}`, import.meta.url)), 'utf-8');
  return (re: RegExp) => re.exec(src)?.[1] ?? '';
}

function gocCuaUrl(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function metaTuNoiDung() {
  // process.env không chứa biến trong frontend/.env — Cổng đơn vị lấy thêm từ env Vite đã nạp (cấu hình 1 chỗ trên VPS).
  let envVite: Record<string, string> = {};
  return {
    name: 'meta-tu-noi-dung',
    configResolved(config: { env: Record<string, string> }) {
      envVite = config.env;
    },
    transformIndexHtml(html: string, ctx: { path?: string; filename?: string }) {
      const getNls = docNoiDung('gioiThieu.ts');
      const anh = getNls(/anhChiaSe:\s*'([^']*)'/);
      let tieuDe = getNls(/tieuDe:\s*'([^']*)'/);
      let moTa = getNls(/moTa:\s*'([^']*)'/);
      let baseUrl = process.env.VITE_SITE_URL ?? '';
      let gocAnh = baseUrl;
      if ((ctx.filename ?? ctx.path ?? '').replace(/\\/g, '/').endsWith('/cong-don-vi.html')) {
        const getDonVi = docNoiDung('congDonVi.ts');
        tieuDe = getDonVi(/tenCong:\s*'([^']*)'/);
        moTa = getDonVi(/moTa:\s*'([^']*)'/);
        baseUrl = process.env.VITE_CONG_DON_VI_URL ?? envVite.VITE_CONG_DON_VI_URL ?? '';
        // Chế độ đường dẫn (URL dạng https://…/cdv): ảnh chia sẻ ở gốc origin, không nằm dưới /cdv.
        gocAnh = gocCuaUrl(baseUrl);
      }
      return html
        .replace(/__TIEU_DE__/g, tieuDe)
        .replace(/__MO_TA__/g, moTa)
        .replace(/__ANH_CHIA_SE__/g, anh.startsWith('http') ? anh : `${gocAnh}${anh}`)
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
    // Issue #55: 2 entry HTML cùng 1 bản build — Nginx Cổng đơn vị fallback về cong-don-vi.html.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        congDonVi: fileURLToPath(new URL('./cong-don-vi.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    globals: true,
    // Test thao tác form bằng user-event mất 2–3 giây khi chạy riêng; chạy cả suite song song trên máy
    // 4 nhân thì vượt ngưỡng 5 giây mặc định.
    testTimeout: 15000,
    // Mặc định vitest dùng (số nhân - 1) worker; trên máy 4 nhân, 3 worker jsdom tranh CPU làm test gõ form
    // chậm gấp ~3 lần và cả bộ lâu hơn. Đo 2026-10-19: 3 worker 13 phút + 1 test hết giờ, 2 worker 12 phút pass hết.
    maxWorkers: '50%',
    minWorkers: 1,
  },
}));
