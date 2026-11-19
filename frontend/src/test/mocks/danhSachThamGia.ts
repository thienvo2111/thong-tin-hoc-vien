import { http, HttpResponse } from 'msw';
import type { DanhSachThamGia, DongXemTruoc, KetQuaXemTruoc, TruongPhamVi } from '@/api/danhSachThamGia';

// Issue #58: danh sách tham gia HSG (Cổng đơn vị) — CSDL giả trong bộ nhớ, reset sau mỗi test (setup.ts).
// Tên người/trường đều bịa.
export const TRUONG_PHAM_VI: TruongPhamVi[] = [
  { id: 'tr-1', ma_don_vi: 'TR-MAU-001', ten_don_vi: 'Trường THCS Mẫu Một' },
  { id: 'tr-2', ma_don_vi: null, ten_don_vi: 'Trường THCS&THPT Mẫu Hai' },
  { id: 'tr-3', ma_don_vi: 'TR-MAU-003', ten_don_vi: 'Trường TH Mẫu Ba' },
];

export function dongXemTruocMau(p: Partial<DongXemTruoc> = {}): DongXemTruoc {
  return {
    so_dong: 3,
    ho_ten: 'GV Bịa',
    ngay_sinh: null,
    gioi_tinh: null,
    ma_goc: null,
    lop: null,
    ma_truong: null,
    ten_truong: null,
    giai_doan: 'ca_hai',
    ty_le_suat: 1,
    ghi_chu: null,
    trang_thai_khop: 'khop_ma',
    don_vi_id: 'tr-1',
    ten_don_vi_khop: 'Trường THCS Mẫu Một',
    loi: [],
    ...p,
  };
}

/** Kết quả xem trước mặc định: đủ 5 trạng thái + 1 dòng lỗi. */
export function xemTruocMau(): KetQuaXemTruoc {
  const dong = [
    dongXemTruocMau({
      so_dong: 3,
      ho_ten: 'GV Bịa Một',
      ngay_sinh: '1990-02-01',
      gioi_tinh: 'Nam',
      lop: 'Lớp A',
      ma_truong: 'TR-MAU-001',
      ghi_chu: 'ghi chú bịa',
    }),
    dongXemTruocMau({
      so_dong: 4,
      ho_ten: 'GV Bịa Hai',
      ten_truong: 'THCS và THPT Mẫu Hai',
      giai_doan: 'chi_gd2',
      ty_le_suat: 0.5,
      trang_thai_khop: 'khop_ten',
      don_vi_id: 'tr-2',
      ten_don_vi_khop: 'Trường THCS&THPT Mẫu Hai',
    }),
    dongXemTruocMau({
      so_dong: 5,
      ho_ten: 'GV Bịa Ba',
      ten_truong: 'Trường Không Có',
      trang_thai_khop: 'khong_khop',
      don_vi_id: null,
      ten_don_vi_khop: null,
    }),
    dongXemTruocMau({
      so_dong: 6,
      ho_ten: 'GV Bịa Bốn',
      ten_truong: 'Trường Trùng Tên',
      giai_doan: 'chi_gd1',
      ty_le_suat: 0.5,
      trang_thai_khop: 'nhieu_ket_qua',
      don_vi_id: null,
      ten_don_vi_khop: null,
    }),
    dongXemTruocMau({
      so_dong: 7,
      ho_ten: 'GV Bịa Năm',
      trang_thai_khop: 'thieu_truong',
      don_vi_id: null,
      ten_don_vi_khop: null,
    }),
    dongXemTruocMau({
      so_dong: 8,
      ho_ten: 'GV Bịa Sáu',
      ma_truong: 'TR-MAU-001',
      giai_doan: null,
      ty_le_suat: null,
      loi: ['Giai đoạn tham gia "Chỉ GĐ5" không hợp lệ'],
    }),
  ];
  return {
    dong,
    tong_hop: { tong: 6, khop_ma: 2, khop_ten: 1, khong_khop: 1, thieu_truong: 1, nhieu_ket_qua: 1, loi: 1 },
  };
}

export const dbDanhSachThamGia = {
  xemTruoc: xemTruocMau(),
  danhSach: { tong_hop: [], dong: [] } as DanhSachThamGia,
};

export function datLaiDanhSachThamGiaMock() {
  dbDanhSachThamGia.xemTruoc = xemTruocMau();
  dbDanhSachThamGia.danhSach = { tong_hop: [], dong: [] };
}

const URL = '/cong-don-vi/dot-trien-khai/:id';

export const danhSachThamGiaHandlers = [
  http.get(`${URL}/truong-trong-pham-vi`, () => HttpResponse.json(TRUONG_PHAM_VI)),
  http.get(`${URL}/danh-sach`, () => HttpResponse.json(dbDanhSachThamGia.danhSach)),
  http.post(`${URL}/danh-sach/xem-truoc`, () => HttpResponse.json(dbDanhSachThamGia.xemTruoc)),
  http.post(`${URL}/danh-sach/nap`, async ({ request }) => {
    const { dong } = (await request.json()) as { dong: { don_vi_id: string; ty_le_suat: number }[] };
    return HttpResponse.json({
      so_truong: new Set(dong.map((d) => d.don_vi_id)).size,
      so_dong: dong.length,
      tong_suat: dong.reduce((t, d) => t + d.ty_le_suat, 0),
    });
  }),
  http.get(
    `${URL}/danh-sach/mau-excel`,
    () =>
      new HttpResponse(new Blob(['xlsx']), {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
];
