import { http, HttpResponse } from 'msw';
import type {
  BoLocResult,
  CanDonDocResult,
  ChuyenCanResult,
  ChuyenMucResult,
  KetQuaHocCot,
  KhaoSatResult,
  PheuResult,
  SoSanhKhoaCot,
  TienDoTruongDong,
  XepHangResult,
} from '@/api/types';

export const boLocQuanTri: BoLocResult = {
  khoa: [
    { id: 'khoa-1', ten_khoa: 'Khóa 1' },
    { id: 'khoa-2', ten_khoa: 'Khóa 2' },
  ],
  don_vi: [
    { id: 'dv-1', ten_don_vi: 'Sở GD&ĐT An Giang', loai_don_vi: 'so_gddt' },
    { id: 'dv-2', ten_don_vi: 'Trường THPT Long Xuyên', loai_don_vi: 'truong' },
  ],
  cum: [
    { id: 'cum-1', ten_cum: 'Cụm Long Xuyên', khoa_id: 'khoa-1' },
    { id: 'cum-2', ten_cum: 'Cụm Châu Đốc', khoa_id: 'khoa-2' },
  ],
  don_vi_co_dinh: null,
};

export const pheuMau: PheuResult = {
  tham_gia: 200,
  da_truy_cap: 150,
  khao_sat_ky_nang_so: 100,
  danh_gia_dau_vao: 90,
  danh_gia_dau_ra: 45,
  ho_so_cho_duyet: 7,
};

export const khaoSatMau: KhaoSatResult = {
  ky_nang_so: { hoan_thanh: 100, chua: 100 },
  dau_vao: {
    theo_muc: [
      { ma: 'M1', nhan: 'M1 – Chưa đạt', so_luong: 10 },
      { ma: 'M2', nhan: 'M2 – Cơ bản', so_luong: 30 },
      { ma: 'M3', nhan: 'M3 – Thành thạo', so_luong: 35 },
      { ma: 'M4', nhan: 'M4 – Nâng cao', so_luong: 10 },
    ],
    chua_xep_muc: 5,
    chua_lam: 110,
  },
  dau_ra: {
    theo_muc: [
      { ma: 'M1', nhan: 'M1 – Chưa đạt', so_luong: 2 },
      { ma: 'M2', nhan: 'M2 – Cơ bản', so_luong: 10 },
      { ma: 'M3', nhan: 'M3 – Thành thạo', so_luong: 20 },
      { ma: 'M4', nhan: 'M4 – Nâng cao', so_luong: 12 },
    ],
    chua_xep_muc: 1,
    chua_lam: 155,
  },
};

const thangMau = [
  { ma: 'M1', nhan: 'M1' },
  { ma: 'M2', nhan: 'M2' },
  { ma: 'M3', nhan: 'M3' },
  { ma: 'M4', nhan: 'M4' },
];

export const chuyenMucMau: ChuyenMucResult = {
  thang: thangMau,
  o: thangMau.flatMap((tu) =>
    thangMau.map((den) => ({ tu: tu.ma, den: den.ma, so_luong: tu.ma === den.ma ? 5 : 1 })),
  ),
  tong: 32,
  tang: 6,
  giu: 20,
  giam: 6,
};

export const ketQuaHocMau: KetQuaHocCot[] = [
  { khoa_id: 'khoa-1', ten_khoa: 'Khóa 1', dat: 60, khong_dat: 10, vang: 5, dang_hoc: 25 },
  { khoa_id: 'khoa-2', ten_khoa: 'Khóa 2', dat: 40, khong_dat: 5, vang: 5, dang_hoc: 50 },
];

export const soSanhKhoaMau: SoSanhKhoaCot[] = [
  { khoa_id: 'khoa-1', ten_khoa: 'Khóa 1', tham_gia: 100, ty_le_truy_cap: 0.8, ty_le_dau_vao: 0.5, ty_le_dat: 0.6 },
  { khoa_id: 'khoa-2', ten_khoa: 'Khóa 2', tham_gia: 100, ty_le_truy_cap: 0.7, ty_le_dau_vao: 0.4, ty_le_dat: null },
];

