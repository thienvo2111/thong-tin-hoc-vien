import { http, HttpResponse } from 'msw';
import type { ImportChiTiet, KhoaBoiDuong } from '@/api/types';
import { DIA_DANH, DON_VI, MON_HOC, db } from './db';

function fileMoPhong() {
  return new HttpResponse('noi-dung-file-mo-phong', { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
}

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
      nguoi_dung: { id: 'nd-1', ten_dang_nhap: maSach, vai_tro: db.nguoiDung.vai_tro, hoc_vien_id: db.hoSo.id },
    });
  }),

  http.post('/auth/dang-xuat', () => new HttpResponse(null, { status: 204 })),

  http.get('/auth/toi', () =>
    HttpResponse.json({
      nguoi_dung: { id: 'nd-1', ten_dang_nhap: db.hoSo.ma_dinh_danh_moet, vai_tro: db.nguoiDung.vai_tro, hoc_vien_id: db.hoSo.id },
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

  http.get('/hoc-vien/toi/danh-gia-dau-vao', () => HttpResponse.json(db.danhGiaDauVao)),

  http.post('/hoc-vien/toi/xac-nhan', () => {
    const xacNhanLuc = new Date().toISOString();
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.xac_nhan_luc = xacNhanLuc;
    return HttpResponse.json({ xac_nhan_luc: xacNhanLuc, email_lien_he: db.hoSo.email_lien_he });
  }),

  // --- Module quản trị (phase 3) ---
  http.get('/hoc-vien', ({ request }) => {
    const url = new URL(request.url);
    const trangThai = url.searchParams.get('trang_thai');
    const donViId = url.searchParams.get('don_vi_cong_tac_id');
    const capGiangDay = url.searchParams.get('cap_giang_day');
    const q = url.searchParams.get('q')?.toLowerCase();
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');

    let items = db.danhSachHocVien;
    if (trangThai) items = items.filter((h) => h.trang_thai === trangThai);
    if (donViId) items = items.filter((h) => h.don_vi_cong_tac_id === donViId);
    if (capGiangDay) items = items.filter((h) => h.cap_giang_day === capGiangDay);
    if (q) {
      items = items.filter(
        (h) => (h.ho_ten ?? '').toLowerCase().includes(q) || (h.so_dinh_danh_ca_nhan ?? '').includes(q),
      );
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);
    return HttpResponse.json({ data, total, page, page_size: pageSize });
  }),

  http.get('/hoc-vien/:id', ({ params }) => {
    const found = db.danhSachHocVien.find((h) => h.id === params.id);
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ học viên');
    return HttpResponse.json({ ...found, chuyen_mon: [], don_vi_cong_tac_ten: 'THPT Long Xuyên' });
  }),

  http.get('/bao-cao/tong-hop', ({ request }) => {
    const url = new URL(request.url);
    const theo = url.searchParams.get('theo') ?? 'don_vi';
    return HttpResponse.json({ theo, tu_ngay: null, den_ngay: null, rows: db.baoCaoTongHopDonVi });
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
    const loaiDonVi = url.searchParams.get('loai_don_vi');
    const data = DON_VI.filter(
      (d) => (!q || d.ten_don_vi.toLowerCase().includes(q)) && (!loaiDonVi || d.loai_don_vi === loaiDonVi),
    );
    return HttpResponse.json({ data });
  }),

  http.get('/danh-muc/mon-hoc', ({ request }) => {
    const url = new URL(request.url);
    const capHoc = url.searchParams.get('cap_hoc');
    const data = MON_HOC.filter((m) => m.cap_hoc === capHoc);
    return HttpResponse.json({ data });
  }),

  http.get('/danh-muc/chuyen-mon-dao-tao/goi-y', () => HttpResponse.json({ data: ['Tin học', 'Toán', 'Vật lý'] })),

  // --- Khóa bồi dưỡng (Phase 4 redesign) ---
  http.get('/khoa-boi-duong', ({ request }) => {
    const url = new URL(request.url);
    const trangThai = url.searchParams.get('trang_thai');
    const donViId = url.searchParams.get('don_vi_to_chuc_id');
    const q = url.searchParams.get('q')?.toLowerCase();
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');

    let items = db.danhSachKhoa;
    if (trangThai) items = items.filter((k) => k.trang_thai === trangThai);
    if (donViId) items = items.filter((k) => k.don_vi_to_chuc_id === donViId);
    if (q) {
      items = items.filter((k) => k.ten_khoa.toLowerCase().includes(q) || k.ma_khoa.toLowerCase().includes(q));
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);
    return HttpResponse.json({ data, total, page, page_size: pageSize });
  }),

  http.get('/khoa-boi-duong/:id', ({ params }) => {
    const found = db.chiTietKhoa[params.id as string];
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    return HttpResponse.json(found);
  }),

  http.post('/khoa-boi-duong', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const id = `khoa-moi-${db.danhSachKhoa.length + 1}`;
    const moi: KhoaBoiDuong = {
      id,
      ma_khoa: String(body.ma_khoa ?? ''),
      ten_khoa: String(body.ten_khoa ?? ''),
      don_vi_to_chuc_id: String(body.don_vi_to_chuc_id ?? 'dv-1'),
      dia_diem: (body.dia_diem as string) ?? null,
      thoi_gian_bat_dau: String(body.thoi_gian_bat_dau ?? ''),
      thoi_gian_ket_thuc: String(body.thoi_gian_ket_thuc ?? ''),
      trang_thai: 'nhap',
      nguoi_duyet_id: null,
      cap_duyet_thuc_te: null,
      ngay_duyet: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'nd-1',
    };
    db.danhSachKhoa = [moi, ...db.danhSachKhoa];
    db.chiTietKhoa[id] = { ...moi, giai_doan: [], lop_hoc: [] };
    return HttpResponse.json(moi);
  }),

  http.post('/khoa-boi-duong/:id/nop-duyet', ({ params }) => {
    const id = params.id as string;
    const khoa = db.chiTietKhoa[id];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    khoa.trang_thai = 'cho_duyet';
    db.danhSachKhoa = db.danhSachKhoa.map((k) => (k.id === id ? { ...k, trang_thai: 'cho_duyet' } : k));
    return HttpResponse.json(khoa);
  }),

  http.post('/khoa-boi-duong/:id/duyet', async ({ params, request }) => {
    const id = params.id as string;
    const khoa = db.chiTietKhoa[id];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const body = (await request.json()) as { ket_qua: 'da_duyet' | 'tu_choi' };
    khoa.trang_thai = body.ket_qua;
    db.danhSachKhoa = db.danhSachKhoa.map((k) => (k.id === id ? { ...k, trang_thai: body.ket_qua } : k));
    return HttpResponse.json(khoa);
  }),

  // --- Trung tâm báo cáo (Phase 5 redesign) ---
  http.get('/dot-xac-nhan', () => HttpResponse.json({ data: db.danhSachDotXacNhan })),

  http.get('/bao-cao/xuat-excel', () => fileMoPhong()),

  http.get('/bao-cao/xac-nhan', ({ request }) => {
    const url = new URL(request.url);
    if (!url.searchParams.get('dot_id')) return loi(400, 'VALIDATION_ERROR', 'Thiếu dot_id');
    return HttpResponse.json({ rows: db.baoCaoXacNhan });
  }),
  http.get('/bao-cao/xac-nhan/xuat-excel', () => fileMoPhong()),

  http.get('/bao-cao/sua-truong-moet', ({ request }) => {
    const url = new URL(request.url);
    if (!url.searchParams.get('khoa_id')) return loi(400, 'VALIDATION_ERROR', 'Thiếu khoa_id');
    return HttpResponse.json({ rows: db.baoCaoSuaTruongMoet });
  }),
  http.get('/bao-cao/sua-truong-moet/xuat-excel', () => fileMoPhong()),

  http.get('/bao-cao/xuat-cho-vle', () => fileMoPhong()),

  http.get('/bao-cao/dieu-kien-danh-gia', ({ request }) => {
    const url = new URL(request.url);
    if (!url.searchParams.get('khoa_id')) return loi(400, 'VALIDATION_ERROR', 'Thiếu khoa_id');
    return HttpResponse.json({ rows: db.baoCaoDieuKienDanhGia });
  }),
  http.get('/bao-cao/dieu-kien-danh-gia/xuat-excel', () => fileMoPhong()),

  http.get('/bao-cao/van-hanh', () => HttpResponse.json({ rows: db.baoCaoVanHanh })),
  http.get('/bao-cao/van-hanh/xuat-excel', () => fileMoPhong()),

  // --- Nhập dữ liệu (Phase 5 redesign) ---
  http.get('/import/mau-excel', () => fileMoPhong()),

  http.post('/import/:loai', () => {
    const id = `import-moi-${Object.keys(db.chiTietImport).length + 1}`;
    const chiTiet: ImportChiTiet = {
      id,
      trang_thai: 'dang_xu_ly',
      tong_so_dong: 0,
      so_dong_thanh_cong: 0,
      so_dong_loi: 0,
      danh_sach_loi: [],
      danh_sach_canh_bao: [],
      so_hoc_vien_chua_co_email: 0,
    };
    db.chiTietImport[id] = chiTiet;
    // Mô phỏng xử lý bất đồng bộ xong ngay (test không cần chờ polling nhiều vòng).
    db.chiTietImport[id] = {
      ...chiTiet,
      trang_thai: 'hoan_thanh',
      tong_so_dong: 5,
      so_dong_thanh_cong: 4,
      so_dong_loi: 1,
      danh_sach_loi: [{ dong: 2, ly_do: 'Mã định danh trùng đã tồn tại' }],
    };
    return HttpResponse.json({ import_id: id, trang_thai: 'dang_xu_ly' });
  }),

  http.get('/import/:id', ({ params }) => {
    const found = db.chiTietImport[params.id as string];
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy lần nhập dữ liệu');
    return HttpResponse.json(found);
  }),

  http.post('/import/:id/xac-nhan', ({ params }) => {
    const found = db.chiTietImport[params.id as string];
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy lần nhập dữ liệu');
    return HttpResponse.json(found);
  }),

  http.get('/import/:id/file-loi', () => fileMoPhong()),

  http.get('/import', () => HttpResponse.json({ data: db.danhSachImport })),
];

export { loi };
