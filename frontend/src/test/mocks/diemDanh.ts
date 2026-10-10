import { http, HttpResponse } from 'msw';
import type { BangDiemDanh, ODiemDanh, SuaDiemDanhDto } from '@/api/diemDanh';

// ADR 0005 Z7 (issue #26): bảng điểm danh lớp — dữ liệu nhìn từ hỗ trợ GV (buổi 2 quá 3 ngày, buổi 3 chưa diễn ra).
function taoBangMau(): BangDiemDanh {
  return {
    lop: { id: 'lop-1', ten_lop: 'Lớp 01 – Nhóm cơ bản A', loai_lop: 'zoom', khoa: { id: 'khoa-1', ma_khoa: 'AG-2026-014', ten_khoa: 'Khóa An Giang' } },
    giai_doan: [
      { id: 'gd-1', thu_tu: 1, ten_giai_doan: 'Học Zoom', hinh_thuc: 'truc_tuyen' },
      { id: 'gd-2', thu_tu: 2, ten_giai_doan: 'Học trực tiếp', hinh_thuc: 'truc_tiep' },
    ],
    giai_doan_id: 'gd-1',
    buoi: [
      { id: 'b-1', buoi_so: 1, thoi_gian_bat_dau: '2026-10-09T00:30:00.000Z', thoi_gian_ket_thuc: '2026-10-09T03:30:00.000Z', sua_duoc: true, ly_do: null },
      { id: 'b-2', buoi_so: 2, thoi_gian_bat_dau: '2026-10-01T00:30:00.000Z', thoi_gian_ket_thuc: '2026-10-01T03:30:00.000Z', sua_duoc: false, ly_do: 'qua_han' },
      { id: 'b-3', buoi_so: 3, thoi_gian_bat_dau: '2026-10-20T00:30:00.000Z', thoi_gian_ket_thuc: '2026-10-20T03:30:00.000Z', sua_duoc: false, ly_do: 'chua_dien_ra' },
    ],
    hoc_vien: [
      {
        dang_ky_hoc_id: 'dk-1',
        ho_ten: 'Trần Thị Học',
        don_vi: 'THPT Long Xuyên',
        diem_danh: {
          'b-1': { trang_thai: 'co_mat', nguon: 'zoom', ghi_chu: null, tu_diem_danh_luc: '2026-10-09T00:12:00.000Z', cap_nhat_luc: '2026-10-09T00:12:00.000Z', nguoi_sua: null },
          'b-2': { trang_thai: 'vang', nguon: 'zoom', ghi_chu: null, tu_diem_danh_luc: null, cap_nhat_luc: '2026-10-01T03:00:00.000Z', nguoi_sua: null },
        },
        bao_vang: {},
      },
      {
        dang_ky_hoc_id: 'dk-2',
        ho_ten: 'Lê Văn Vắng',
        don_vi: 'THCS Mỹ Bình',
        diem_danh: {},
        bao_vang: { 'b-1': 'Ốm' },
      },
    ],
  };
}

export let bangDiemDanhMock = taoBangMau();
export const bangDiemDanhGd2: BangDiemDanh = { ...taoBangMau(), giai_doan_id: 'gd-2', buoi: [], hoc_vien: [] };

export function datLaiDiemDanhMock() {
  bangDiemDanhMock = taoBangMau();
}

export const diemDanhHandlers = [
  http.get('/lop/:lopId/diem-danh', ({ request }) => {
    const gd = new URL(request.url).searchParams.get('giai_doan_id');
    return HttpResponse.json(gd === 'gd-2' ? bangDiemDanhGd2 : bangDiemDanhMock);
  }),
  http.put('/lop/:lopId/diem-danh', async ({ request }) => {
    const body = (await request.json()) as SuaDiemDanhDto;
    const buoi = bangDiemDanhMock.buoi.find((b) => b.id === body.lich_hoc_id);
    if (!buoi?.sua_duoc) {
      return HttpResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Đã quá 3 ngày sau buổi học — liên hệ Quản trị để sửa điểm danh' } },
        { status: 403 },
      );
    }
    const hv = bangDiemDanhMock.hoc_vien.find((h) => h.dang_ky_hoc_id === body.dang_ky_hoc_id);
    if (!hv) {
      return HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Học viên không thuộc lớp' } }, { status: 400 });
    }
    const cu = hv.diem_danh[body.lich_hoc_id];
    const o: ODiemDanh = {
      trang_thai: body.trang_thai,
      nguon: 'thu_cong',
      ghi_chu: body.ghi_chu ?? null,
      tu_diem_danh_luc: cu?.tu_diem_danh_luc ?? null,
      cap_nhat_luc: new Date().toISOString(),
      nguoi_sua: 'Phạm Văn Giảng',
    };
    hv.diem_danh[body.lich_hoc_id] = o;
    return HttpResponse.json({ ...o, dang_ky_hoc_id: body.dang_ky_hoc_id, lich_hoc_id: body.lich_hoc_id });
  }),
];
