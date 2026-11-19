import { http, HttpResponse } from 'msw';
import type { DanhSachCuaTruong, TheDotTruong } from '@/api/truongDanhSach';

// Issue #60: trường xem đợt + danh sách của mình (Cổng đơn vị) — CSDL giả, reset sau mỗi test (setup.ts).
// Tên người/đợt đều bịa.
export function theDotMau(p: Partial<TheDotTruong> = {}): TheDotTruong {
  return {
    dot: {
      id: 'dot-hsg-1',
      ten: 'HSG Đợt Bịa 2026',
      chuong_trinh: 'hsg',
      han_nop: '2026-12-31T16:59:59.000Z',
      han_nop_ngay: '2026-12-31',
    },
    so_nguoi: 3,
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri_tam_tinh: 3_086_418,
    trang_thai_danh_sach: 'cho_xac_nhan',
    trang_thai_hop_dong: 'chua_nop',
    ...p,
  };
}

export function danhSachMau(p: Partial<DanhSachCuaTruong> = {}): DanhSachCuaTruong {
  return {
    dot: theDotMau().dot,
    dong: [
      {
        id: 'd-1',
        ho_ten: 'GV Bịa An',
        ngay_sinh: '1990-02-01',
        gioi_tinh: 'Nữ',
        lop: 'Toán 9',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
      },
      {
        id: 'd-2',
        ho_ten: 'GV Bịa Bình',
        ngay_sinh: null,
        gioi_tinh: null,
        lop: null,
        giai_doan: 'chi_gd1',
        ty_le_suat: 0.5,
        ghi_chu: 'chỉ học GĐ1 (bịa)',
      },
      {
        id: 'd-3',
        ho_ten: 'GV Bịa Chi',
        ngay_sinh: '1985-11-20',
        gioi_tinh: 'Nam',
        lop: 'Văn 8',
        giai_doan: 'ca_hai',
        ty_le_suat: 1,
        ghi_chu: null,
      },
    ],
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri_tam_tinh: 3_086_418,
    trang_thai_danh_sach: 'cho_xac_nhan',
    ...p,
  };
}

export const dbTruongDanhSach = {
  the: [] as TheDotTruong[],
  danhSach: {} as Record<string, DanhSachCuaTruong>,
};

export function datLaiTruongDanhSachMock() {
  dbTruongDanhSach.the = [];
  dbTruongDanhSach.danhSach = {};
}

export const truongDanhSachHandlers = [
  http.get('/cong-don-vi/truong/dot', () => HttpResponse.json(dbTruongDanhSach.the)),
  http.get('/cong-don-vi/truong/dot/:dotId/danh-sach', ({ params }) => {
    const ds = dbTruongDanhSach.danhSach[params.dotId as string];
    if (!ds) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Không tìm thấy danh sách của trường cho đợt này' } },
        { status: 404 },
      );
    }
    return HttpResponse.json(ds);
  }),
];
