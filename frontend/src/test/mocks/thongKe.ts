import { http, HttpResponse } from 'msw';
import type {
  BoLocResult,
  CanDonDocResult,
  ChatLuongHoSoDong,
  ChatLuongHoSoResult,
  MucNlsResult,
  MucNlsTruongDong,
  ChuyenCanResult,
  ChuyenMucResult,
  KetQuaHocCot,
  KetQuaHocTruongDong,
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

export const ketQuaHocTruongMau: KetQuaHocTruongDong[] = [
  { don_vi_id: 'dv-1', ten_don_vi: 'Trường Tiểu học Cẩm Hà', dat: 12, khong_dat: 3, vang: 2, dang_hoc: 33 },
  { don_vi_id: 'dv-2', ten_don_vi: 'Trường THCS Minh Khai', dat: 30, khong_dat: 5, vang: 0, dang_hoc: 5 },
  { don_vi_id: 'dv-3', ten_don_vi: 'Trường THPT An Phú', dat: 10, khong_dat: 10, vang: 5, dang_hoc: 25 },
  { don_vi_id: 'dv-4', ten_don_vi: 'Trường Mầm non Hoa Mai', dat: 20, khong_dat: 0, vang: 0, dang_hoc: 0 },
  { don_vi_id: 'dv-5', ten_don_vi: 'Trường Tiểu học Lê Lợi', dat: 18, khong_dat: 2, vang: 0, dang_hoc: 10 },
  { don_vi_id: 'dv-6', ten_don_vi: 'Trường THCS Trống', dat: 0, khong_dat: 0, vang: 0, dang_hoc: 0 },
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
  ghiDe: Partial<TienDoTruongDong> = {},
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
  ...ghiDe,
});

export const tienDoTruongMau: TienDoTruongDong[] = [
  dongTienDo('dv-a', 'Trường THPT Nguyễn Du', 40, 0.9, 0.3),
  dongTienDo('dv-b', 'Trường THCS Lê Lợi', 25, 0.4, null, {
    so_luot_diem_danh: 4,
    so_luot_co_mat: 3,
    ty_le_co_mat: 0.75,
  }),
  dongTienDo('dv-c', 'Trường Tiểu học Trần Phú', 30, 0.6, 0.9, { so_dau_ra: 3, ty_le_dau_ra: 0.1 }),
  dongTienDo('dv-d', 'Trường THPT Phan Chu Trinh', 12, null, 0.5, {
    so_luot_diem_danh: 0,
    so_luot_co_mat: 0,
    ty_le_co_mat: null,
  }),
];

const dongHoSo = (
  don_vi_id: string,
  ten_don_vi: string,
  so_hv: number,
  thieu: [number, number, number, number],
  du_ho_so: number,
): ChatLuongHoSoDong => ({
  don_vi_id,
  ten_don_vi,
  ten_don_vi_cha: 'Sở GD&ĐT An Giang',
  so_hv,
  thieu_doi_tuong: thieu[0],
  thieu_cap: thieu[1],
  thieu_email: thieu[2],
  thieu_sdt: thieu[3],
  du_ho_so,
  ty_le_du: so_hv === 0 ? null : du_ho_so / so_hv,
});

export const chatLuongHoSoMau: ChatLuongHoSoResult = {
  tong: {
    so_hv: 100,
    thieu_doi_tuong: 20,
    thieu_cap: 30,
    thieu_email: 40,
    thieu_sdt: 10,
    du_ho_so: 50,
    ty_le_du: 0.5,
  },
  theo_truong: [
    dongHoSo('dv-a', 'Trường THPT Nguyễn Du', 40, [5, 10, 20, 2], 20),
    dongHoSo('dv-b', 'Trường THCS Lê Lợi', 25, [10, 12, 15, 5], 5),
    dongHoSo('dv-c', 'Trường Tiểu học Trần Phú', 30, [5, 8, 5, 3], 24),
    dongHoSo('dv-d', 'Trường THPT Phan Chu Trinh', 5, [0, 0, 3, 0], 2),
    dongHoSo('dv-e', 'Trường Mầm non Hoa Sen', 0, [0, 0, 0, 0], 0),
  ],
};

const THANG_MAU = [
  { ma: 'M1', nhan: 'Chưa đạt' },
  { ma: 'M2', nhan: 'Cơ bản' },
  { ma: 'M3', nhan: 'Thành thạo' },
  { ma: 'M4', nhan: 'Nâng cao' },
];

const dongMucNls = (
  don_vi_id: string,
  ten_don_vi: string,
  so_hv: number,
  muc: [number, number, number, number],
  chua_xep_muc: number,
  chua_lam: number,
): MucNlsTruongDong => ({
  don_vi_id,
  ten_don_vi,
  ten_don_vi_cha: 'Sở GD&ĐT An Giang',
  so_hv,
  da_lam: so_hv - chua_lam,
  chua_lam,
  theo_muc: THANG_MAU.map((m, i) => ({ ...m, so_luong: muc[i] })),
  chua_xep_muc,
});

export const mucNlsDauVaoMau: MucNlsResult = {
  loai: 'dau_vao',
  thang: THANG_MAU,
  tong: {
    so_hv: 100,
    da_lam: 61,
    chua_lam: 39,
    theo_muc: THANG_MAU.map((m, i) => ({ ...m, so_luong: [6, 21, 22, 10][i] })),
    chua_xep_muc: 2,
  },
  theo_truong: [
    dongMucNls('dv-a', 'Trường THPT Nguyễn Du', 40, [3, 12, 10, 4], 1, 10),
    dongMucNls('dv-b', 'Trường THCS Lê Lợi', 25, [1, 2, 1, 0], 1, 20),
    dongMucNls('dv-c', 'Trường Tiểu học Trần Phú', 30, [2, 6, 10, 6], 0, 6),
    dongMucNls('dv-d', 'Trường THPT Phan Chu Trinh', 5, [0, 1, 1, 0], 0, 3),
    dongMucNls('dv-e', 'Trường Mầm non Hoa Sen', 0, [0, 0, 0, 0], 0, 0),
  ],
};

export const mucNlsDauRaMau: MucNlsResult = {
  loai: 'dau_ra',
  thang: THANG_MAU,
  tong: {
    so_hv: 40,
    da_lam: 8,
    chua_lam: 32,
    theo_muc: THANG_MAU.map((m, i) => ({ ...m, so_luong: [0, 1, 3, 4][i] })),
    chua_xep_muc: 0,
  },
  theo_truong: [dongMucNls('dv-a', 'Trường THPT Nguyễn Du', 40, [0, 1, 3, 4], 0, 32)],
};

export const thongKeHandlers = [
  http.get(
    '/thong-ke/muc-nls/xuat-excel',
    () =>
      new HttpResponse('noi-dung-file-mo-phong', {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
  http.get('/thong-ke/muc-nls', ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('loai') === 'dau_ra' ? mucNlsDauRaMau : mucNlsDauVaoMau,
    ),
  ),
  http.get(
    '/thong-ke/chat-luong-ho-so/xuat-excel',
    () =>
      new HttpResponse('noi-dung-file-mo-phong', {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      }),
  ),
  http.get('/thong-ke/chat-luong-ho-so', () => HttpResponse.json(chatLuongHoSoMau)),
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
  http.get('/thong-ke/ket-qua-theo-truong', () => HttpResponse.json(ketQuaHocTruongMau)),
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
