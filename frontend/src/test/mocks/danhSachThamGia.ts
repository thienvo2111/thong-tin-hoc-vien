import { http, HttpResponse } from 'msw';
import type {
  DanhSachThamGia,
  DongXemTruoc,
  KetQuaLayTuKhoa,
  KetQuaXemTruoc,
  TruongPhamVi,
  XemTruocChup,
} from '@/api/danhSachThamGia';

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

/** Issue #68: xem trước "Lấy danh sách từ khóa" — tr-1 đã nộp (giữ nguyên), tr-2 có đề nghị chờ, tr-3 bị xóa hết. */
export function xemTruocChupMau(): XemTruocChup {
  const truong = (p: Partial<XemTruocChup['truong'][number]>) => ({
    don_vi_id: 'tr-1',
    ten: 'Trường THCS Mẫu Một',
    ma: 'TR-MAU-001',
    so_dong_moi: 0,
    so_dong_cu: 0,
    tong_suat_moi: 0,
    da_nop: false,
    co_de_nghi_cho: false,
    ...p,
  });
  const tr3 = truong({ don_vi_id: 'tr-3', ten: 'Trường TH Mẫu Ba', ma: 'TR-MAU-003', so_dong_cu: 2 });
  return {
    so_khoa: 2,
    so_dong: 5,
    so_truong: 2,
    tong_suat: 4,
    truong: [
      truong({ so_dong_moi: 3, so_dong_cu: 3, tong_suat_moi: 2.5, da_nop: true }),
      truong({
        don_vi_id: 'tr-2',
        ten: 'Trường THCS&THPT Mẫu Hai',
        ma: null,
        so_dong_moi: 2,
        so_dong_cu: 1,
        tong_suat_moi: 1.5,
        co_de_nghi_cho: true,
      }),
      tr3,
    ],
    bo_qua: {
      chua_phan_lop: 4,
      ngoai_pham_vi: [
        {
          hoc_vien_id: 'hv-x',
          ho_ten: 'GV Bịa Ngoài',
          don_vi_ten: 'Phòng Bịa',
          ly_do: 'Đơn vị công tác không phải trường',
        },
      ],
      trung_khoa: 1,
    },
    truong_bi_xoa: [tr3],
  };
}

export const dbDanhSachThamGia = {
  xemTruoc: xemTruocMau(),
  danhSach: { tong_hop: [], dong: [] } as DanhSachThamGia,
  xemTruocChup: xemTruocChupMau(),
};

export function datLaiDanhSachThamGiaMock() {
  dbDanhSachThamGia.xemTruoc = xemTruocMau();
  dbDanhSachThamGia.danhSach = { tong_hop: [], dong: [] };
  dbDanhSachThamGia.xemTruocChup = xemTruocChupMau();
}

const URL = '/cong-don-vi/dot-trien-khai/:id';

export const danhSachThamGiaHandlers = [
  http.get(`${URL}/truong-trong-pham-vi`, () => HttpResponse.json(TRUONG_PHAM_VI)),
  http.get(`${URL}/danh-sach`, () => HttpResponse.json(dbDanhSachThamGia.danhSach)),
  http.post(`${URL}/danh-sach/xem-truoc`, () => HttpResponse.json(dbDanhSachThamGia.xemTruoc)),
  // Issue #68: đợt NLS — chụp danh sách từ khóa.
  http.post(`${URL}/danh-sach/lay-tu-khoa/xem-truoc`, () => HttpResponse.json(dbDanhSachThamGia.xemTruocChup)),
  http.post(`${URL}/danh-sach/lay-tu-khoa`, () => {
    const xt = dbDanhSachThamGia.xemTruocChup;
    const thay = xt.truong.filter((t) => !t.da_nop);
    const kq: KetQuaLayTuKhoa = {
      so_khoa: xt.so_khoa,
      so_dong: xt.so_dong,
      so_truong: xt.so_truong,
      bo_qua: xt.bo_qua,
      so_dong_da_ghi: thay.reduce((t, x) => t + x.so_dong_moi, 0),
      so_truong_da_thay: thay.length,
      so_de_nghi_tu_choi: 1,
      giu_nguyen_da_nop: xt.truong.filter((t) => t.da_nop).map((t) => ({ don_vi_id: t.don_vi_id, ten_don_vi: t.ten })),
    };
    return HttpResponse.json(kq);
  }),
  http.post(`${URL}/danh-sach/nap`, async ({ request }) => {
    const { dong } = (await request.json()) as { dong: { don_vi_id: string; ty_le_suat: number }[] };
    return HttpResponse.json({
      so_truong: new Set(dong.map((d) => d.don_vi_id)).size,
      so_dong: dong.length,
      tong_suat: dong.reduce((t, d) => t + d.ty_le_suat, 0),
    });
  }),
  // Issue #59: sửa/thêm/xóa dòng + xuất Excel.
  http.post(`${URL}/danh-sach`, async ({ request }) => {
    const { ly_do: _lyDo, ...dong } = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: 'd-moi', y_kien_truong: null, hoc_vien_id: null, ...dong }, { status: 201 });
  }),
  http.patch('/cong-don-vi/danh-sach-tham-gia/:dongId', async ({ params, request }) => {
    const { ly_do: _lyDo, ...doi } = (await request.json()) as Record<string, unknown>;
    const cu = dbDanhSachThamGia.danhSach.dong.find((d) => d.id === params.dongId);
    if (!cu) return HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy' } }, { status: 404 });
    return HttpResponse.json({ ...cu, ...doi, y_kien_truong: null });
  }),
  http.delete('/cong-don-vi/danh-sach-tham-gia/:dongId', () => new HttpResponse(null, { status: 204 })),
  http.get(
    `${URL}/danh-sach/xuat-excel`,
    () =>
      new HttpResponse(new Blob(['xlsx']), {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
  http.get(
    `${URL}/danh-sach/mau-excel`,
    () =>
      new HttpResponse(new Blob(['xlsx']), {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
];
