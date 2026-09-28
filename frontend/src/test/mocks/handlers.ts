import { http, HttpResponse } from 'msw';
import { DIA_DANH, DON_VI, MON_HOC, db } from './db';

function loi(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status });
}

export const handlers = [
  http.post('/auth/dang-nhap', async ({ request }) => {
    const body = (await request.json()) as { ten_dang_nhap: string; mat_khau: string };
    const maSach = body.ten_dang_nhap.trim();
    if (maSach !== db.hoSo.ma_dinh_danh_moet) {
      return loi(401, 'UNAUTHORIZED', 'Mã định danh hoặc mật khẩu không đúng');
    }
    return HttpResponse.json({
      token: 'token-gia-lap',
      phai_doi_mat_khau: true,
      nguoi_dung: { id: 'nd-1', ten_dang_nhap: maSach, vai_tro: 'hoc_vien', hoc_vien_id: db.hoSo.id },
    });
  }),

  http.post('/auth/dang-xuat', () => new HttpResponse(null, { status: 204 })),

  http.get('/auth/toi', () =>
    HttpResponse.json({
      nguoi_dung: { id: 'nd-1', ten_dang_nhap: db.hoSo.ma_dinh_danh_moet, vai_tro: 'hoc_vien', hoc_vien_id: db.hoSo.id },
      phai_doi_mat_khau: false,
    }),
  ),

  http.post('/auth/doi-mat-khau', () => new HttpResponse(null, { status: 204 })),

  http.get('/hoc-vien/toi', () => HttpResponse.json(db.hoSo)),

  http.patch('/hoc-vien/toi', async ({ request }) => {
    const patch = (await request.json()) as Record<string, unknown>;
    Object.assign(db.hoSo, patch);
    return HttpResponse.json(db.hoSo);
  }),

  http.post('/hoc-vien/toi/chuyen-mon', async ({ request }) => {
    const { chuyen_mon } = (await request.json()) as { chuyen_mon: string };
    if (!db.hoSo.chuyen_mon.includes(chuyen_mon)) db.hoSo.chuyen_mon.push(chuyen_mon);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete('/hoc-vien/toi/chuyen-mon', async ({ request }) => {
    const { chuyen_mon } = (await request.json()) as { chuyen_mon: string };
    db.hoSo.chuyen_mon = db.hoSo.chuyen_mon.filter((c) => c !== chuyen_mon);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/hoc-vien/kiem-tra-trung', () => HttpResponse.json({ trung: false })),

  http.get('/hoc-vien/toi/dot-xac-nhan', () => HttpResponse.json(db.dotXacNhan)),

  http.get('/hoc-vien/toi/muc-do-day-du', () =>
    HttpResponse.json({ day_du: db.dotXacNhan.day_du, thieu: db.dotXacNhan.thieu }),
  ),

  http.post('/hoc-vien/toi/kiem-tra-truoc-xac-nhan', () => HttpResponse.json({ loi: [], canh_bao: [] })),

  http.post('/hoc-vien/toi/xac-nhan', () => {
    const xacNhanLuc = new Date().toISOString();
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.xac_nhan_luc = xacNhanLuc;
    return HttpResponse.json({ xac_nhan_luc: xacNhanLuc, email_lien_he: db.hoSo.email_lien_he });
  }),

  http.get('/danh-muc/dia-danh', ({ request }) => {
    const url = new URL(request.url);
    const cap = url.searchParams.get('cap');
    const parentId = url.searchParams.get('parent_id');
    const q = url.searchParams.get('q')?.toLowerCase();
    const data = DIA_DANH.filter((d) => d.cap === cap && (!parentId || d.parent_id === parentId) && (!q || d.ten.toLowerCase().includes(q)));
    return HttpResponse.json({ data });
  }),

  http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const data = DON_VI.filter((d) => !q || d.ten_don_vi.toLowerCase().includes(q));
    return HttpResponse.json({ data });
  }),

  http.get('/danh-muc/mon-hoc', ({ request }) => {
    const url = new URL(request.url);
    const capHoc = url.searchParams.get('cap_hoc');
    const data = MON_HOC.filter((m) => m.cap_hoc === capHoc);
    return HttpResponse.json({ data });
  }),

  http.get('/danh-muc/chuyen-mon-dao-tao/goi-y', () => HttpResponse.json({ data: ['Tin học', 'Toán', 'Vật lý'] })),
];

export { loi };
