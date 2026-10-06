import * as fs from 'fs';
import * as path from 'path';

// Nginx trên VPS (scripts/vps/05-install-nginx.sh) chỉ chuyển về backend các
// tiền tố liệt kê sẵn; tiền tố thiếu bị trả index.html (SPA) và API hỏng âm
// thầm trên production — đã xảy ra với /ho-tro (2026-10-06, ADR 0003). Tiền tố
// API cũng KHÔNG được trùng route trang của frontend: thêm nó vào Nginx thì
// F5 trang đó sẽ rơi vào backend. Test này bắt cả 2 lỗi trước khi deploy.
const GOC = path.resolve(__dirname, '../..');

function tienToController(): string[] {
  const ketQua = new Set<string>();
  const duyet = (dir: string) => {
    for (const ten of fs.readdirSync(dir)) {
      const p = path.join(dir, ten);
      if (fs.statSync(p).isDirectory()) duyet(p);
      else if (ten.endsWith('.controller.ts')) {
        const m = fs.readFileSync(p, 'utf8').match(/@Controller\('([^'/]+)/);
        if (m) ketQua.add(m[1]);
      }
    }
  };
  duyet(path.join(GOC, 'backend/src'));
  return [...ketQua].sort();
}

function tienToNginx(): string[] {
  const conf = fs.readFileSync(
    path.join(GOC, 'scripts/vps/05-install-nginx.sh'),
    'utf8',
  );
  const m = conf.match(/location ~ \^\/\(([^)]+)\)/);
  if (!m)
    throw new Error(
      'Không tìm thấy location proxy backend trong 05-install-nginx.sh',
    );
  return m[1].split('|');
}

function routeTrangFrontend(): string[] {
  const router = fs.readFileSync(
    path.join(GOC, 'frontend/src/router.tsx'),
    'utf8',
  );
  return [...router.matchAll(/path: '\/([^/']+)/g)].map((m) => m[1]);
}

describe('Nginx proxy đủ tiền tố controller backend', () => {
  it('mọi tiền tố @Controller đều có trong location proxy của 05-install-nginx.sh', () => {
    const nginx = new Set(tienToNginx());
    expect(tienToController().filter((p) => !nginx.has(p))).toEqual([]);
  });

  it('không tiền tố API nào trùng route trang frontend (vd. /ho-tro)', () => {
    const trang = new Set(routeTrangFrontend());
    expect(trang.size).toBeGreaterThan(0);
    expect(tienToController().filter((p) => trang.has(p))).toEqual([]);
  });
});
