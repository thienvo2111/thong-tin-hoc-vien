import { http, HttpResponse } from 'msw';
import type { DanhSachCuaTruong, TheDotTruong, TrangThaiDanhSachTruong, YKienTruong } from '@/api/truongDanhSach';

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

/** co_the_xac_nhan / ly_do_khong_xac_nhan tự tính từ dong nếu không truyền. */
export function danhSachMau(p: Partial<DanhSachCuaTruong> = {}): DanhSachCuaTruong {
  const ds: DanhSachCuaTruong = {
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
        y_kien_truong: null,
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
        y_kien_truong: null,
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
        y_kien_truong: null,
      },
    ],
    tong_suat: 2.5,
    don_gia: 1_234_567,
    gia_tri_tam_tinh: 3_086_418,
    trang_thai_danh_sach: 'cho_xac_nhan',
    co_the_xac_nhan: false,
    ly_do_khong_xac_nhan: null,
    ...p,
  };
  return 'co_the_xac_nhan' in p ? ds : tinhLai(ds);
}

// Issue #61: bản rút gọn quy tắc X1/X2 của backend (quy-tac-hop-dong.ts) để mock trả đúng trạng thái.
function trangThaiSauYKien(ds: DanhSachCuaTruong): TrangThaiDanhSachTruong {
  const yKien = ds.dong.map((d) => d.y_kien_truong);
  if (yKien.includes('khong_dong_y')) return 'bao_sai_lech';
  if (ds.trang_thai_danh_sach === 'bao_sai_lech') return 'cho_xac_nhan';
  if (ds.trang_thai_danh_sach === 'da_xac_nhan' && !yKien.every((y) => y === 'dong_y')) return 'cho_xac_nhan';
  return ds.trang_thai_danh_sach;
}

function lyDoKhongXacNhan(ds: DanhSachCuaTruong): string | null {
  if (ds.dong.length === 0) return 'Danh sách trống';
  const con = ds.dong.filter((d) => d.y_kien_truong !== 'dong_y').length;
  return con > 0 ? `Còn ${con} dòng chưa Đồng ý` : null;
}

function tinhLai(ds: DanhSachCuaTruong): DanhSachCuaTruong {
  const ly_do_khong_xac_nhan = lyDoKhongXacNhan(ds);
  return { ...ds, co_the_xac_nhan: ly_do_khong_xac_nhan === null, ly_do_khong_xac_nhan };
}

const khongThay = () =>
  HttpResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Không tìm thấy danh sách của trường cho đợt này' } },
    { status: 404 },
  );

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
    return ds ? HttpResponse.json(ds) : khongThay();
  }),
  http.put('/cong-don-vi/truong/dot/:dotId/danh-sach/:dongId/y-kien', async ({ params, request }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const { y_kien } = (await request.json()) as { y_kien: YKienTruong | null };
    const dong = ds.dong.map((d) => (d.id === params.dongId ? { ...d, y_kien_truong: y_kien } : d));
    const moi = { ...ds, dong };
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...moi, trang_thai_danh_sach: trangThaiSauYKien(moi) });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId]);
  }),
  http.post('/cong-don-vi/truong/dot/:dotId/danh-sach/dong-y-tat-ca', ({ params }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const dong = ds.dong.map((d) => (d.y_kien_truong === null ? { ...d, y_kien_truong: 'dong_y' as const } : d));
    const moi = { ...ds, dong };
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...moi, trang_thai_danh_sach: trangThaiSauYKien(moi) });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId]);
  }),
  http.post('/cong-don-vi/truong/dot/:dotId/danh-sach/xac-nhan', ({ params }) => {
    const dotId = params.dotId as string;
    const ds = dbTruongDanhSach.danhSach[dotId];
    if (!ds) return khongThay();
    const lyDo = lyDoKhongXacNhan(ds);
    if (lyDo) return HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: lyDo } }, { status: 400 });
    dbTruongDanhSach.danhSach[dotId] = tinhLai({ ...ds, trang_thai_danh_sach: 'da_xac_nhan' });
    return HttpResponse.json(dbTruongDanhSach.danhSach[dotId]);
  }),
];
