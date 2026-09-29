import type {
  BaoCaoRow,
  DanhGiaDauVao,
  DiaDanh,
  DonViCongTac,
  DotXacNhan,
  DotXacNhanDanhMuc,
  HocVien,
  HocVienDanhSachItem,
  ImportChiTiet,
  KhoaBoiDuong,
  KhoaBoiDuongChiTiet,
  MonHoc,
  NhatKyImportItem,
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

// Khóa bồi dưỡng mẫu cho AdminKhoaBoiDuong/AdminKhoaChiTiet (Phase 4 redesign). GET /khoa-boi-duong
// (danh sách) trả bản ghi thô — chi tiết (giai_doan/lop_hoc) chỉ có ở GET /khoa-boi-duong/{id}, xem
// taoChiTietKhoaMau bên dưới, khớp khoa-boi-duong.service.ts#findAll/findOne thật.
export function taoDanhSachKhoaMau(): KhoaBoiDuong[] {
  return [
    {
      id: 'khoa-1',
      ma_khoa: 'AG-2026-014',
      ten_khoa: 'Bồi dưỡng NLS – Mức cơ bản',
      don_vi_to_chuc_id: 'dv-1',
      dia_diem: null,
      thoi_gian_bat_dau: '2026-10-05',
      thoi_gian_ket_thuc: '2026-11-20',
      trang_thai: 'cho_duyet',
      nguoi_duyet_id: null,
      cap_duyet_thuc_te: null,
      ngay_duyet: null,
      created_at: '2026-09-20T00:00:00.000Z',
      updated_at: '2026-09-20T00:00:00.000Z',
      created_by: 'nd-1',
    },
    {
      id: 'khoa-2',
      ma_khoa: 'AG-2026-015',
      ten_khoa: 'Bồi dưỡng NLS – Mức thành thạo',
      don_vi_to_chuc_id: 'dv-1',
      dia_diem: null,
      thoi_gian_bat_dau: '2026-10-12',
      thoi_gian_ket_thuc: '2026-11-28',
      trang_thai: 'nhap',
      nguoi_duyet_id: null,
      cap_duyet_thuc_te: null,
      ngay_duyet: null,
      created_at: '2026-09-21T00:00:00.000Z',
      updated_at: '2026-09-21T00:00:00.000Z',
      created_by: 'nd-1',
    },
  ];
}

export function taoChiTietKhoaMau(danhSach: KhoaBoiDuong[]): Record<string, KhoaBoiDuongChiTiet> {
  const out: Record<string, KhoaBoiDuongChiTiet> = {};
  out[danhSach[0].id] = {
    ...danhSach[0],
    giai_doan: [],
    lop_hoc: [
      {
        id: 'lop-1',
        khoa_id: danhSach[0].id,
        ten_lop: 'Lớp 01 – Nhóm cơ bản A',
        si_so_toi_da: 30,
        trang_thai: 'active',
        nhom_hoc_vien: 1,
        muc_nang_luc: 'co_ban',
        nhan_su: [{ id: 'ns-1', lop_id: 'lop-1', ho_ten: 'Nguyễn Văn Long', vai_tro: 'giang_vien', so_dien_thoai: null }],
        lich_hoc: [],
      },
    ],
  };
  out[danhSach[1].id] = { ...danhSach[1], giai_doan: [], lop_hoc: [] };
  return out;
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

// Dữ liệu mẫu cho Trung tâm báo cáo (Phase 5 redesign). Hàng của xác nhận/sửa-trường-MOET/điều-kiện-
// đánh-giá/vận-hành dùng kiểu chung BaoCaoRow (xem ghi chú improvised trong api/types.ts) — mock chỉ
// cần vài field minh họa, KHÔNG phải shape chính thức từ backend.
export function taoDanhSachDotXacNhanMau(): DotXacNhanDanhMuc[] {
  return [
    { id: 'dot-1', khoa_id: null, ten: 'Kiểm tra hồ sơ đợt 1', loai: 'kiem_tra_bo_sung', mo_luc: '2026-09-01T00:00:00.000Z', dong_luc: '2026-10-04T16:59:59.000Z' },
    { id: 'dot-2', khoa_id: null, ten: 'Xác nhận trước đánh giá', loai: 'xac_nhan_truoc_danh_gia', mo_luc: '2026-10-10T00:00:00.000Z', dong_luc: '2026-10-20T16:59:59.000Z' },
  ];
}

export function taoBaoCaoXacNhanMau(): BaoCaoRow[] {
  return [
    { ho_ten: 'Lê Văn Bình', don_vi: 'THPT Long Xuyên', trang_thai: 'da_xac_nhan' },
    { ho_ten: 'Phạm Thu Hà', don_vi: 'THPT Long Xuyên', trang_thai: 'chua_dang_nhap' },
  ];
}

export function taoBaoCaoSuaTruongMoetMau(): BaoCaoRow[] {
  return [{ ho_ten: 'Võ Minh Khôi', ma_dinh_danh_moet: '9115131099', don_vi_cu: 'THPT Long Xuyên', don_vi_moi: 'THPT Châu Đốc' }];
}

export function taoBaoCaoDieuKienDanhGiaMau(): BaoCaoRow[] {
  return [
    { ho_ten: 'Võ Minh Khôi', du_dieu_kien: true, ly_do: '', da_xem_vle: true },
    { ho_ten: 'Lê Văn Bình', du_dieu_kien: false, ly_do: 'Chưa xác nhận hồ sơ ở đợt 2', da_xem_vle: false },
  ];
}

export function taoBaoCaoVanHanhMau(): BaoCaoRow[] {
  return [
    { ten_lop: 'Lớp 01 – Nhóm cơ bản A', si_so: 30, so_co_email: 28, so_ho_so_day_du: 25 },
    { ten_lop: 'Tổng', si_so: 30, so_co_email: 28, so_ho_so_day_du: 25 },
  ];
}

// Hàng khớp NGUYÊN VĂN response thật GET /import (capture DevTools Network + đối chiếu
// backend/src/import/import.service.ts#lichSu — trả thẳng bản ghi bảng nhat_ky_import, tên field
// KHÁC ImportChiTiet: loai_danh_muc/thoi_gian_import, không có danh_sach_loi/danh_sach_canh_bao).
// import-3 mô phỏng đúng ca lỗi thật đã gặp: trang_thai='loi' (lỗi cấp file, không đọc được) nhưng
// so_dong_loi=0 — nếu ai đó quay lại suy trạng thái chỉ từ so_dong_loi thì dòng này sẽ hiện sai
// thành "Thành công", test phải bắt được.
export function taoDanhSachImportMau(): NhatKyImportItem[] {
  return [
    {
      id: 'import-1',
      loai_danh_muc: 'ho_so_nhan_su_moet',
      ten_file_goc: 'ho-so-nhan-su.xlsx',
      nguoi_import_id: 'nd-1',
      thoi_gian_import: '2026-09-29T02:12:00.000Z',
      tong_so_dong: 10,
      so_dong_thanh_cong: 10,
      so_dong_loi: 0,
      file_loi_url: null,
      trang_thai: 'hoan_thanh',
    },
    {
      id: 'import-2',
      loai_danh_muc: 'phan_lop_hoc_vien',
      ten_file_goc: 'phan-lop.xlsx',
      nguoi_import_id: 'nd-1',
      thoi_gian_import: '2026-09-28T09:40:00.000Z',
      tong_so_dong: 10,
      so_dong_thanh_cong: 8,
      so_dong_loi: 2,
      file_loi_url: '/import/import-2/file-loi',
      trang_thai: 'hoan_thanh',
    },
    {
      id: 'import-3',
      loai_danh_muc: 'dia_danh',
      ten_file_goc: 'dia-danh-loi.xlsx',
      nguoi_import_id: 'nd-1',
      thoi_gian_import: '2026-09-27T03:08:16.015Z',
      tong_so_dong: 0,
      so_dong_thanh_cong: 0,
      so_dong_loi: 0,
      file_loi_url: null,
      trang_thai: 'loi',
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
  danhSachKhoa: taoDanhSachKhoaMau(),
  chiTietKhoa: taoChiTietKhoaMau(taoDanhSachKhoaMau()),
  danhSachDotXacNhan: taoDanhSachDotXacNhanMau(),
  baoCaoXacNhan: taoBaoCaoXacNhanMau(),
  baoCaoSuaTruongMoet: taoBaoCaoSuaTruongMoetMau(),
  baoCaoDieuKienDanhGia: taoBaoCaoDieuKienDanhGiaMau(),
  baoCaoVanHanh: taoBaoCaoVanHanhMau(),
  danhSachImport: taoDanhSachImportMau(),
  chiTietImport: {} as Record<string, ImportChiTiet>,
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
  db.danhSachKhoa = taoDanhSachKhoaMau();
  db.chiTietKhoa = taoChiTietKhoaMau(db.danhSachKhoa);
  db.danhSachDotXacNhan = taoDanhSachDotXacNhanMau();
  db.baoCaoXacNhan = taoBaoCaoXacNhanMau();
  db.baoCaoSuaTruongMoet = taoBaoCaoSuaTruongMoetMau();
  db.baoCaoDieuKienDanhGia = taoBaoCaoDieuKienDanhGiaMau();
  db.baoCaoVanHanh = taoBaoCaoVanHanhMau();
  db.danhSachImport = taoDanhSachImportMau();
  db.chiTietImport = {};
}
