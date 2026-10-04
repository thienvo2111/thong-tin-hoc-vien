// Trang khảo sát GIẢ LẬP — đóng vai hệ thống khảo sát (khaosatnls) để thử luồng SSO
// và làm CODE MẪU cho đội khảo sát (docs/api-contract.md mục 10). Không cần cài gì:
// chỉ dùng module có sẵn của Node >= 18 (http, crypto, fetch).
//
// Chạy:
//   CONG_URL=http://localhost:3000 SSO_KHAO_SAT_API_KEY=<khóa> node scripts/sso-demo/trang-khao-sat-gia-lap.mjs
// rồi đặt ở backend cổng: SSO_KHAO_SAT_URL=http://localhost:4000/sso/start (cùng SSO_KHAO_SAT_API_KEY).
//
// Việc bên khảo sát phải làm, đánh dấu [1] [2] [3] bên dưới; [4] = báo trạng thái/kết quả về cổng
// (POST /sso/ket-qua, 2026-10-04) để học viên thấy "đang làm / đã hoàn thành + mức" trên cổng.

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT || 4000);
const CONG_URL = (process.env.CONG_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_KEY = process.env.SSO_KHAO_SAT_API_KEY;
if (!API_KEY) {
  console.error('Thiếu SSO_KHAO_SAT_API_KEY (phải TRÙNG với khóa đặt ở backend cổng bồi dưỡng).');
  process.exit(1);
}

// Phiên đăng nhập của RIÊNG trang khảo sát (demo: lưu trong bộ nhớ). Thực tế: session/DB của bạn.
const phien = new Map();

const TEN_BAI = {
  'khao-sat': 'Phiếu khảo sát kĩ năng số',
  'danh-gia': 'Phiếu đánh giá năng lực số',
  'dau-ra': 'Khảo sát đầu ra',
};
const CONG_FE = CONG_URL.replace(':3000', ':5173');

function layPhien(req) {
  const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  return sid && phien.get(sid);
}

async function docForm(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return new URLSearchParams(raw);
}

// [4] Báo về cổng TỪ MÁY CHỦ (cùng X-API-Key). dang_lam: lúc bắt đầu làm; hoan_thanh: lúc nộp bài.
async function baoKetQua(duLieu) {
  const r = await fetch(`${CONG_URL}/sso/ket-qua`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(duLieu),
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

function trang(tieuDe, noiDung) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${tieuDe}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;line-height:1.5}
.the{border:1px solid #ddd;border-radius:12px;padding:16px;margin:16px 0}code{background:#f3f3f3;padding:2px 6px;border-radius:4px}
.loi{border-color:#e5a3a3;background:#fdf3f3}</style></head><body><h1>${tieuDe}</h1>${noiDung}
<p style="color:#888;font-size:13px">Trang khảo sát GIẢ LẬP — scripts/sso-demo</p></body></html>`;
}

const thoat = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function guiHtml(res, status, html, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(html);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // [1] Trang nhận chuyển hướng từ cổng: /sso/start?code=...&target=...
  if (url.pathname === '/sso/start') {
    const code = url.searchParams.get('code');
    if (!code) return guiHtml(res, 400, trang('Thiếu mã', '<p>Đường dẫn không hợp lệ.</p>'));

    // [2] Đổi mã TỪ MÁY CHỦ (không phải JavaScript trình duyệt — sẽ lộ API key).
    let r;
    try {
      r = await fetch(`${CONG_URL}/sso/doi-ma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ code }),
      });
    } catch {
      return guiHtml(res, 502, trang('Không kết nối được cổng', `<p>Không gọi được ${thoat(CONG_URL)}.</p>`));
    }
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      // SSO_MA_KHONG_HOP_LE: mã hết hạn (5 phút) / đã dùng -> mời học viên quay lại cổng bấm lại.
      const ma = body?.error?.code ?? r.status;
      return guiHtml(
        res,
        r.status === 400 ? 400 : 502,
        trang(
          'Phiên đã hết hạn',
          `<div class="the loi"><p>Không xác nhận được (<code>${thoat(ma)}</code>): ${thoat(body?.error?.message)}</p>
<p><a href="${thoat(CONG_FE)}/toi/danh-gia-dau-vao">Quay lại cổng bồi dưỡng</a> và bấm lại.</p></div>`,
        ),
      );
    }

    // [3] Tạo phiên RIÊNG của trang khảo sát, rồi chuyển sang URL sạch (bỏ code khỏi thanh địa chỉ/lịch sử).
    const sid = randomBytes(24).toString('base64url');
    phien.set(sid, body);
    return guiHtml(res, 303, '', {
      Location: '/lam-bai',
      'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Lax; Path=/`,
    });
  }

  if (url.pathname === '/lam-bai') {
    const hv = layPhien(req);
    if (!hv) return guiHtml(res, 401, trang('Chưa đăng nhập', '<p>Hãy vào từ cổng bồi dưỡng.</p>'));

    const nopBai = hv.target
      ? `<div class="the"><p><b>[4] Giả lập báo kết quả về cổng</b> (POST /sso/ket-qua)</p>
<form method="post" action="/bao-ket-qua"><input type="hidden" name="trang_thai" value="dang_lam">
<button>Bắt đầu làm (báo "đang làm")</button></form>
<form method="post" action="/bao-ket-qua" style="margin-top:12px"><input type="hidden" name="trang_thai" value="hoan_thanh">
Mức <select name="muc"><option value="co_ban">Cơ bản</option><option value="thanh_thao" selected>Thành thạo</option><option value="nang_cao">Nâng cao</option></select>
Điểm <input name="diem" value="72.5" size="6"> <button>Nộp bài (báo "hoàn thành")</button></form></div>`
      : '';
    const bai = hv.target ? `<p>Mở bài: <b>${thoat(TEN_BAI[hv.target] ?? hv.target)}</b></p>` : '<p>Không có target → hiện <b>danh sách bài cần làm</b>.</p>';
    return guiHtml(
      res,
      200,
      trang(
        'Đã xác định người làm bài',
        `<div class="the">
<p>Mã định danh CSDL ngành: <code>${thoat(hv.ma_dinh_danh_moet ?? '(không có — dùng hoc_vien_id)')}</code></p>
<p>hoc_vien_id: <code>${thoat(hv.hoc_vien_id)}</code></p>
<p>Vai trò: <b>${hv.vai_tro === 'can_bo_quan_ly' ? 'Cán bộ quản lý' : hv.vai_tro === 'giao_vien' ? 'Giáo viên' : '(chưa chọn)'}</b> → chọn bộ câu hỏi tương ứng</p>
<p>Đơn vị: ${thoat(hv.ten_don_vi)} <code>${thoat(hv.ma_don_vi ?? '—')}</code></p>
<p>Lớp: ${hv.lop?.length ? hv.lop.map((l) => thoat(`${l.ten_lop} (${l.loai_lop}, ${l.giai_doan})`)).join(', ') : '(chưa phân lớp)'}</p>
${bai}</div>${nopBai}
<details><summary>JSON nhận từ POST /sso/doi-ma</summary><pre>${thoat(JSON.stringify(hv, null, 2))}</pre></details>`,
      ),
    );
  }

  if (url.pathname === '/bao-ket-qua' && req.method === 'POST') {
    const hv = layPhien(req);
    if (!hv?.target) return guiHtml(res, 401, trang('Chưa đăng nhập', '<p>Hãy vào từ cổng bồi dưỡng.</p>'));
    const form = await docForm(req);
    const trangThai = form.get('trang_thai');
    const kq = await baoKetQua({
      hoc_vien_id: hv.hoc_vien_id,
      loai: hv.target,
      trang_thai: trangThai,
      thoi_diem: new Date().toISOString(),
      ...(trangThai === 'hoan_thanh' ? { muc: form.get('muc'), diem: Number(form.get('diem')), chi_tiet: { nguon: 'gia-lap' } } : {}),
    });
    return guiHtml(
      res,
      kq.ok ? 200 : 502,
      trang(
        kq.ok ? 'Đã báo về cổng' : 'Báo về cổng thất bại',
        `<div class="the${kq.ok ? '' : ' loi'}"><p>HTTP ${kq.status}</p><pre>${thoat(JSON.stringify(kq.body, null, 2))}</pre></div>
<p><a href="/lam-bai">Quay lại bài</a> · <a href="${thoat(CONG_FE)}/toi/danh-gia-dau-vao">Về cổng bồi dưỡng xem trạng thái</a></p>`,
      ),
    );
  }

  guiHtml(res, 404, trang('Không tìm thấy', '<p>Trang giả lập chỉ có /sso/start, /lam-bai và /bao-ket-qua.</p>'));
});

server.listen(PORT, () => {
  console.log(`Trang khảo sát giả lập: http://localhost:${PORT}/sso/start  (đổi mã tại ${CONG_URL}/sso/doi-ma)`);
});
