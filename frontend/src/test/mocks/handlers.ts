import { http, HttpResponse } from 'msw';
import type { ImportChiTiet, KhoaBoiDuong, LoaiLop, YeuCauHoTro, YeuCauHoTroQuanTri } from '@/api/types';
import { DIA_DANH, DON_VI, MON_HOC, db } from './db';

// QĐ10 (2026-09-30): dang_ky_hoc mẫu nằm rải trong db.khoaHocCuaHocVien (map theo hoc_vien_id) — tìm
// theo id đăng ký học (không phải hoc_vien_id) để dùng chung cho PUT/PATCH /dang-ky-hoc/{id}/*.
function timDangKyTheoId(id: string) {
  for (const list of Object.values(db.khoaHocCuaHocVien)) {
    const found = list.find((dk) => dk.id === id);
    if (found) return found;
  }
  return undefined;
}

function fileMoPhong() {
  return new HttpResponse('noi-dung-file-mo-phong', { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
}

// Dòng ticket phía xử lý (Quản trị / người hỗ trợ): mẫu có thể ghi đè các field bằng cách đặt sẵn trong db.
function dongXuLy(y: YeuCauHoTro): YeuCauHoTroQuanTri {
  return {
    hoc_vien_ho_ten: 'Học viên mẫu',
    nguoi_tra_loi_ten: null,
    ten_cum: ['Cụm Long Xuyên'],
    da_sua_boi_quan_tri: !!y.thoi_gian_sua_tra_loi,
    hoi_lai: false,
    ...(y as Partial<YeuCauHoTroQuanTri>),
  } as YeuCauHoTroQuanTri;
}

// Như backend (ADR 0003 H11): chỉ trả lời được khi còn cho_xu_ly, còn lại 409 không ghi đè.
async function traLoiMau(id: string, request: Request) {
  const found = db.danhSachYeuCauHoTro.find((y) => y.id === id);
  if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ');
  if (found.trang_thai !== 'cho_xu_ly') return loi(409, 'CONFLICT', 'Yêu cầu này đã có người trả lời');
  const body = (await request.json()) as { noi_dung_tra_loi: string };
  found.noi_dung_tra_loi = body.noi_dung_tra_loi;
  found.trang_thai = 'da_phan_hoi';
  found.thoi_gian_phan_hoi = new Date().toISOString();
  return HttpResponse.json(found);
}

function loi(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ error: { code, message, ...extra } }, { status });
}

