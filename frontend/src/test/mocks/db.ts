import type {
  DanhGiaDauVao,
  DiaDanh,
  DonViCongTac,
  DotXacNhan,
  HocVien,
  HocVienDanhSachItem,
  MonHoc,
  TongHopDonViRow,
} from '@/api/types';

// "CSDL" giả lập trong bộ nhớ cho MSW — mỗi test có thể sửa trực tiếp rồi resetDb() ở afterEach.
export const TINH_AN_GIANG: DiaDanh = { id: 'tinh-1', ma: '89', ten: 'An Giang', cap: 'tinh_thanh', parent_id: null, trang_thai: 'active' };
export const TINH_KHAC: DiaDanh = { id: 'tinh-2', ma: '92', ten: 'Cần Thơ', cap: 'tinh_thanh', parent_id: null, trang_thai: 'active' };
export const PHUONG_1: DiaDanh = { id: 'phuong-1', ma: '001', ten: 'Phường Long Xuyên', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' };
export const PHUONG_2: DiaDanh = { id: 'phuong-2', ma: '002', ten: 'Phường Châu Đốc', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-2', trang_thai: 'active' };

export const DIA_DANH: DiaDanh[] = [TINH_AN_GIANG, TINH_KHAC, PHUONG_1, PHUONG_2];

export const DON_VI: DonViCongTac[] = [
  { id: 'dv-1', ma_don_vi: 'THPT01', ten_don_vi: 'THPT Long Xuyên', loai_don_vi: 'truong', phuong_xa_id: 'phuong-1', ten_phuong_xa: 'Phường Long Xuyên', trang_thai: 'active' },
];

export const MON_HOC: MonHoc[] = [
  { id: 'mh-1', ten_mon: 'Tin học', cap_hoc: 'thpt' },
  { id: 'mh-2', ten_mon: 'Toán', cap_hoc: 'thpt' },
];

export function taoHoSoMoi(): HocVien {
  return {
    id: 'hv-1',
    ma_dinh_danh_moet: '9115131060',
    so_dinh_danh_ca_nhan: null,
    ho_ten: 'nguyễn văn a',
    ngay_sinh: 8,
    thang_sinh: 12,
    nam_sinh: 1983,
    gioi_tinh: null,
    noi_sinh_id: null,
    phuong_xa_id: null,
    don_vi_cong_tac_id: 'dv-1',
    don_vi_cong_tac_ten: 'THPT Long Xuyên — Phường Long Xuyên',
    chuc_vu: 'Giáo viên',
    so_dien_thoai_lien_he: '0912345678',
    email_lien_he: null,
    trinh_do_chuyen_mon: null,
    trinh_do_chuyen_mon_khac: null,
    cap_giang_day: null,
    mon_giang_day_id: null,
    chuyen_mon: [],
    nguon_tao: 'import_moet',
    trang_thai: 'da_duyet',
  };
}

export function taoDotXacNhanDangMoThieu(): DotXacNhan {
  return {
    dot: { id: 'dot-1', ten: 'Kiểm tra hồ sơ đợt 1', loai: 'kiem_tra_bo_sung', mo_luc: '2026-09-01T00:00:00.000Z', dong_luc: '2026-10-04T16:59:59.000Z' },
    dot_sap_mo: null,
    da_xac_nhan: false,
    xac_nhan_luc: null,
    day_du: false,
    thieu: [
      { field: 'so_dinh_danh_ca_nhan', message: 'Chưa có số CCCD' },
      { field: 'noi_sinh_id', message: 'Chưa chọn nơi sinh' },
      { field: 'email_lien_he', message: 'Chưa có email' },
    ],
  };
}

export function taoDanhGiaDauVaoDuDieuKien(): DanhGiaDauVao {
  return {
    du_dieu_kien: true,
    duong_dan: 'https://vle.example.edu.vn/danh-gia-dau-vao',
    ten_dang_nhap_vle: '9115131060',
    mat_khau_tam: 'Tam123456',
  };
}

// Hồ sơ mẫu cho các màn quản trị (AdminTongQuan/AdminDanhSach) — GET /hoc-vien (danh sách) trả bản
// ghi thô, không kèm chuyen_mon/*_ten (xem ghi chú HocVienDanhSachItem trong api/types.ts).
export function taoDanhSachHocVienMau(): HocVienDanhSachItem[] {
  return [
    {
      id: 'hv-cho-1',
      ma_dinh_danh_moet: null,
      so_dinh_danh_ca_nhan: '079090001234',
      ho_ten: 'Lê Văn Bình',
      ngay_sinh: 12,
      thang_sinh: 5,
      nam_sinh: 1988,
      gioi_tinh: 'nam',
      noi_sinh_id: null,
      phuong_xa_id: null,
      don_vi_cong_tac_id: 'dv-1',
      chuc_vu: 'Giáo viên',
      so_dien_thoai_lien_he: '0912340001',
      email_lien_he: 'binh.le@example.edu.vn',
      trinh_do_chuyen_mon: 'dai_hoc',
      trinh_do_chuyen_mon_khac: null,
      cap_giang_day: 'tieu_hoc',
      mon_giang_day_id: null,
      nguon_tao: 'tu_dang_ky',
      trang_thai: 'cho_duyet',
    },
    {
      id: 'hv-cho-2',
      ma_dinh_danh_moet: null,
      so_dinh_danh_ca_nhan: '079091007788',
      ho_ten: 'Phạm Thu Hà',
      ngay_sinh: 3,
      thang_sinh: 9,
      nam_sinh: 1992,
      gioi_tinh: 'nu',
      noi_sinh_id: null,
      phuong_xa_id: null,
      don_vi_cong_tac_id: 'dv-1',
      chuc_vu: 'Giáo viên',
      so_dien_thoai_lien_he: '0912340002',
      email_lien_he: null,
      trinh_do_chuyen_mon: 'dai_hoc',
      trinh_do_chuyen_mon_khac: null,
      cap_giang_day: 'thcs',
      mon_giang_day_id: null,
      nguon_tao: 'tu_dang_ky',
      trang_thai: 'cho_duyet',
    },
    {
      id: 'hv-duyet-1',
      ma_dinh_danh_moet: '9115131099',
      so_dinh_danh_ca_nhan: '079092003345',
      ho_ten: 'Võ Minh Khôi',
      ngay_sinh: 20,
      thang_sinh: 2,
      nam_sinh: 1985,
      gioi_tinh: 'nam',
      noi_sinh_id: null,
      phuong_xa_id: null,
      don_vi_cong_tac_id: 'dv-1',
      chuc_vu: 'Tổ trưởng chuyên môn',
      so_dien_thoai_lien_he: '0912340003',
      email_lien_he: 'khoi.vo@example.edu.vn',
      trinh_do_chuyen_mon: 'thac_si',
      trinh_do_chuyen_mon_khac: null,
      cap_giang_day: 'thpt',
      mon_giang_day_id: null,
      nguon_tao: 'import_moet',
      trang_thai: 'da_duyet',
    },
  ];
}

export function taoBaoCaoTongHopDonViMau(): TongHopDonViRow[] {
  return [
    {
      don_vi_id: 'dv-1',
      ten_don_vi: 'THPT Long Xuyên',
      tong_so: 3,
      theo_trang_thai: { nhap: 0, cho_duyet: 2, da_duyet: 1, tu_choi: 0 },
      theo_cap_giang_day: { tieu_hoc: 1, thcs: 1, thpt: 1 },
    },
  ];
}

export const db = {
  hoSo: taoHoSoMoi(),
  dotXacNhan: taoDotXacNhanDangMoThieu(),
  danhGiaDauVao: taoDanhGiaDauVaoDuDieuKien(),
  soLanDangNhapSai: 0,
  daDangNhap: true,
  // vai_tro cấu hình được cho test module admin — mặc định 'hoc_vien' để không phá test M0-M6.
  nguoiDung: { id: 'nd-1', vai_tro: 'hoc_vien' as string },
  danhSachHocVien: taoDanhSachHocVienMau(),
  baoCaoTongHopDonVi: taoBaoCaoTongHopDonViMau(),
};

export function resetDb(): void {
  db.hoSo = taoHoSoMoi();
  db.dotXacNhan = taoDotXacNhanDangMoThieu();
  db.danhGiaDauVao = taoDanhGiaDauVaoDuDieuKien();
  db.soLanDangNhapSai = 0;
  db.daDangNhap = true;
  db.nguoiDung = { id: 'nd-1', vai_tro: 'hoc_vien' };
  db.danhSachHocVien = taoDanhSachHocVienMau();
  db.baoCaoTongHopDonVi = taoBaoCaoTongHopDonViMau();
}