export const chuyenCanMau: ChuyenCanResult = {
  truc_tiep: [
    { nhan: 'Buổi 1', giai_doan_thu_tu: 1, buoi_so: 1, co_mat: 80, vang_co_phep: 5, vang: 15, ty_le_co_mat: 0.8 },
    { nhan: 'Buổi 2', giai_doan_thu_tu: 1, buoi_so: 2, co_mat: 70, vang_co_phep: 10, vang: 20, ty_le_co_mat: 0.7 },
  ],
  vle: {
    khoang: [
      { khoang: '0-25', so_luong: 10 },
      { khoang: '25-50', so_luong: 20 },
      { khoang: '50-75', so_luong: 30 },
      { khoang: '75-100', so_luong: 40 },
    ],
    chua_co_du_lieu: 5,
  },
};

export const xepHangMau: XepHangResult = {
  kieu: 'bang',
  top: [{ don_vi_id: 'dv-2', ten_don_vi: 'Trường THPT Long Xuyên', so_hv: 30, gia_tri: 0.9 }],
  bottom: [{ don_vi_id: 'dv-3', ten_don_vi: 'Trường THCS Châu Đốc', so_hv: 12, gia_tri: 0.3 }],
  tong_so: 2,
};

export const canDonDocMau: CanDonDocResult = {
  tong: 1,
  page: 1,
  items: [
    {
      hoc_vien_id: 'hv-1',
      ho_ten: 'Nguyễn Văn An',
      ten_don_vi: 'Trường THPT Long Xuyên',
      ten_khoa: 'Khóa 1',
      so_dien_thoai: '0900000001',
      email: 'an@example.com',
      chi_tiet: 'Vắng 3 buổi',
    },
  ],
};

const dongTienDo = (
  don_vi_id: string,
  ten_don_vi: string,
  so_hv: number,
  ty_le_truy_cap: number | null,
  ty_le_dat: number | null,
): TienDoTruongDong => ({
  don_vi_id,
  ten_don_vi,
  ten_don_vi_cha: 'Sở GD&ĐT An Giang',
  so_hv,
  so_truy_cap: ty_le_truy_cap === null ? 0 : Math.round(ty_le_truy_cap * so_hv),
  ty_le_truy_cap,
  so_ky_nang_so: Math.round(0.6 * so_hv),
  ty_le_ky_nang_so: 0.6,
  so_dau_vao: Math.round(0.55 * so_hv),
  ty_le_dau_vao: 0.55,
  so_dau_ra: Math.round(0.3 * so_hv),
  ty_le_dau_ra: 0.3,
  so_luot_diem_danh: 20,
  so_luot_co_mat: 17,
  ty_le_co_mat: 0.85,
  so_hv_co_vle: 10,
  so_hv_vle_dat: 5,
  ty_le_vle_dat: 0.5,
  so_dang_ky: so_hv,
  so_dat: ty_le_dat === null ? 0 : Math.round(ty_le_dat * so_hv),
  ty_le_dat,
});

export const tienDoTruongMau: TienDoTruongDong[] = [
  dongTienDo('dv-a', 'Trường THPT Nguyễn Du', 40, 0.9, 0.3),
  dongTienDo('dv-b', 'Trường THCS Lê Lợi', 25, 0.4, null),
  dongTienDo('dv-c', 'Trường Tiểu học Trần Phú', 30, 0.6, 0.9),
  dongTienDo('dv-d', 'Trường THPT Phan Chu Trinh', 12, null, 0.5),
];

export const thongKeHandlers = [
  http.get(
    '/thong-ke/tien-do-truong/xuat-excel',
    () =>
      new HttpResponse('noi-dung-file-mo-phong', {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
  http.get('/thong-ke/tien-do-truong', () => HttpResponse.json(tienDoTruongMau)),
  http.get('/thong-ke/bo-loc', () => HttpResponse.json(boLocQuanTri)),
  http.get('/thong-ke/pheu', () => HttpResponse.json(pheuMau)),
  http.get('/thong-ke/khao-sat', () => HttpResponse.json(khaoSatMau)),
  http.get('/thong-ke/chuyen-muc', () => HttpResponse.json(chuyenMucMau)),
  http.get('/thong-ke/ket-qua', () => HttpResponse.json(ketQuaHocMau)),
  http.get('/thong-ke/so-sanh-khoa', () => HttpResponse.json(soSanhKhoaMau)),
  http.get('/thong-ke/chuyen-can', () => HttpResponse.json(chuyenCanMau)),
  http.get('/thong-ke/xep-hang', () => HttpResponse.json(xepHangMau)),
  http.get(
    '/thong-ke/can-don-doc/xuat-excel',
    () =>
      new HttpResponse('noi-dung-file-mo-phong', {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
  http.get('/thong-ke/can-don-doc', () => HttpResponse.json(canDonDocMau)),
];