export const handlers = [
  // ADR 0004 L4 (issue #17): bảng kiểm.
  http.get('/bang-kiem/quy-tac', () =>
    HttpResponse.json([
      { ma: 'co_diem_hoc', ten: 'Mọi buổi có điểm học' },
      { ma: 'co_giang_vien', ten: 'Mọi buổi có ≥ 1 giảng viên' },
    ]),
  ),
  http.get('/bang-kiem/mac-dinh', () => HttpResponse.json(db.bangKiemMacDinh)),
  http.get('/bang-kiem/khoa/:khoaId', ({ params }) =>
    HttpResponse.json(db.bangKiemKhoa[params.khoaId as string] ?? db.bangKiemMacDinh),
  ),
  http.post('/bang-kiem/khoa/:khoaId/tuy-chinh', ({ params }) => {
    const bo = { nguon: 'rieng' as const, muc: db.bangKiemMacDinh.muc.map((m) => ({ ...m, id: `${m.id}-k`, khoa_id: params.khoaId as string })) };
    db.bangKiemKhoa[params.khoaId as string] = bo;
    return HttpResponse.json(bo, { status: 201 });
  }),
  http.post('/bang-kiem/mac-dinh/muc', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const m = { id: `m-${db.bangKiemMacDinh.muc.length + 1}`, khoa_id: null, thu_tu: db.bangKiemMacDinh.muc.length + 1, mo_ta: null, ma_quy_tac: null, han_truoc_ngay: null, trang_thai: 'active', ...body } as (typeof db.bangKiemMacDinh.muc)[number];
    db.bangKiemMacDinh.muc.push(m);
    return HttpResponse.json(m, { status: 201 });
  }),
  http.patch('/bang-kiem/muc/:id', async ({ params, request }) => {
    const m = [...db.bangKiemMacDinh.muc, ...Object.values(db.bangKiemKhoa).flatMap((b) => b.muc)].find((x) => x.id === params.id);
    if (!m) return loi(404, 'NOT_FOUND', 'Không tìm thấy mục');
    Object.assign(m, (await request.json()) as Record<string, unknown>);
    return HttpResponse.json(m);
  }),
  http.get('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId/bang-kiem', () => HttpResponse.json(db.danhGiaDot)),
  http.put('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId/bang-kiem/:mucId', async ({ params, request }) => {
    const body = (await request.json()) as { da_xong: boolean; ghi_chu?: string | null };
    const m = db.danhGiaDot.muc.find((x) => x.muc_id === params.mucId);
    if (!m) return loi(404, 'NOT_FOUND', 'Không tìm thấy mục');
    if (m.loai === 'tu_dong') return loi(400, 'VALIDATION_ERROR', 'Mục tự động do hệ thống tính');
    m.trang_thai = body.da_xong ? 'dat' : 'chua_dat';
    m.ghi_chu = body.ghi_chu ?? null;
    m.cap_nhat_boi = 'Phạm Văn Giảng';
    m.cap_nhat_luc = new Date().toISOString();
    return HttpResponse.json({});
  }),
  http.get('/ho-tro-giang-vien/viec-can-lam', () =>
    HttpResponse.json([
      {
        lop: db.danhGiaDot.lop,
        giai_doan: db.danhGiaDot.giai_doan,
        buoi_dau: db.danhGiaDot.buoi_dau,
        mau: db.danhGiaDot.mau,
        so_qua_han: 1,
        so_chua_dat: 2,
        muc_chua_dat: db.danhGiaDot.muc.filter((m) => m.trang_thai !== 'dat').map((m) => ({ ten: m.ten, trang_thai: m.trang_thai, han: m.han })),
      },
    ]),
  ),
  http.get('/ho-tro-giang-vien/viec-can-lam/dem', () => HttpResponse.json({ do: db.danhGiaDot.mau === 'do' ? 1 : 0 })),

  // ADR 0004 L1 (issue #14): khu người hỗ trợ giảng viên + nhóm theo khóa.
  http.get('/ho-tro-giang-vien/lop-cua-toi', () => HttpResponse.json(db.lopCuaToiGv)),
  http.get('/ho-tro-giang-vien/lop/:lopId/dot', ({ params }) =>
    params.lopId === 'lop-1'
      ? HttpResponse.json({
          lop: { id: 'lop-1', ten_lop: 'Lớp 01 – Nhóm cơ bản A', loai_lop: 'truc_tiep', khoa: { id: 'khoa-1', ma_khoa: 'AG-2026-014', ten_khoa: 'Khóa An Giang' } },
          dot: [{ id: 'gd-2', thu_tu: 2, ten_giai_doan: 'Học trực tiếp', thoi_gian_bat_dau: '2026-10-05T00:00:00.000Z', thoi_gian_ket_thuc: '2026-10-06T00:00:00.000Z', so_buoi: 1 }],
        })
      : loi(404, 'NOT_FOUND', 'Không tìm thấy lớp học'),
  ),
  http.get('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId', () => HttpResponse.json(db.trangLopGv)),
  // ADR 0004 L3 (issue #16): vận hành lớp của người hỗ trợ GV.
  http.patch('/ho-tro-giang-vien/lich-hoc/:id', async ({ params, request }) => {
    const body = (await request.json()) as { ly_do?: string; phong?: string | null };
    if (!body.ly_do || body.ly_do.trim().length < 5) {
      return loi(400, 'VALIDATION_ERROR', 'Thiếu lý do', { fields: [{ field: 'ly_do', message: 'Lý do tối thiểu 5 ký tự' }] });
    }
    const b = db.trangLopGv.buoi.find((x) => x.id === params.id);
    if (!b) return loi(404, 'NOT_FOUND', 'Không tìm thấy buổi học');
    b.phong = body.phong ?? null;
    return HttpResponse.json({ ...b, canh_bao: [] });
  }),
  http.put('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId/hau-can/:gvId', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown> & { cap_nhat_luc?: string };
    const cu = db.trangLopGv.hau_can.find((h) => h.giang_vien_id === params.gvId);
    if (cu && body.cap_nhat_luc !== cu.cap_nhat_luc) {
      return loi(409, 'CONFLICT', 'Người khác vừa sửa hậu cần này — tải lại để xem bản mới');
    }
    const { cap_nhat_luc: _bo, ...truong } = body;
    void _bo;
    const moi = {
      ...(cu ?? { id: `hc-${params.gvId}`, giang_vien_id: params.gvId as string }),
      ...truong,
      cap_nhat_luc: new Date(Date.now() + 1000).toISOString(),
      nguoi_sua: 'Phạm Văn Giảng',
    } as (typeof db.trangLopGv.hau_can)[number];
    db.trangLopGv.hau_can = [...db.trangLopGv.hau_can.filter((h) => h.giang_vien_id !== params.gvId), moi];
    return HttpResponse.json(moi);
  }),
  http.put('/ho-tro-giang-vien/lop/:lopId/giai-doan/:gdId/thuc-dia', async ({ request }) => {
    const { nhan_su } = (await request.json()) as { nhan_su: { ho_ten: string; so_dien_thoai: string; nhiem_vu?: string }[] };
    db.trangLopGv.thuc_dia = nhan_su.map((n, i) => ({ id: `td-${i}`, ho_ten: n.ho_ten, so_dien_thoai: n.so_dien_thoai, nhiem_vu: n.nhiem_vu ?? null }));
    return HttpResponse.json(db.trangLopGv.thuc_dia);
  }),
  http.get('/ho-tro-giang-vien/diem-hoc', () => {
    const data = db.diemHoc.filter((d) => d.trang_thai === 'active');
    return HttpResponse.json({ data, total: data.length, page: 1, page_size: 20 });
  }),
  http.get('/ho-tro-giang-vien/giang-vien', () =>
    HttpResponse.json({ data: db.giangVien, total: db.giangVien.length, page: 1, page_size: 20 }),
  ),
  http.get('/ho-tro-giang-vien/lich-day', () =>
    HttpResponse.json([
      {
        id: 'lh-1',
        buoi_so: 1,
        thoi_gian_bat_dau: '2026-10-05T01:00:00.000Z',
        thoi_gian_ket_thuc: '2026-10-05T04:00:00.000Z',
        dia_diem_hoac_link: null,
        phong: 'P.101',
        lop: { id: 'lop-1', ten_lop: 'Lớp 01 – Nhóm cơ bản A', loai_lop: 'truc_tiep', khoa: { id: 'khoa-1', ma_khoa: 'AG-2026-014' } },
        giai_doan: { id: 'gd-2', ten_giai_doan: 'Học trực tiếp', hinh_thuc: 'truc_tiep' },
        diem_hoc: { id: 'dh-1', ten: 'THPT Long Xuyên', dia_chi: '1 Trần Hưng Đạo' },
        phan_cong: [],
      },
    ]),
  ),

  http.put('/khoa-boi-duong/:id/nhom-ho-tro-gv', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const { nguoi_dung_ids } = (await request.json()) as { nguoi_dung_ids: string[] };
    khoa.nhom_ho_tro_gv = nguoi_dung_ids.map((id) => ({
      id,
      ho_ten: db.taiKhoanHoTro.find((t) => t.id === id)?.ho_ten ?? id,
    }));
    return HttpResponse.json({ khoa_id: khoa.id, nhom_ho_tro_gv: khoa.nhom_ho_tro_gv });
  }),

  // T11 (issue #3): giảng viên & phân công.
  http.get('/giang-vien', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const trangThai = url.searchParams.get('trang_thai');
    const items = db.giangVien.filter(
      (g) => (!trangThai || g.trang_thai === trangThai) && (!q || `${g.ho_ten} ${g.so_dien_thoai}`.toLowerCase().includes(q)),
    );
    return HttpResponse.json({ data: items, total: items.length, page: 1, page_size: 20 });
  }),

  http.post('/giang-vien', async ({ request }) => {
    const body = (await request.json()) as Record<string, string>;
    if (db.giangVien.some((g) => g.so_dien_thoai === body.so_dien_thoai)) {
      return loi(409, 'CONFLICT', 'Số điện thoại đã dùng', { fields: [{ field: 'so_dien_thoai', message: 'Đã tồn tại' }] });
    }
    const moi = {
      id: `gv-${db.giangVien.length + 1}`,
      email: null,
      don_vi_cong_tac: null,
      ghi_chu: null,
      trang_thai: 'active' as const,
      so_buoi: 0,
      ...body,
    } as (typeof db.giangVien)[number];
    db.giangVien.push(moi);
    return HttpResponse.json(moi, { status: 201 });
  }),

  http.patch('/giang-vien/phan-cong/:id/xac-nhan-gio', async ({ params, request }) => {
    const body = (await request.json()) as { da_xac_nhan_gio: boolean; so_gio?: number };
    for (const ld of Object.values(db.lichDay)) {
      const pc = ld.phan_cong.find((p) => p.id === params.id);
      if (pc) {
        pc.da_xac_nhan_gio = body.da_xac_nhan_gio;
        if (body.so_gio !== undefined) pc.so_gio = String(body.so_gio);
        return HttpResponse.json(pc);
      }
    }
    return loi(404, 'NOT_FOUND', 'Không tìm thấy phân công');
  }),

  http.patch('/giang-vien/:id', async ({ params, request }) => {
    const found = db.giangVien.find((g) => g.id === params.id);
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy giảng viên');
    Object.assign(found, (await request.json()) as Record<string, unknown>);
    return HttpResponse.json(found);
  }),

  http.get('/giang-vien/:id/lich-day', ({ params }) => {
    const ld = db.lichDay[params.id as string];
    return ld ? HttpResponse.json(ld) : loi(404, 'NOT_FOUND', 'Không tìm thấy giảng viên');
  }),

  http.put('/lop/:id/lich-hoc/:lichHocId/giang-vien', async ({ params, request }) => {
    const body = (await request.json()) as { phan_cong: { giang_vien_id: string; vai_tro: 'giang_vien' | 'ho_tro'; so_gio?: number }[] };
    const lich = Object.values(db.chiTietKhoa)
      .flatMap((k) => k.lop_hoc)
      .flatMap((l) => l.lich_hoc ?? [])
      .find((l) => l.id === params.lichHocId);
    if (!lich) return loi(404, 'NOT_FOUND', 'Không tìm thấy buổi học');
    lich.phan_cong = body.phan_cong.map((p, i) => ({
      id: `pc-moi-${i}`,
      vai_tro: p.vai_tro,
      so_gio: p.so_gio ?? null,
      da_xac_nhan_gio: false,
      giang_vien: { id: p.giang_vien_id, ho_ten: db.giangVien.find((g) => g.id === p.giang_vien_id)?.ho_ten ?? '' },
    }));
    return HttpResponse.json(lich.phan_cong);
  }),

  http.get('/bao-cao/gio-day', () =>
    HttpResponse.json({
      rows: [{ giang_vien_id: 'gv-1', ho_ten: 'Nguyễn Văn Long', ma_khoa: 'AG-2026-014', ten_lop: 'Lớp 01', so_buoi: 2, so_buoi_da_xac_nhan: 1, tong_gio_da_xac_nhan: 4 }],
      tong: { so_buoi: 2, so_buoi_da_xac_nhan: 1, tong_gio_da_xac_nhan: 4 },
    }),
  ),

  // T10 (issue #2): danh mục điểm học.
  http.get('/diem-hoc', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const trangThai = url.searchParams.get('trang_thai');
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');
    const items = db.diemHoc.filter(
      (d) =>
        (!trangThai || d.trang_thai === trangThai) &&
        (!q || `${d.ten} ${d.ma_diem_hoc} ${d.dia_chi}`.toLowerCase().includes(q)),
    );
    return HttpResponse.json({
      data: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      page_size: pageSize,
    });
  }),

  http.post('/diem-hoc', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (db.diemHoc.some((d) => d.ma_diem_hoc === body.ma_diem_hoc)) {
      return loi(409, 'CONFLICT', 'Mã điểm học đã tồn tại', {
        fields: [{ field: 'ma_diem_hoc', message: 'Đã tồn tại' }],
      });
    }
    const moi = {
      id: `dh-${db.diemHoc.length + 1}`,
      don_vi_id: null,
      suc_chua: null,
      so_phong: null,
      nguoi_lien_he: null,
      sdt_lien_he: null,
      ghi_chu_csvc: null,
      trang_thai: 'active',
      ...body,
    } as (typeof db.diemHoc)[number];
    db.diemHoc.push(moi);
    return HttpResponse.json(moi, { status: 201 });
  }),

  http.patch('/diem-hoc/:id', async ({ params, request }) => {
    const found = db.diemHoc.find((d) => d.id === params.id);
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy điểm học');
    Object.assign(found, (await request.json()) as Record<string, unknown>);
    return HttpResponse.json(found);
  }),

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

  // 2026-09-30: xác minh email liên hệ & quên/đặt lại mật khẩu.
  http.post('/auth/quen-mat-khau', () => HttpResponse.json({ da_gui: true })),

  http.post('/auth/dat-lai-mat-khau', async ({ request }) => {
    const body = (await request.json()) as { token: string; mat_khau_moi: string };
    if (body.token !== 'token-hop-le') {
      return loi(400, 'VALIDATION_ERROR', 'Liên kết không hợp lệ hoặc đã hết hạn');
    }
    return HttpResponse.json({ da_dat_lai: true });
  }),

  http.post('/auth/xac-minh-email', async ({ request }) => {
    const body = (await request.json()) as { token: string };
    if (body.token !== 'token-hop-le') {
      return loi(400, 'VALIDATION_ERROR', 'Liên kết không hợp lệ hoặc đã hết hạn');
    }
    return HttpResponse.json({ da_xac_minh: true });
  }),

  http.post('/hoc-vien/toi/gui-lai-xac-minh-email', () => HttpResponse.json({ da_gui: true })),

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

  http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json(db.khoaHocToi)),

  http.post('/hoc-vien/toi/xac-nhan', () => {
    if (db.dotXacNhan.ap_dung_dot && !db.dotXacNhan.dot) {
      return HttpResponse.json(
        { error: { code: 'DOT_XAC_NHAN_DONG', message: 'Đợt xác nhận đã đóng' } },
        { status: 403 },
      );
    }
    if (db.dotXacNhan.da_xac_nhan) {
      return HttpResponse.json(
        { error: { code: 'CONFLICT', message: 'Thầy/Cô đã xác nhận hồ sơ ở đợt này. Chỉ cần xác nhận lại khi có điều chỉnh thông tin.' } },
        { status: 409 },
      );
    }
    const xacNhanLuc = new Date().toISOString();
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.can_xac_nhan_lai = false;
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

  // Thêm 2026-09-30 (QĐ10) — admin xem lại khóa/lớp của 1 học viên cụ thể (AdminHocVienChiTiet).
  http.get('/hoc-vien/:id/khoa-hoc', ({ params }) => {
    return HttpResponse.json(db.khoaHocCuaHocVien[params.id as string] ?? []);
  }),

  // Thêm 2026-09-30 (QĐ10) — thao tác thủ công lớp/cụm của 1 đăng ký học (dùng chung ở AdminHocVienChiTiet).
  // Phân lớp theo giai đoạn (spec 2026-10-02): gán/thay/gỡ lớp của 1 giai đoạn.
  http.put('/dang-ky-hoc/:id/giai-doan/:gdId/lop', async ({ params, request }) => {
    const dangKy = timDangKyTheoId(params.id as string);
    if (!dangKy) return loi(404, 'NOT_FOUND', 'Không tìm thấy đăng ký học');
    const body = (await request.json()) as { lop_id: string | null };
    const gd = dangKy.giai_doan.find((g) => g.id === params.gdId);
    if (!gd) return loi(400, 'VALIDATION_ERROR', 'Giai đoạn không thuộc khóa của đăng ký này');
    if (body.lop_id === null) {
      gd.lop = null;
      return HttpResponse.json({ phan_lop: null });
    }
    const lop = db.chiTietKhoa[dangKy.khoa_id]?.lop_hoc.find((l) => l.id === body.lop_id);
    if (!lop) return loi(400, 'VALIDATION_ERROR', 'Lớp không thuộc khóa của đăng ký này');
    gd.lop = {
      id: lop.id,
      ten_lop: lop.ten_lop,
      loai_lop: lop.loai_lop,
      si_so_toi_da: lop.si_so_toi_da,
      nhom_hoc_vien: lop.nhom_hoc_vien,
      muc_nang_luc: lop.muc_nang_luc,
      nhan_su: [],
      lich_hoc: [],
    };
    dangKy.trang_thai = 'da_phan_lop';
    return HttpResponse.json({ phan_lop: { dang_ky_hoc_id: dangKy.id, giai_doan_id: gd.id, lop_id: lop.id } });
  }),

  http.patch('/dang-ky-hoc/:id/cum', async ({ params, request }) => {
    const dangKy = timDangKyTheoId(params.id as string);
    if (!dangKy) return loi(404, 'NOT_FOUND', 'Không tìm thấy đăng ký học');
    const body = (await request.json()) as { cum_id: string | null };
    if (body.cum_id === null) {
      dangKy.cum_id = null;
      dangKy.cum = null;
    } else {
      const khoa = db.chiTietKhoa[dangKy.khoa_id];
      const cum = khoa?.cum_hoc_vien.find((c) => c.id === body.cum_id);
      if (!cum) return loi(400, 'VALIDATION_ERROR', 'cum_id không tồn tại');
      dangKy.cum_id = cum.id;
      dangKy.cum = cum;
    }
    return HttpResponse.json(dangKy);
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
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');
    const filtered = DIA_DANH.filter((d) => d.cap === cap && (!parentId || d.parent_id === parentId) && (!q || d.ten.toLowerCase().includes(q)));
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    return HttpResponse.json({ data, total: filtered.length, page, page_size: pageSize });
  }),

  http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const q = url.searchParams.get('q')?.toLowerCase();
    const loaiDonVi = url.searchParams.get('loai_don_vi');
    const diaBanId = url.searchParams.get('dia_ban_id');
    const tinhId = url.searchParams.get('tinh_id');
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');

    const items = DON_VI.filter(
      (d) =>
        (!id || d.id === id) &&
        (!q || d.ten_don_vi.toLowerCase().includes(q)) &&
        (!loaiDonVi || d.loai_don_vi === loaiDonVi) &&
        (!diaBanId || d.dia_ban_id === diaBanId) &&
        (!tinhId || d.tinh_id === tinhId),
    );
    const total = items.length;
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);
    return HttpResponse.json({ data, total, page, page_size: pageSize });
  }),

  http.patch('/danh-muc/don-vi-cong-tac/:id', async ({ params, request }) => {
    const body = (await request.json()) as { dia_ban_id?: string };
    const donVi = DON_VI.find((d) => d.id === params.id);
    if (!donVi) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đơn vị công tác' } }, { status: 404 });
    if (body.dia_ban_id) {
      const diaBan = DIA_DANH.find((d) => d.id === body.dia_ban_id);
      donVi.dia_ban_id = body.dia_ban_id;
      donVi.dia_ban_ten = diaBan?.ten ?? donVi.dia_ban_ten;
      donVi.tinh_id = diaBan?.parent_id ?? null;
      donVi.tinh_ten = DIA_DANH.find((t) => t.id === diaBan?.parent_id)?.ten ?? null;
    }
    return HttpResponse.json(donVi);
  }),

  http.get('/danh-muc/mon-hoc', ({ request }) => {
    const url = new URL(request.url);
    const capHoc = url.searchParams.get('cap_hoc');
    const data = MON_HOC.filter((m) => m.cap_hoc === capHoc);
    return HttpResponse.json({ data });
  }),

  http.get('/danh-muc/chuyen-mon-dao-tao/goi-y', () => HttpResponse.json({ data: ['Tin học', 'Toán', 'Vật lý'] })),

  // --- Khóa bồi dưỡng (Phase 4 redesign; đổi don_vi_to_chuc_id -> don_vi_dat_hang_id 2026-10-03) ---
  http.get('/khoa-boi-duong', ({ request }) => {
    const url = new URL(request.url);
    const trangThai = url.searchParams.get('trang_thai');
    const donViId = url.searchParams.get('don_vi_dat_hang_id');
    const q = url.searchParams.get('q')?.toLowerCase();
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');

    let items = db.danhSachKhoa;
    if (trangThai) items = items.filter((k) => k.trang_thai === trangThai);
    if (donViId) items = items.filter((k) => k.don_vi_dat_hang_id === donViId);
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

  // Chỉ quan_tri tạo khóa (2026-10-03) — khóa tạo ra da_duyet NGAY, don_vi_dat_hang_id bắt buộc
  // (xem validateDonViDatHang() ở backend — 'Bắt buộc' | 'Không hợp lệ' | 'Sai loại đơn vị').
  http.post('/khoa-boi-duong', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const donViDatHangId = body.don_vi_dat_hang_id as string | undefined;
    if (!donViDatHangId) {
      return loi(400, 'VALIDATION_ERROR', 'Thiếu đơn vị đặt hàng', {
        fields: [{ field: 'don_vi_dat_hang_id', message: 'Bắt buộc' }],
      });
    }
    const donVi = DON_VI.find((d) => d.id === donViDatHangId);
    if (!donVi) {
      return loi(400, 'VALIDATION_ERROR', 'don_vi_dat_hang_id không tồn tại', {
        fields: [{ field: 'don_vi_dat_hang_id', message: 'Không hợp lệ' }],
      });
    }
    const id = `khoa-moi-${db.danhSachKhoa.length + 1}`;
    const moi: KhoaBoiDuong = {
      id,
      ma_khoa: String(body.ma_khoa ?? ''),
      ten_khoa: String(body.ten_khoa ?? ''),
      don_vi_dat_hang_id: donViDatHangId,
      dia_diem: (body.dia_diem as string) ?? null,
      thoi_gian_bat_dau: String(body.thoi_gian_bat_dau ?? ''),
      thoi_gian_ket_thuc: String(body.thoi_gian_ket_thuc ?? ''),
      trang_thai: 'da_duyet',
      nguoi_duyet_id: 'nd-1',
      cap_duyet_thuc_te: 'quan_tri',
      ngay_duyet: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'nd-1',
    };
    db.danhSachKhoa = [moi, ...db.danhSachKhoa];
    db.chiTietKhoa[id] = { ...moi, pham_vi_hoc_vien: 'toan_bo', giai_doan: [], lop_hoc: [], cum_hoc_vien: [] };
    return HttpResponse.json(moi);
  }),

  // Chỉ quan_tri sửa khóa (2026-10-03) — sửa được ở mọi trạng thái, don_vi_dat_hang_id tùy chọn
  // (không gửi = giữ nguyên).
  http.patch('/khoa-boi-duong/:id', async ({ params, request }) => {
    const id = params.id as string;
    const khoa = db.chiTietKhoa[id];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const body = (await request.json()) as Record<string, unknown>;
    Object.assign(khoa, body);
    db.danhSachKhoa = db.danhSachKhoa.map((k) => (k.id === id ? { ...k, ...body } : k));
    return HttpResponse.json(khoa);
  }),

  // --- CRUD giai đoạn/lớp/cụm/đơn vị theo dõi (AdminKhoaChiTiet) — docs/api-contract.md mục 3. Mô
  // phỏng lại đúng ràng buộc unique/404 quan trọng của backend (mapUniqueViolation, getXTrongKhoaOrThrow)
  // để test được các nhánh lỗi field, không chỉ nhánh thành công. ---
  http.post('/khoa-boi-duong/:id/giai-doan', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const body = (await request.json()) as {
      thu_tu: number;
      ten_giai_doan: string;
      hinh_thuc: string;
      thoi_gian_bat_dau: string;
      thoi_gian_ket_thuc: string;
      link_hoac_dia_diem?: string | null;
      huong_dan?: string | null;
    };
    if (khoa.giai_doan.some((g) => g.thu_tu === body.thu_tu)) {
      return loi(409, 'CONFLICT', `Thứ tự ${body.thu_tu} đã tồn tại trong khóa này`, {
        fields: [{ field: 'thu_tu', message: 'Đã tồn tại' }],
      });
    }
    const moi = {
      id: `gd-moi-${Object.values(db.chiTietKhoa).reduce((n, k) => n + k.giai_doan.length, 0) + 1}`,
      khoa_id: khoa.id,
      thu_tu: body.thu_tu,
      ten_giai_doan: body.ten_giai_doan,
      hinh_thuc: body.hinh_thuc as never,
      thoi_gian_bat_dau: body.thoi_gian_bat_dau,
      thoi_gian_ket_thuc: body.thoi_gian_ket_thuc,
      trang_thai: 'active' as const,
      link_hoac_dia_diem: body.link_hoac_dia_diem ?? null,
      huong_dan: body.huong_dan ?? null,
    };
    khoa.giai_doan = [...khoa.giai_doan, moi].sort((a, b) => a.thu_tu - b.thu_tu);
    return HttpResponse.json(moi);
  }),

  http.patch('/khoa-boi-duong/:id/giai-doan/:giaiDoanId', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const gd = khoa.giai_doan.find((g) => g.id === params.giaiDoanId);
    if (!gd) return loi(404, 'NOT_FOUND', 'Không tìm thấy giai đoạn');
    const body = (await request.json()) as Partial<typeof gd>;
    if (body.thu_tu !== undefined && khoa.giai_doan.some((g) => g.id !== gd.id && g.thu_tu === body.thu_tu)) {
      return loi(409, 'CONFLICT', `Thứ tự ${body.thu_tu} đã tồn tại trong khóa này`, {
        fields: [{ field: 'thu_tu', message: 'Đã tồn tại' }],
      });
    }
    Object.assign(gd, body);
    khoa.giai_doan = [...khoa.giai_doan].sort((a, b) => a.thu_tu - b.thu_tu);
    return HttpResponse.json(gd);
  }),

  http.post('/khoa-boi-duong/:id/lop', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const body = (await request.json()) as { loai_lop: LoaiLop; ten_lop: string; si_so_toi_da?: number };
    if (khoa.lop_hoc.some((l) => l.loai_lop === body.loai_lop && l.ten_lop === body.ten_lop)) {
      return loi(409, 'CONFLICT', 'Tên lớp đã tồn tại trong loại lớp này của khóa', {
        fields: [{ field: 'ten_lop', message: 'Đã tồn tại' }],
      });
    }
    const moi = {
      id: `lop-moi-${Object.values(db.chiTietKhoa).reduce((n, k) => n + k.lop_hoc.length, 0) + 1}`,
      khoa_id: khoa.id,
      loai_lop: body.loai_lop,
      ten_lop: body.ten_lop,
      si_so_toi_da: body.si_so_toi_da ?? null,
      trang_thai: 'active' as const,
      nhom_hoc_vien: null,
      muc_nang_luc: null,
      nhan_su: [],
      lich_hoc: [],
    };
    khoa.lop_hoc = [...khoa.lop_hoc, moi];
    return HttpResponse.json(moi);
  }),

  http.patch('/khoa-boi-duong/:id/lop/:lopId', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const lop = khoa.lop_hoc.find((l) => l.id === params.lopId);
    if (!lop) return loi(404, 'NOT_FOUND', 'Không tìm thấy lớp học');
    const body = (await request.json()) as Partial<typeof lop>;
    if (
      (body.ten_lop !== undefined || body.loai_lop !== undefined) &&
      khoa.lop_hoc.some(
        (l) =>
          l.id !== lop.id &&
          l.loai_lop === (body.loai_lop ?? lop.loai_lop) &&
          l.ten_lop === (body.ten_lop ?? lop.ten_lop),
      )
    ) {
      return loi(409, 'CONFLICT', 'Tên lớp đã tồn tại trong loại lớp này của khóa', {
        fields: [{ field: 'ten_lop', message: 'Đã tồn tại' }],
      });
    }
    Object.assign(lop, body);
    return HttpResponse.json(lop);
  }),

  http.post('/khoa-boi-duong/:id/cum', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const body = (await request.json()) as { ten_cum: string; link_zalo?: string; ghi_chu?: string };
    if (khoa.cum_hoc_vien.some((c) => c.ten_cum === body.ten_cum)) {
      return loi(409, 'CONFLICT', 'Tên cụm đã tồn tại trong khóa này', {
        fields: [{ field: 'ten_cum', message: 'Đã tồn tại' }],
      });
    }
    const moi = {
      id: `cum-moi-${Object.values(db.chiTietKhoa).reduce((n, k) => n + k.cum_hoc_vien.length, 0) + 1}`,
      khoa_id: khoa.id,
      ten_cum: body.ten_cum,
      link_zalo: body.link_zalo ?? null,
      ghi_chu: body.ghi_chu ?? null,
      trang_thai: 'active' as const,
      created_at: new Date().toISOString(),
    };
    khoa.cum_hoc_vien = [...khoa.cum_hoc_vien, moi];
    return HttpResponse.json(moi);
  }),

  http.patch('/khoa-boi-duong/:id/cum/:cumId', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    if (!khoa) return loi(404, 'NOT_FOUND', 'Không tìm thấy khóa bồi dưỡng');
    const cum = khoa.cum_hoc_vien.find((c) => c.id === params.cumId);
    if (!cum) return loi(404, 'NOT_FOUND', 'Không tìm thấy cụm học viên');
    const body = (await request.json()) as Partial<typeof cum>;
    if (body.ten_cum !== undefined && khoa.cum_hoc_vien.some((c) => c.id !== cum.id && c.ten_cum === body.ten_cum)) {
      return loi(409, 'CONFLICT', 'Tên cụm đã tồn tại trong khóa này', {
        fields: [{ field: 'ten_cum', message: 'Đã tồn tại' }],
      });
    }
    Object.assign(cum, body);
    return HttpResponse.json(cum);
  }),

  // Route riêng /lop/{id}/... (không dưới /khoa-boi-duong) — tìm khoa chứa lop qua toàn bộ chiTietKhoa.
  http.post('/lop/:id/lich-hoc', async ({ params, request }) => {
    const lopId = params.id as string;
    const lop = Object.values(db.chiTietKhoa)
      .flatMap((k) => k.lop_hoc)
      .find((l) => l.id === lopId);
    if (!lop) return loi(404, 'NOT_FOUND', 'Không tìm thấy lớp học');
    const body = (await request.json()) as {
      giai_doan_id: string;
      buoi_so?: number;
      thoi_gian_bat_dau: string;
      thoi_gian_ket_thuc: string;
      dia_diem_hoac_link?: string;
      diem_hoc_id?: string;
      phong?: string;
    };
    // Như backend (T10, issue #2): buổi giai đoạn trực tiếp phải có điểm học.
    const giaiDoan = Object.values(db.chiTietKhoa)
      .flatMap((k) => k.giai_doan ?? [])
      .find((g) => g.id === body.giai_doan_id);
    if (giaiDoan?.hinh_thuc === 'truc_tiep' && !body.diem_hoc_id) {
      return loi(400, 'VALIDATION_ERROR', 'Buổi học thuộc giai đoạn trực tiếp phải có điểm học', {
        fields: [{ field: 'diem_hoc_id', message: 'Bắt buộc với giai đoạn trực tiếp' }],
      });
    }
    const diemHoc = db.diemHoc.find((d) => d.id === body.diem_hoc_id) ?? null;
    const buoiSo = body.buoi_so ?? 1;
    if ((lop.lich_hoc ?? []).some((l) => l.giai_doan_id === body.giai_doan_id && l.buoi_so === buoiSo)) {
      return loi(409, 'CONFLICT', 'Lớp này đã có lịch học cho giai đoạn và buổi này', {
        fields: [{ field: 'buoi_so', message: 'Đã tồn tại' }],
      });
    }
    const moi = {
      id: `lh-moi-${Object.values(db.chiTietKhoa).flatMap((k) => k.lop_hoc).reduce((n, l) => n + (l.lich_hoc?.length ?? 0), 0) + 1}`,
      lop_id: lop.id,
      giai_doan_id: body.giai_doan_id,
      buoi_so: buoiSo,
      thoi_gian_bat_dau: body.thoi_gian_bat_dau,
      thoi_gian_ket_thuc: body.thoi_gian_ket_thuc,
      dia_diem_hoac_link: body.dia_diem_hoac_link ?? null,
      trang_thai: 'chua_dien_ra' as const,
      diem_hoc_id: diemHoc?.id ?? null,
      phong: body.phong ?? null,
      diem_hoc: diemHoc,
      giai_doan: giaiDoan,
    };
    lop.lich_hoc = [...(lop.lich_hoc ?? []), moi];
    return HttpResponse.json({ ...moi, canh_bao: [] });
  }),

  http.patch('/lop/:id/lich-hoc/:lichHocId', async ({ params, request }) => {
    const lop = Object.values(db.chiTietKhoa)
      .flatMap((k) => k.lop_hoc)
      .find((l) => l.id === params.id);
    if (!lop) return loi(404, 'NOT_FOUND', 'Không tìm thấy lớp học');
    const lich = (lop.lich_hoc ?? []).find((l) => l.id === params.lichHocId);
    if (!lich) return loi(404, 'NOT_FOUND', 'Không tìm thấy lịch học');
    const body = (await request.json()) as Partial<typeof lich>;
    Object.assign(lich, body);
    return HttpResponse.json(lich);
  }),

  http.post('/lop/:id/nhan-su', async ({ params, request }) => {
    const lop = Object.values(db.chiTietKhoa)
      .flatMap((k) => k.lop_hoc)
      .find((l) => l.id === params.id);
    if (!lop) return loi(404, 'NOT_FOUND', 'Không tìm thấy lớp học');
    const body = (await request.json()) as { ho_ten: string; vai_tro: string; so_dien_thoai?: string };
    const moi = {
      id: `ns-moi-${Object.values(db.chiTietKhoa).flatMap((k) => k.lop_hoc).reduce((n, l) => n + (l.nhan_su?.length ?? 0), 0) + 1}`,
      lop_id: lop.id,
      ho_ten: body.ho_ten,
      vai_tro: body.vai_tro as never,
      so_dien_thoai: body.so_dien_thoai ?? null,
    };
    lop.nhan_su = [...(lop.nhan_su ?? []), moi];
    return HttpResponse.json(moi);
  }),

  http.delete('/lop/:id/nhan-su/:nhanSuId', ({ params }) => {
    const lop = Object.values(db.chiTietKhoa)
      .flatMap((k) => k.lop_hoc)
      .find((l) => l.id === params.id);
    if (!lop) return loi(404, 'NOT_FOUND', 'Không tìm thấy lớp học');
    lop.nhan_su = (lop.nhan_su ?? []).filter((n) => n.id !== params.nhanSuId);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- Đợt xác nhận (quan_tri) — khớp dot-xac-nhan.service.ts thật: GET trả mảng thô (không bọc
  // { data }), sắp xếp mo_luc desc; POST/PATCH lặp lại đúng rule kiemTraChongCheo() (không được chồng
  // thời gian trong CÙNG khoa_id, kể cả cùng null, bất kể loại) + dong_luc phải sau mo_luc. ---
  http.get('/dot-xac-nhan', ({ request }) => {
    const url = new URL(request.url);
    const khoaId = url.searchParams.get('khoa_id');
    let items = db.danhSachDotXacNhan;
    if (khoaId) items = items.filter((d) => d.khoa_id === khoaId);
    const sorted = [...items].sort((a, b) => new Date(b.mo_luc).getTime() - new Date(a.mo_luc).getTime());
    return HttpResponse.json(sorted);
  }),

  http.post('/dot-xac-nhan', async ({ request }) => {
    const body = (await request.json()) as {
      khoa_id?: string;
      ten: string;
      loai: 'kiem_tra_bo_sung' | 'xac_nhan_truoc_danh_gia';
      mo_luc: string;
      dong_luc: string;
    };
    const khoaId = body.khoa_id ?? null;
    const moLuc = new Date(body.mo_luc);
    const dongLuc = new Date(body.dong_luc);
    if (!(dongLuc > moLuc)) {
      return loi(400, 'VALIDATION_ERROR', 'dong_luc phải sau mo_luc', {
        fields: [{ field: 'dong_luc', message: 'Phải sau mo_luc' }],
      });
    }
    const chongCheo = db.danhSachDotXacNhan.some(
      (d) => d.khoa_id === khoaId && new Date(d.mo_luc) < dongLuc && new Date(d.dong_luc) > moLuc,
    );
    if (chongCheo) {
      return loi(409, 'CONFLICT', 'Đợt xác nhận chồng thời gian với đợt khác trong cùng phạm vi (khoa_id)');
    }
    const moi = {
      id: `dot-moi-${db.danhSachDotXacNhan.length + 1}`,
      khoa_id: khoaId,
      ten: body.ten,
      loai: body.loai,
      mo_luc: body.mo_luc,
      dong_luc: body.dong_luc,
      created_by: 'nd-1',
      created_at: new Date().toISOString(),
    };
    db.danhSachDotXacNhan = [moi, ...db.danhSachDotXacNhan];
    return HttpResponse.json(moi);
  }),

  http.patch('/dot-xac-nhan/:id', async ({ params, request }) => {
    const existing = db.danhSachDotXacNhan.find((d) => d.id === params.id);
    if (!existing) return loi(404, 'NOT_FOUND', 'Không tìm thấy đợt xác nhận');
    const body = (await request.json()) as { dong_luc: string };
    const dongLucMoi = new Date(body.dong_luc);
    if (!(dongLucMoi > new Date(existing.mo_luc))) {
      return loi(400, 'VALIDATION_ERROR', 'dong_luc phải sau mo_luc', {
        fields: [{ field: 'dong_luc', message: 'Phải sau mo_luc' }],
      });
    }
    const chongCheo = db.danhSachDotXacNhan.some(
      (d) =>
        d.id !== existing.id &&
        d.khoa_id === existing.khoa_id &&
        new Date(d.mo_luc) < dongLucMoi &&
        new Date(d.dong_luc) > new Date(existing.mo_luc),
    );
    if (chongCheo) {
      return loi(409, 'CONFLICT', 'Đợt xác nhận chồng thời gian với đợt khác trong cùng phạm vi (khoa_id)');
    }
    existing.dong_luc = body.dong_luc;
    db.danhSachDotXacNhan = db.danhSachDotXacNhan.map((d) => (d.id === existing.id ? existing : d));
    return HttpResponse.json(existing);
  }),

  // --- Trung tâm báo cáo (Phase 5 redesign) ---

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

  // Dashboard "Tổng quan hệ thống" (thêm 2026-09-30) — không bọc { rows } như các báo cáo khác
  // (TongQuanResult là 1 object tổng hợp, không phải danh sách hàng).
  http.get('/bao-cao/tong-quan', () => HttpResponse.json(db.baoCaoTongQuan)),
  http.get('/bao-cao/tong-quan/xuat-excel', () => fileMoPhong()),

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

  http.get('/import', () =>
    HttpResponse.json({ data: db.danhSachImport, total: db.danhSachImport.length, page: 1, page_size: 20 }),
  ),

  // --- Yêu cầu hỗ trợ (M8) ---
  http.post('/yeu-cau-ho-tro/toi', async ({ request }) => {
    const body = (await request.json()) as { tinh_huong: string; noi_dung_hoi: string };
    const moi: YeuCauHoTro = {
      id: `yc-${db.danhSachYeuCauHoTro.length + 1}`,
      hoc_vien_id: db.hoSo.id,
      loai_van_de_id: null,
      tinh_huong: body.tinh_huong,
      chu_de: body.tinh_huong,
      noi_dung_hoi: body.noi_dung_hoi,
      noi_dung_tra_loi: null,
      trang_thai: 'cho_xu_ly',
      danh_gia: null,
      da_dong_hieu_luc: false,
      thoi_gian_tao: new Date().toISOString(),
      thoi_gian_phan_hoi: null,
      thoi_gian_dong: null,
      thoi_gian_sua_tra_loi: null,
    };
    db.danhSachYeuCauHoTro = [moi, ...db.danhSachYeuCauHoTro];
    return HttpResponse.json(moi, { status: 201 });
  }),

  http.get('/yeu-cau-ho-tro/toi', () => HttpResponse.json(db.danhSachYeuCauHoTro)),

  http.get('/yeu-cau-ho-tro', ({ request }) => {
    const url = new URL(request.url);
    const trangThai = url.searchParams.get('trang_thai');
    const chuaCoCum = url.searchParams.get('chua_co_cum') === 'true';
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('page_size') ?? '20');

    let items = db.danhSachYeuCauHoTro.map(dongXuLy);
    if (trangThai) items = items.filter((y) => y.trang_thai === trangThai);
    if (chuaCoCum) items = items.filter((y) => y.ten_cum.length === 0);
    const total = items.length;
    const start = (page - 1) * pageSize;
    return HttpResponse.json({ data: items.slice(start, start + pageSize), total, page, page_size: pageSize });
  }),

  http.get('/yeu-cau-ho-tro/:id', ({ params }) => {
    const found = db.danhSachYeuCauHoTro.find((y) => y.id === params.id);
    return found ? HttpResponse.json(dongXuLy(found)) : loi(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ');
  }),

  http.patch('/yeu-cau-ho-tro/:id/tra-loi', async ({ params, request }) => traLoiMau(params.id as string, request)),

  http.patch('/yeu-cau-ho-tro/:id/sua-tra-loi', async ({ params, request }) => {
    const found = db.danhSachYeuCauHoTro.find((y) => y.id === params.id);
    if (!found) return loi(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ');
    if (!found.noi_dung_tra_loi) return loi(409, 'CONFLICT', 'Yêu cầu chưa có câu trả lời để sửa');
    const body = (await request.json()) as { noi_dung_tra_loi: string };
    Object.assign(found, {
      noi_dung_tra_loi: body.noi_dung_tra_loi,
      thoi_gian_sua_tra_loi: new Date().toISOString(),
      danh_gia: null,
      trang_thai: 'da_phan_hoi',
    });
    return HttpResponse.json(found);
  }),

  // Yêu cầu hỗ trợ theo cụm — người hỗ trợ học viên (ADR 0003).
  http.get('/ho-tro-hoc-vien/yeu-cau-ho-tro/dem', () =>
    HttpResponse.json({ cho_xu_ly: db.danhSachYeuCauHoTro.filter((y) => y.trang_thai === 'cho_xu_ly').length }),
  ),
  http.get('/ho-tro-hoc-vien/yeu-cau-ho-tro', ({ request }) => {
    const trangThai = new URL(request.url).searchParams.get('trang_thai');
    const items = db.danhSachYeuCauHoTro.map(dongXuLy).filter((y) => !trangThai || y.trang_thai === trangThai);
    return HttpResponse.json({ data: items, total: items.length, page: 1, page_size: 20 });
  }),
  http.get('/ho-tro-hoc-vien/yeu-cau-ho-tro/:id', ({ params }) => {
    const found = db.danhSachYeuCauHoTro.find((y) => y.id === params.id);
    return found
      ? HttpResponse.json({ ...dongXuLy(found), ticket_truoc: [] })
      : loi(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ');
  }),
  http.patch('/ho-tro-hoc-vien/yeu-cau-ho-tro/:id/tra-loi', async ({ params, request }) => traLoiMau(params.id as string, request)),

  // Tài khoản đơn vị (ADR 0002).
  http.get('/nguoi-dung/don-vi/chua-cap', ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    const ds = db.donViChuaCap.filter(
      (d) => !q || d.ma_don_vi.toLowerCase().includes(q) || d.ten_don_vi.toLowerCase().includes(q),
    );
    return HttpResponse.json(ds.slice(0, 50));
  }),
  http.get('/nguoi-dung/don-vi', ({ request }) => {
    const url = new URL(request.url);
    const vaiTro = url.searchParams.get('vai_tro');
    const data = db.taiKhoanDonVi.filter((t) => !vaiTro || t.vai_tro === vaiTro);
    return HttpResponse.json({ data, total: data.length, page: 1, page_size: 20 });
  }),
  http.post('/nguoi-dung/don-vi', async ({ request }) => {
    const body = (await request.json()) as { don_vi_id: string; ten_dang_nhap?: string; ho_ten?: string; email?: string; cach_cap?: string };
    const dv = db.donViChuaCap.find((d) => d.id === body.don_vi_id)!;
    const tk = {
      id: `tk-${dv.id}`,
      ten_dang_nhap: (body.ten_dang_nhap || dv.ma_don_vi).trim().toLowerCase(),
      ho_ten: body.ho_ten || dv.ten_don_vi,
      email: body.email || null,
      vai_tro: dv.loai_don_vi,
      trang_thai: 'active' as const,
      dang_nhap_lan_cuoi: null,
      don_vi: { id: dv.id, ma_don_vi: dv.ma_don_vi, ten_don_vi: dv.ten_don_vi, loai_don_vi: dv.loai_don_vi, trang_thai: 'active' as const },
    };
    db.taiKhoanDonVi.push(tk);
    db.donViChuaCap = db.donViChuaCap.filter((d) => d.id !== dv.id);
    return HttpResponse.json(
      body.cach_cap === 'email' ? { tai_khoan: tk } : { tai_khoan: tk, mat_khau_tam: 'Ab3dEf7hJk' },
      { status: 201 },
    );
  }),
  http.patch('/nguoi-dung/don-vi/:id', async ({ params, request }) => {
    const tk = db.taiKhoanDonVi.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản đơn vị');
    Object.assign(tk, (await request.json()) as object);
    return HttpResponse.json(tk);
  }),
  http.post('/nguoi-dung/don-vi/:id/cap-mat-khau-tam', ({ params }) => {
    const tk = db.taiKhoanDonVi.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản đơn vị');
    return HttpResponse.json({ ten_dang_nhap: tk.ten_dang_nhap, mat_khau_tam: 'Qw7eRt3yUp' });
  }),
  http.post('/nguoi-dung/don-vi/:id/gui-email-kich-hoat', () => HttpResponse.json({ da_gui: true })),

  // Người hỗ trợ học viên (ADR 0003) — /nguoi-dung/ho-tro.
  http.get('/nguoi-dung/ho-tro', ({ request }) => {
    // Như backend: mặc định chỉ người hỗ trợ học viên (ADR 0004 L1 thêm loại giảng viên).
    const vaiTro = new URL(request.url).searchParams.get('vai_tro') ?? 'ho_tro_hoc_vien';
    const data = db.taiKhoanHoTro.filter((t) => t.vai_tro === vaiTro);
    return HttpResponse.json({ data, total: data.length, page: 1, page_size: 20 });
  }),
  http.post('/nguoi-dung/ho-tro', async ({ request }) => {
    const body = (await request.json()) as {
      ho_ten: string;
      email: string;
      ten_dang_nhap?: string;
      cach_cap?: string;
      vai_tro?: 'ho_tro_hoc_vien' | 'ho_tro_giang_vien';
    };
    const email = body.email.trim().toLowerCase();
    if (db.taiKhoanHoTro.some((t) => t.email === email)) {
      return loi(409, 'CONFLICT', 'Email đã được dùng', { fields: [{ field: 'email', message: 'Email đã được dùng' }] });
    }
    const tk = {
      id: `ht-${db.taiKhoanHoTro.length + 1}`,
      ten_dang_nhap: (body.ten_dang_nhap || email.split('@')[0]).toLowerCase(),
      ho_ten: body.ho_ten,
      email,
      vai_tro: body.vai_tro ?? ('ho_tro_hoc_vien' as const),
      trang_thai: 'active' as const,
      dang_nhap_lan_cuoi: null,
      cum: [],
      khoa: [],
    };
    db.taiKhoanHoTro.push(tk);
    return HttpResponse.json(
      body.cach_cap === 'mat_khau_tam' ? { tai_khoan: tk, mat_khau_tam: 'Ht3dEf7hJk' } : { tai_khoan: tk },
      { status: 201 },
    );
  }),
  http.patch('/nguoi-dung/ho-tro/:id', async ({ params, request }) => {
    const tk = db.taiKhoanHoTro.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản người hỗ trợ');
    Object.assign(tk, (await request.json()) as object);
    return HttpResponse.json(tk);
  }),
  http.post('/nguoi-dung/ho-tro/:id/cap-mat-khau-tam', ({ params }) => {
    const tk = db.taiKhoanHoTro.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản người hỗ trợ');
    return HttpResponse.json({ ten_dang_nhap: tk.ten_dang_nhap, mat_khau_tam: 'Zx8cVb2nMq' });
  }),
  http.post('/nguoi-dung/ho-tro/:id/gui-email-kich-hoat', () => HttpResponse.json({ da_gui: true })),
  http.put('/khoa-boi-duong/:id/cum/:cumId/nguoi-ho-tro', async ({ params, request }) => {
    const khoa = db.chiTietKhoa[params.id as string];
    const cum = khoa?.cum_hoc_vien.find((c) => c.id === params.cumId);
    if (!cum) return loi(404, 'NOT_FOUND', 'Không tìm thấy cụm học viên trong khóa này');
    const { nguoi_dung_ids } = (await request.json()) as { nguoi_dung_ids: string[] };
    cum.nguoi_ho_tro = db.taiKhoanHoTro
      .filter((t) => nguoi_dung_ids.includes(t.id))
      .map((t) => ({ id: t.id, ho_ten: t.ho_ten }));
    return HttpResponse.json({ cum_id: cum.id, nguoi_ho_tro: cum.nguoi_ho_tro });
  }),

  // Khu người hỗ trợ học viên (ADR 0003) — API /ho-tro-hoc-vien/* (trang frontend là /ho-tro/*).
  http.get('/ho-tro-hoc-vien/cum-cua-toi', () => HttpResponse.json(db.hoTroCum)),
  // ADR 0004 G11 (issue #21): số buổi cần nhắc (menu Lịch học).
  http.get('/ho-tro-hoc-vien/nhac-lich/dem', () => HttpResponse.json({ can_nhac: 0 })),
  http.get('/ho-tro-hoc-vien/hoc-vien', () =>
    HttpResponse.json({ data: db.hoTroHocVien, total: db.hoTroHocVien.length, page: 1, page_size: 20 }),
  ),
  http.get('/ho-tro-hoc-vien/hoc-vien/xuat', () =>
    new HttpResponse(new Blob(['xlsx']), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    }),
  ),
  http.get('/ho-tro-hoc-vien/hoc-vien/:id', ({ params }) =>
    params.id === db.hoTroChiTiet.ho_so.id
      ? HttpResponse.json(db.hoTroChiTiet)
      : loi(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ học viên'),
  ),
  http.get('/ho-tro-hoc-vien/lich-hoc', () => HttpResponse.json(db.hoTroLichHoc)),
  http.patch('/ho-tro-hoc-vien/hoc-vien/:id', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.ly_do !== 'string' || body.ly_do.trim().length < 5) {
      return loi(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', {
        fields: [{ field: 'ly_do', message: 'Lý do điều chỉnh từ 5 đến 500 ký tự' }],
      });
    }
    return HttpResponse.json({ ...db.hoTroChiTiet.ho_so, xac_nhan_bi_huy: false });
  }),
  http.post('/ho-tro-hoc-vien/hoc-vien/:id/gui-link-dat-lai-mat-khau', () =>
    db.hoTroChiTiet.tai_khoan?.email_da_xac_minh
      ? HttpResponse.json({ da_gui: true, email: db.hoTroChiTiet.ho_so.email_lien_he })
      : loi(409, 'CONFLICT', 'Email của học viên chưa được xác minh — hãy cấp mật khẩu tạm'),
  ),
  http.post('/ho-tro-hoc-vien/hoc-vien/:id/cap-mat-khau-tam', () =>
    HttpResponse.json({ ten_dang_nhap: db.hoTroChiTiet.tai_khoan?.ten_dang_nhap, mat_khau_tam: 'Hv7tQ2mZp9' }),
  ),
  http.post('/ho-tro-hoc-vien/hoc-vien/:id/mo-khoa-tam', () =>
    HttpResponse.json({ ten_dang_nhap: db.hoTroChiTiet.tai_khoan?.ten_dang_nhap, dang_bi_khoa: false }),
  ),

  // Tài khoản học viên — /nguoi-dung/hoc-vien.
  http.get('/nguoi-dung/hoc-vien', () => {
    const data = db.taiKhoanHocVien;
    return HttpResponse.json({ data, total: data.length, page: 1, page_size: 20 });
  }),
  http.patch('/nguoi-dung/hoc-vien/:id', async ({ params, request }) => {
    const tk = db.taiKhoanHocVien.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
    const body = (await request.json()) as { trang_thai: 'active' | 'ngung' };
    tk.trang_thai = body.trang_thai;
    if (body.trang_thai === 'active') Object.assign(tk, { so_lan_dang_nhap_sai: 0, khoa_den: null });
    return HttpResponse.json(tk);
  }),
  http.post('/nguoi-dung/hoc-vien/:id/mo-khoa-tam', ({ params }) => {
    const tk = db.taiKhoanHocVien.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
    Object.assign(tk, { so_lan_dang_nhap_sai: 0, khoa_den: null });
    return HttpResponse.json(tk);
  }),
  http.post('/nguoi-dung/:id/dat-lai-mat-khau', ({ params }) => {
    const tk = db.taiKhoanHocVien.find((t) => t.id === params.id);
    if (!tk) return loi(404, 'NOT_FOUND', 'Không tìm thấy tài khoản');
    Object.assign(tk, { phai_doi_mat_khau: true, so_lan_dang_nhap_sai: 0, khoa_den: null });
    return HttpResponse.json({
      nguoi_dung: { id: tk.id, ten_dang_nhap: tk.ten_dang_nhap },
      luu_y: 'Mật khẩu đã đặt lại về ngày sinh (định dạng ddmmyyyy) — bắt buộc đổi khi đăng nhập lần đầu.',
    });
  }),
  http.get('/hoc-vien/:id/nhat-ky', () => HttpResponse.json(db.nhatKyHocVien)),
];

export { loi };
