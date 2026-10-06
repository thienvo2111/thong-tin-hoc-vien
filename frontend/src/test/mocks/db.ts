import type { LopCuaToiGv, TrangLop } from '@/api/hoTroGv';
import type {
  DiemHoc,
  GiangVien,
  LichDayGiangVien,
  BaoCaoRow,
  DanhGiaDauVao,
  DiaDanh,
  DonViChuaCap,
  DonViCongTac,
  DotXacNhan,
  DotXacNhanDanhMuc,
  GiaiDoanKhoa,
  HocVien,
  HocVienDanhSachItem,
  ImportChiTiet,
  KhoaBoiDuong,
  KhoaBoiDuongChiTiet,
  KhoaHocDangKy,
  MonHoc,
  NhatKyHocVien,
  NhatKyImportItem,
  TaiKhoanDonVi,
  TaiKhoanHoTro,
  CumCuaToi,
  HocVienHoTroDong,
  HocVienHoTroChiTiet,
  BuoiHocHoTro,
  TaiKhoanHocVien,
  TongHopDonViRow,
  TongQuanResult,
  YeuCauHoTro,
} from '@/api/types';

// "CSDL" giả lập trong bộ nhớ cho MSW — mỗi test có thể sửa trực tiếp rồi resetDb() ở afterEach.
export const TINH_AN_GIANG: DiaDanh = { id: 'tinh-1', ma: '89', ten: 'An Giang', cap: 'tinh_thanh', parent_id: null, trang_thai: 'active' };
export const TINH_KHAC: DiaDanh = { id: 'tinh-2', ma: '92', ten: 'Cần Thơ', cap: 'tinh_thanh', parent_id: null, trang_thai: 'active' };
export const PHUONG_1: DiaDanh = { id: 'phuong-1', ma: '001', ten: 'Phường Long Xuyên', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' };
export const PHUONG_2: DiaDanh = { id: 'phuong-2', ma: '002', ten: 'Phường Châu Đốc', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-2', trang_thai: 'active' };

export const DIA_DANH: DiaDanh[] = [TINH_AN_GIANG, TINH_KHAC, PHUONG_1, PHUONG_2];

export const DON_VI: DonViCongTac[] = [
  { id: 'dv-1', ma_don_vi: 'THPT01', ten_don_vi: 'THPT Long Xuyên', loai_don_vi: 'truong', dia_ban_id: 'phuong-1', dia_ban_ten: 'Phường Long Xuyên', tinh_id: 'tinh-1', tinh_ten: 'An Giang', trang_thai: 'active' },
  { id: 'dv-2', ma_don_vi: 'THPT02', ten_don_vi: 'THPT Châu Đốc', loai_don_vi: 'truong', dia_ban_id: 'phuong-2', dia_ban_ten: 'Phường Châu Đốc', tinh_id: 'tinh-2', tinh_ten: 'Cần Thơ', trang_thai: 'active' },
  // dv-so-1 (so_gddt) + dv-hcmue (khac) — 2 loại đơn vị còn lại hợp lệ làm "đơn vị đặt hàng" của khóa
  // (2026-10-03-don-vi-dat-hang; chỉ loại phong_vhxh bị chặn), dùng cho Select nhóm theo loại ở form
  // tạo khóa (AdminKhoaBoiDuong) và header "Đặt hàng: ..." (AdminKhoaChiTiet).
  { id: 'dv-so-1', ma_don_vi: 'SOGDDT-AG', ten_don_vi: 'Sở GD&ĐT An Giang', loai_don_vi: 'so_gddt', dia_ban_id: 'tinh-1', dia_ban_ten: 'An Giang', tinh_id: 'tinh-1', tinh_ten: 'An Giang', trang_thai: 'active' },
  { id: 'dv-hcmue', ma_don_vi: 'HCMUE', ten_don_vi: 'Trường Đại học Sư phạm TP.HCM', loai_don_vi: 'khac', dia_ban_id: 'tinh-1', dia_ban_ten: 'An Giang', tinh_id: 'tinh-1', tinh_ten: 'An Giang', trang_thai: 'active' },
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
    cu_tru_tinh_id: null,
    cu_tru_phuong_xa_id: null,
    don_vi_cong_tac_id: 'dv-1',
    don_vi_cong_tac_ten: 'THPT Long Xuyên — Phường Long Xuyên',
    chuc_vu: 'Giáo viên',
    doi_tuong: 'giao_vien',
    so_dien_thoai_lien_he: '0912345678',
    email_lien_he: null,
    email_da_xac_minh: false,
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
    dang_mo: true,
    da_xac_nhan: false,
    xac_nhan_luc: null,
    can_xac_nhan_lai: false,
    dieu_chinh_luc: null,
    xac_nhan_gan_nhat: null,
    ap_dung_dot: true,
    day_du: false,
    thieu: [
      { field: 'so_dinh_danh_ca_nhan', message: 'Chưa có số CCCD' },
      { field: 'email_lien_he', message: 'Chưa có email' },
    ],
  };
}

export function taoDanhGiaDauVaoDuDieuKien(): DanhGiaDauVao {
  return {
    kenh: 'vle',
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
      email_da_xac_minh: false,
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
      email_da_xac_minh: false,
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
      email_da_xac_minh: true,
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
      don_vi_dat_hang_id: 'dv-so-1',
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
      don_vi_dat_hang_id: 'dv-1',
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

// Phân lớp theo giai đoạn (spec 2026-10-02): 4 giai đoạn của khoa-1 — id dùng chung với
// taoKhoaHocToiMau() để màn admin phân lớp và M7 khớp nhau.
const GIAI_DOAN_KHOA_1 = [
  {
    id: 'gd-1',
    thu_tu: 1,
    ten_giai_doan: 'Đánh giá đầu vào',
    hinh_thuc: 'danh_gia' as const,
    thoi_gian_bat_dau: '2026-10-01T00:00:00.000Z',
    thoi_gian_ket_thuc: '2026-10-04T00:00:00.000Z',
    link_hoac_dia_diem: 'https://vle.example/danh-gia',
    huong_dan: 'Làm bài trong 60 phút',
  },
  {
    id: 'gd-2',
    thu_tu: 2,
    ten_giai_doan: 'Học trực tiếp',
    hinh_thuc: 'truc_tiep' as const,
    thoi_gian_bat_dau: '2026-10-05T00:00:00.000Z',
    thoi_gian_ket_thuc: '2026-10-06T00:00:00.000Z',
    link_hoac_dia_diem: null,
    huong_dan: null,
  },
  {
    id: 'gd-3',
    thu_tu: 3,
    ten_giai_doan: 'Học trực tuyến qua zoom',
    hinh_thuc: 'truc_tuyen' as const,
    thoi_gian_bat_dau: '2026-10-12T00:00:00.000Z',
    thoi_gian_ket_thuc: '2026-10-13T00:00:00.000Z',
    link_hoac_dia_diem: null,
    huong_dan: null,
  },
  {
    id: 'gd-4',
    thu_tu: 4,
    ten_giai_doan: 'Học trực tuyến qua VLE',
    hinh_thuc: 'truc_tuyen' as const,
    thoi_gian_bat_dau: '2026-10-20T00:00:00.000Z',
    thoi_gian_ket_thuc: '2026-11-20T00:00:00.000Z',
    link_hoac_dia_diem: null,
    huong_dan: null,
  },
];

function taoGiaiDoanKhoa1(khoaId: string): GiaiDoanKhoa[] {
  return GIAI_DOAN_KHOA_1.map((g) => ({ ...g, khoa_id: khoaId, trang_thai: 'active' as const }));
}

// Sửa 2026-09-30 (QĐ10): mỗi lop_hoc có loai_lop (khoa-1 có đủ 3 loại, dùng cho cả AdminKhoaChiTiet
// VÀ AdminHocVienChiTiet — Select lọc lop_hoc theo loai_lop ở FE) + cum_hoc_vien của khóa.
export function taoChiTietKhoaMau(danhSach: KhoaBoiDuong[]): Record<string, KhoaBoiDuongChiTiet> {
  const out: Record<string, KhoaBoiDuongChiTiet> = {};
  out[danhSach[0].id] = {
    ...danhSach[0],
    // pham_vi_hoc_vien mặc định 'toan_bo' (R1 — caller/khóa đặt hàng cùng đơn vị); test riêng của
    // AdminKhoaChiTiet override 'don_vi' qua server.use() khi cần kiểm tra Alert phạm vi hiện ra.
    pham_vi_hoc_vien: 'toan_bo',
    giai_doan: taoGiaiDoanKhoa1(danhSach[0].id),
    lop_hoc: [
      {
        id: 'lop-1',
        khoa_id: danhSach[0].id,
        loai_lop: 'truc_tiep',
        ten_lop: 'Lớp 01 – Nhóm cơ bản A',
        si_so_toi_da: 30,
        trang_thai: 'active',
        nhom_hoc_vien: 1,
        muc_nang_luc: 'co_ban',
        nhan_su: [{ id: 'ns-1', lop_id: 'lop-1', ho_ten: 'Nguyễn Văn Long', vai_tro: 'giang_vien', so_dien_thoai: null }],
        lich_hoc: [],
        si_so_hien_tai: 12,
      },
      {
        id: 'lop-2',
        khoa_id: danhSach[0].id,
        loai_lop: 'zoom',
        ten_lop: 'Lớp Zoom 01',
        si_so_toi_da: 500,
        trang_thai: 'active',
        nhom_hoc_vien: null,
        muc_nang_luc: null,
        nhan_su: [],
        lich_hoc: [],
      },
      {
        id: 'lop-3',
        khoa_id: danhSach[0].id,
        loai_lop: 'vle',
        ten_lop: 'Lớp VLE 01',
        si_so_toi_da: null,
        trang_thai: 'active',
        nhom_hoc_vien: null,
        muc_nang_luc: null,
        nhan_su: [],
        lich_hoc: [],
      },
    ],
    cum_hoc_vien: [
      {
        id: 'cum-1',
        khoa_id: danhSach[0].id,
        ten_cum: 'Cụm Long Xuyên',
        link_zalo: 'https://zalo.me/g/cum-long-xuyen',
        ghi_chu: 'Hỗ trợ kỹ thuật trong giờ hành chính',
        trang_thai: 'active',
        created_at: '2026-09-01T00:00:00.000Z',
        nguoi_ho_tro: [{ id: 'ht-1', ho_ten: 'Nguyễn Văn A' }],
      },
    ],
  };
  out[danhSach[1].id] = {
    ...danhSach[1],
    pham_vi_hoc_vien: 'toan_bo',
    giai_doan: [],
    lop_hoc: [],
    cum_hoc_vien: [],
  };
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

// Dashboard "Tổng quan hệ thống" (thêm 2026-09-30) — GET /bao-cao/tong-quan. Số liệu minh họa, khớp
// TongQuanResult (backend/src/bao-cao/bao-cao.types.ts).
export function taoBaoCaoTongQuanMau(): TongQuanResult {
  return {
    tong_hoc_vien_tham_gia: 10,
    da_dang_nhap: 7,
    da_chinh_sua_ho_so: 4,
    khao_sat: {
      dau_vao: { da_lam: 8, co_ban: 3, thanh_thao: 3, nang_cao: 2, chua_xep_muc: 0 },
      dau_ra: { da_lam: 0, co_ban: 0, thanh_thao: 0, nang_cao: 0, chua_xep_muc: 0 },
    },
    ket_qua_theo_hinh_thuc: [
      { loai_lop: 'truc_tiep', dang_hoc: 5, dat: 3, khong_dat: 1, vang: 1 },
      { loai_lop: 'zoom', dang_hoc: 2, dat: 0, khong_dat: 0, vang: 0 },
      { loai_lop: 'vle', dang_hoc: 0, dat: 0, khong_dat: 0, vang: 0 },
    ],
  };
}

// Dữ liệu mẫu cho Trung tâm báo cáo (Phase 5 redesign). Hàng của xác nhận/sửa-trường-MOET/điều-kiện-
// đánh-giá/vận-hành dùng kiểu chung BaoCaoRow (xem ghi chú improvised trong api/types.ts) — mock chỉ
// cần vài field minh họa, KHÔNG phải shape chính thức từ backend.
export function taoDanhSachDotXacNhanMau(): DotXacNhanDanhMuc[] {
  return [
    {
      id: 'dot-1',
      khoa_id: null,
      ten: 'Kiểm tra hồ sơ đợt 1',
      loai: 'kiem_tra_bo_sung',
      mo_luc: '2026-09-01T00:00:00.000Z',
      dong_luc: '2026-10-04T16:59:59.000Z',
      created_by: 'nd-1',
      created_at: '2026-08-25T00:00:00.000Z',
    },
    {
      id: 'dot-2',
      khoa_id: null,
      ten: 'Xác nhận trước đánh giá',
      loai: 'xac_nhan_truoc_danh_gia',
      mo_luc: '2026-10-10T00:00:00.000Z',
      dong_luc: '2026-10-20T16:59:59.000Z',
      created_by: 'nd-1',
      created_at: '2026-08-25T00:00:00.000Z',
    },
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
    // import-4 mô phỏng ca đã validate xong nhưng CHƯA bấm "Xác nhận" (người dùng rời trang/refresh
    // trước khi xác nhận) — trang_thai vẫn 'dang_xu_ly' (backend chỉ chuyển 'hoan_thanh' SAU khi xác
    // nhận, xem lib/trangThaiImport.ts) nhưng đã có so_dong_thanh_cong > 0 nên còn dữ liệu để xác nhận
    // lại từ bảng lịch sử, không cần upload lại file — xem taoChiTietImportMau() cho chi tiết khớp id.
    {
      id: 'import-4',
      loai_danh_muc: 'ket_qua_danh_gia',
      ten_file_goc: 'ket-qua-danh-gia.xlsx',
      nguoi_import_id: 'nd-1',
      thoi_gian_import: '2026-09-29T08:00:00.000Z',
      tong_so_dong: 7,
      so_dong_thanh_cong: 6,
      so_dong_loi: 1,
      file_loi_url: '/import/import-4/file-loi',
      trang_thai: 'dang_xu_ly',
    },
  ];
}

// Chi tiết khớp import-4 ở trên (GET /import/import-4) — pre-seed vì import-4 mô phỏng job từ 1
// phiên upload TRƯỚC ĐÓ (không phải job vừa tạo qua POST /import/:loai trong test hiện tại).
export function taoChiTietImportMau(): Record<string, ImportChiTiet> {
  return {
    'import-4': {
      id: 'import-4',
      trang_thai: 'dang_xu_ly',
      tong_so_dong: 7,
      so_dong_thanh_cong: 6,
      so_dong_loi: 1,
      danh_sach_loi: [{ dong: 4, ly_do: 'Thiếu điểm đánh giá đầu ra' }],
      danh_sach_canh_bao: [],
      so_hoc_vien_chua_co_email: 0,
    },
  };
}

// M7 — Thông tin lớp học của học viên (GET /hoc-vien/toi/khoa-hoc). Phân lớp theo giai đoạn (spec
// 2026-10-02): GĐ1 đánh giá (không lớp, có link + hướng dẫn), GĐ2 lớp trực tiếp (địa điểm text, có
// điểm danh + tiến độ), GĐ3 lớp Zoom (link http), GĐ4 không lớp/không link — kèm 1 cụm hỗ trợ Zalo.
export function taoKhoaHocToiMau(): KhoaHocDangKy[] {
  return [
    {
      id: 'dk-1',
      hoc_vien_id: 'hv-1',
      khoa_id: 'khoa-1',
      ngay_dang_ky: '2026-09-01T00:00:00.000Z',
      trang_thai: 'da_phan_lop',
      ket_qua: 'dang_hoc',
      ngay_hoan_thanh: null,
      muc_dau_vao: 'co_ban',
      muc_dau_ra: null,
      cum_id: 'cum-1',
      khoa: {
        id: 'khoa-1',
        ma_khoa: 'AG-2026-014',
        ten_khoa: 'Bồi dưỡng NLS – Mức cơ bản',
        dia_diem: null,
        thoi_gian_bat_dau: '2026-10-05T00:00:00.000Z',
        thoi_gian_ket_thuc: '2026-11-20T00:00:00.000Z',
        trang_thai: 'da_duyet',
      },
      cum: {
        id: 'cum-1',
        khoa_id: 'khoa-1',
        ten_cum: 'Cụm Long Xuyên',
        link_zalo: 'https://zalo.me/g/cum-long-xuyen',
        ghi_chu: 'Hỗ trợ kỹ thuật trong giờ hành chính',
        trang_thai: 'active',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      giai_doan: [
        { ...GIAI_DOAN_KHOA_1[0], lop: null, tien_do: null },
        {
          ...GIAI_DOAN_KHOA_1[1],
          lop: {
            id: 'lop-1',
            ten_lop: 'Lớp 01 – Nhóm cơ bản A',
            loai_lop: 'truc_tiep',
            si_so_toi_da: 30,
            nhom_hoc_vien: 1,
            muc_nang_luc: 'co_ban',
            nhan_su: [
              { id: 'ns-1', ho_ten: 'Nguyễn Văn Long', vai_tro: 'giang_vien', so_dien_thoai: '0909123456' },
              { id: 'ns-2', ho_ten: 'Trần Thị Mai', vai_tro: 'ho_tro', so_dien_thoai: null },
            ],
            lich_hoc: [1, 2].map((buoi) => ({
              id: `lh-${buoi}`,
              giai_doan_id: 'gd-2',
              buoi_so: buoi,
              thoi_gian_bat_dau: `2026-10-0${4 + buoi}T01:00:00.000Z`,
              thoi_gian_ket_thuc: `2026-10-0${4 + buoi}T04:00:00.000Z`,
              dia_diem_hoac_link: 'Hội trường A, THPT Long Xuyên',
              trang_thai: 'ket_thuc' as const,
              giai_doan: { ...GIAI_DOAN_KHOA_1[1] },
              trang_thai_diem_danh: buoi === 1 ? ('co_mat' as const) : null,
            })),
          },
          tien_do: { ty_le_hoan_thanh: 75, diem: null },
        },
        {
          ...GIAI_DOAN_KHOA_1[2],
          lop: {
            id: 'lop-2',
            ten_lop: 'Lớp Zoom 01',
            loai_lop: 'zoom',
            si_so_toi_da: 500,
            nhom_hoc_vien: null,
            muc_nang_luc: null,
            nhan_su: [{ id: 'ns-3', ho_ten: 'Lê Thị Hồng', vai_tro: 'giang_vien', so_dien_thoai: null }],
            lich_hoc: [
              {
                id: 'lh-3',
                giai_doan_id: 'gd-3',
                buoi_so: 1,
                thoi_gian_bat_dau: '2026-10-12T01:00:00.000Z',
                thoi_gian_ket_thuc: '2026-10-12T04:00:00.000Z',
                dia_diem_hoac_link: 'https://vle.example.edu.vn/lop-1/buoi-2',
                trang_thai: 'chua_dien_ra',
                giai_doan: { ...GIAI_DOAN_KHOA_1[2] },
                // null = chưa được điểm danh cho buổi này (chưa diễn ra).
                trang_thai_diem_danh: null,
              },
            ],
          },
          tien_do: null,
        },
        { ...GIAI_DOAN_KHOA_1[3], link_hoac_dia_diem: null, huong_dan: null, lop: null, tien_do: null },
      ],
    },
  ];
}

// GET /hoc-vien/{id}/khoa-hoc (Thêm 2026-09-30, QĐ10) — admin xem lại khóa/lớp của 1 học viên cụ thể
// (AdminHocVienChiTiet). hv-duyet-1 (đã da_duyet) ghi danh khóa-1 nhưng CHƯA được gán lớp/cụm nào —
// để test chọn lớp mới + bấm lưu (PATCH /dang-ky-hoc/{id}/lop, /cum).
export function taoKhoaHocCuaHocVienMau(): Record<string, KhoaHocDangKy[]> {
  return {
    'hv-duyet-1': [
      {
        id: 'dk-hv-duyet-1',
        hoc_vien_id: 'hv-duyet-1',
        khoa_id: 'khoa-1',
        ngay_dang_ky: '2026-09-25T00:00:00.000Z',
        trang_thai: 'da_duyet',
        ket_qua: null,
        ngay_hoan_thanh: null,
        muc_dau_vao: null,
        muc_dau_ra: null,
        cum_id: null,
        khoa: {
          id: 'khoa-1',
          ma_khoa: 'AG-2026-014',
          ten_khoa: 'Bồi dưỡng NLS – Mức cơ bản',
          dia_diem: null,
          thoi_gian_bat_dau: '2026-10-05',
          thoi_gian_ket_thuc: '2026-11-20',
          trang_thai: 'cho_duyet',
        },
        cum: null,
        giai_doan: GIAI_DOAN_KHOA_1.map((g) => ({ ...g, lop: null, tien_do: null })),
      },
    ],
  };
}

// M8 (2026-10-01) — ticket "Yêu cầu hỗ trợ" của học viên (hv-1, cùng db.hoSo.id). Bắt đầu rỗng: tạo
// qua POST /yeu-cau-ho-tro/toi trong lúc test (xem handler trong handlers.ts).
export function taoDanhSachYeuCauHoTroMau(): YeuCauHoTro[] {
  return [];
}

// Tài khoản đơn vị (ADR 0002) — /nguoi-dung/don-vi.
// Người hỗ trợ học viên (ADR 0003) — 1 người đã phân công cụm-1 của khóa đầu, 1 người chưa phân công.
export function taoDanhSachTaiKhoanHoTroMau(): TaiKhoanHoTro[] {
  return [
    {
      id: 'ht-1',
      ten_dang_nhap: 'nguyen.a',
      ho_ten: 'Nguyễn Văn A',
      email: 'nguyen.a@hcmue.edu.vn',
      vai_tro: 'ho_tro_hoc_vien',
      trang_thai: 'active',
      dang_nhap_lan_cuoi: '2026-10-05T02:00:00.000Z',
      cum: [{ cum_id: 'cum-1', ten_cum: 'Cụm Long Xuyên', khoa_id: 'khoa-1', ma_khoa: 'KBD-AG-01', ten_khoa: 'Khóa An Giang' }],
    },
    {
      id: 'htgv-1',
      ten_dang_nhap: 'pham.g',
      ho_ten: 'Phạm Văn Giảng',
      email: 'pham.g@hcmue.edu.vn',
      vai_tro: 'ho_tro_giang_vien',
      trang_thai: 'active',
      dang_nhap_lan_cuoi: null,
      cum: [],
      khoa: [],
    },
    {
      id: 'ht-2',
      ten_dang_nhap: 'tran.b',
      ho_ten: 'Trần Thị B',
      email: 'tran.b@hcmue.edu.vn',
      vai_tro: 'ho_tro_hoc_vien',
      trang_thai: 'active',
      dang_nhap_lan_cuoi: null,
      cum: [],
    },
  ];
}

// Khu người hỗ trợ học viên (ADR 0003): 1 cụm, 1 học viên, 1 buổi học.
export function taoHoTroCumMau(): CumCuaToi[] {
  return [
    {
      cum_id: 'cum-1',
      ten_cum: 'Cụm Long Xuyên',
      link_zalo: 'https://zalo.me/g/cum-long-xuyen',
      trang_thai: 'active',
      khoa_id: 'khoa-1',
      ma_khoa: 'KBD-AG-01',
      ten_khoa: 'Khóa An Giang',
      so_hoc_vien: 120,
    },
  ];
}

export function taoHoTroHocVienMau(): HocVienHoTroDong[] {
  return [
    {
      id: 'hv-ht-1',
      ho_ten: 'Nguyễn Văn Một',
      ma_dinh_danh_moet: '7900000001',
      ten_dang_nhap: '7900000001',
      dang_nhap_lan_cuoi: null,
      don_vi_cong_tac_ten: 'Trường THPT Long Xuyên',
      doi_tuong: 'giao_vien',
      so_dien_thoai_lien_he: '0912345678',
      email_lien_he: null,
      day_du: false,
      cum: [{ cum_id: 'cum-1', ten_cum: 'Cụm Long Xuyên' }],
      khao_sat: [{ loai: 'danh-gia', trang_thai: 'hoan_thanh', muc: 'thanh_thao' }],
    },
  ];
}

export function taoHoTroChiTietMau(): HocVienHoTroChiTiet {
  return {
    ho_so: {
      ...taoHoSoMoi(),
      id: 'hv-ht-1',
      ho_ten: 'Nguyễn Văn Một',
      don_vi_cong_tac_ten: 'Trường THPT Long Xuyên',
      day_du: false,
      thieu: [{ field: 'doi_tuong', message: 'Chưa chọn đối tượng (giáo viên hoặc cán bộ quản lý)' }],
    },
    tai_khoan: {
      id: 'nd-ht-1',
      ten_dang_nhap: '7900000001',
      trang_thai: 'active',
      dang_nhap_lan_cuoi: null,
      phai_doi_mat_khau: true,
      khoa_den: null,
      dang_bi_khoa: false,
      email_da_xac_minh: false,
    },
    hoc_tap: [],
    khao_sat: [
      { loai: 'danh-gia', trang_thai: 'hoan_thanh', muc: 'thanh_thao', hoan_thanh_luc: null, cap_nhat_luc: '2026-10-05T02:00:00.000Z' },
    ],
    yeu_cau_ho_tro: [],
    lich_su_thay_doi: [],
  };
}

export function taoHoTroLichHocMau(): BuoiHocHoTro[] {
  return [
    {
      id: 'buoi-1',
      lop_id: 'lop-1',
      giai_doan_id: 'gd-1',
      buoi_so: 1,
      thoi_gian_bat_dau: '2026-10-10T01:00:00.000Z',
      thoi_gian_ket_thuc: '2026-10-10T04:00:00.000Z',
      dia_diem_hoac_link: 'https://zoom.us/j/123',
      trang_thai: 'chua_dien_ra',
      lop: { id: 'lop-1', ten_lop: 'Zoom 01', loai_lop: 'zoom' },
      giai_doan: { id: 'gd-1', thu_tu: 1, ten_giai_doan: 'Zoom – nhóm 1' },
      khoa: { id: 'khoa-1', ma_khoa: 'KBD-AG-01', ten_khoa: 'Khóa An Giang' },
      nhan_su: [{ ho_ten: 'TS. Giảng Viên', vai_tro: 'giang_vien', so_dien_thoai: '0900000000' }],
      so_hoc_vien_cum: 35,
    },
  ];
}

export function taoDanhSachTaiKhoanDonViMau(): TaiKhoanDonVi[] {
  return [
    {
      id: 'tk-sgd',
      ten_dang_nhap: 'sgd-angiang',
      ho_ten: 'Phòng Tổ chức cán bộ',
      email: 'tccb@angiang.edu.vn',
      vai_tro: 'so_gddt',
      trang_thai: 'active',
      dang_nhap_lan_cuoi: null,
      don_vi: { id: 'dv-sgd', ma_don_vi: 'SGD-AG', ten_don_vi: 'Sở GD&ĐT An Giang', loai_don_vi: 'so_gddt', trang_thai: 'active' },
    },
    {
      id: 'tk-tr001',
      ten_dang_nhap: 'tr-ag-001',
      ho_ten: 'Trường THPT Thoại Ngọc Hầu',
      email: null,
      vai_tro: 'truong',
      trang_thai: 'active',
      dang_nhap_lan_cuoi: '2026-10-02T03:00:00.000Z',
      don_vi: { id: 'dv-tr001', ma_don_vi: 'TR-AG-001', ten_don_vi: 'Trường THPT Thoại Ngọc Hầu', loai_don_vi: 'truong', trang_thai: 'active' },
    },
  ];
}

export function taoDonViChuaCapMau(): DonViChuaCap[] {
  return [
    { id: 'dv-tr032', ma_don_vi: 'TR-AG-032', ten_don_vi: 'Trường THPT Long Xuyên', loai_don_vi: 'truong' },
    { id: 'dv-ph01', ma_don_vi: 'PH-AG-01', ten_don_vi: 'Phòng VHXH Long Xuyên', loai_don_vi: 'phong_vhxh' },
  ];
}

// Tài khoản học viên — /nguoi-dung/hoc-vien. khoa_den tính lúc tạo để luôn ở tương lai.
export function taoDanhSachTaiKhoanHocVienMau(): TaiKhoanHocVien[] {
  const hv = (id: string, ho_ten: string, cccd: string, sdt: string | null): TaiKhoanHocVien['hoc_vien'] => ({
    id,
    ho_ten,
    so_dinh_danh_ca_nhan: cccd,
    ngay_sinh: 5,
    thang_sinh: 3,
    nam_sinh: 1985,
    so_dien_thoai_lien_he: sdt,
    email_lien_he: null,
    don_vi_cong_tac: { id: 'dv-tr001', ten_don_vi: 'Trường THPT Thoại Ngọc Hầu' },
  });
  return [
    {
      id: 'nd-hv-1',
      ten_dang_nhap: '089185000001',
      trang_thai: 'active',
      phai_doi_mat_khau: false,
      so_lan_dang_nhap_sai: 5,
      khoa_den: new Date(Date.now() + 30 * 60_000).toISOString(),
      dang_nhap_lan_cuoi: '2026-10-02T03:00:00.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
      hoc_vien: hv('hv-1', 'Nguyễn Văn An', '089185000001', '0912345678'),
    },
    {
      id: 'nd-hv-2',
      ten_dang_nhap: '089185000002',
      trang_thai: 'ngung',
      phai_doi_mat_khau: false,
      so_lan_dang_nhap_sai: 0,
      khoa_den: null,
      dang_nhap_lan_cuoi: '2026-10-01T03:00:00.000Z',
      created_at: '2026-09-01T00:00:00.000Z',
      hoc_vien: hv('hv-2', 'Trần Thị Bình', '089185000002', null),
    },
    {
      id: 'nd-hv-3',
      ten_dang_nhap: '089185000003',
      trang_thai: 'active',
      phai_doi_mat_khau: true,
      so_lan_dang_nhap_sai: 0,
      khoa_den: null,
      dang_nhap_lan_cuoi: null,
      created_at: '2026-09-01T00:00:00.000Z',
      hoc_vien: hv('hv-3', 'Lê Văn Cường', '089185000003', '0987654321'),
    },
  ];
}

export function taoNhatKyHocVienMau(): NhatKyHocVien {
  const muc = (id: string, nhom: NhatKyHocVien['muc'][number]['nhom'], tieu_de: string, gio: string) => ({
    id,
    thoi_gian: `2026-10-02T${gio}:00.000Z`,
    nhom,
    tieu_de,
    noi_dung: null,
    truong: null,
    nguoi_thuc_hien: null,
    ip: null,
    thiet_bi: null,
  });
  return {
    hoc_vien: { id: 'hv-1', ho_ten: 'Nguyễn Văn An' },
    muc: [
      { ...muc('nk-1', 'tai_khoan', 'Đăng nhập thất bại', '03'), ip: '113.161.1.1', thiet_bi: 'Mozilla/5.0 Zalo' },
      { ...muc('nk-2', 'ho_so', 'Sửa hồ sơ', '02'), truong: 'so_dien_thoai_lien_he', noi_dung: '0911 → 0912', nguoi_thuc_hien: 'Học viên' },
      { ...muc('nk-3', 'tai_khoan', 'Được đặt lại mật khẩu', '01'), nguoi_thuc_hien: 'Quản trị viên' },
    ],
  };
}

// T10 (issue #2): danh mục điểm học trực tiếp.
export function taoDanhSachDiemHocMau(): DiemHoc[] {
  return [
    {
      id: 'dh-1',
      ma_diem_hoc: 'AG-LX-01',
      ten: 'THPT Long Xuyên',
      dia_chi: '1 Trần Hưng Đạo',
      dia_ban_id: 'phuong-1',
      don_vi_id: null,
      suc_chua: 200,
      so_phong: 4,
      nguoi_lien_he: 'Cô Lan',
      sdt_lien_he: '0901000001',
      ghi_chu_csvc: null,
      trang_thai: 'active',
      dia_ban: { id: 'phuong-1', ten: 'Phường Long Xuyên', parent_id: 'tinh-1' },
      don_vi: null,
    },
    {
      id: 'dh-2',
      ma_diem_hoc: 'AG-CD-01',
      ten: 'THCS Châu Đốc',
      dia_chi: '5 Nguyễn Huệ',
      dia_ban_id: 'phuong-1',
      don_vi_id: null,
      suc_chua: null,
      so_phong: null,
      nguoi_lien_he: null,
      sdt_lien_he: null,
      ghi_chu_csvc: null,
      trang_thai: 'ngung',
      dia_ban: { id: 'phuong-1', ten: 'Phường Long Xuyên', parent_id: 'tinh-1' },
      don_vi: null,
    },
  ];
}

// T11 (issue #3): danh mục giảng viên + lịch dạy.
export function taoDanhSachGiangVienMau(): GiangVien[] {
  return [
    {
      id: 'gv-1',
      ho_ten: 'Nguyễn Văn Long',
      so_dien_thoai: '0909123456',
      email: 'long@hcmue.edu.vn',
      don_vi_cong_tac: 'HCMUE',
      ghi_chu: null,
      trang_thai: 'active',
      so_buoi: 1,
    },
    {
      id: 'gv-2',
      ho_ten: 'Trần Thị Mai',
      so_dien_thoai: '0909000002',
      email: null,
      don_vi_cong_tac: null,
      ghi_chu: null,
      trang_thai: 'active',
      so_buoi: 0,
    },
  ];
}

export function taoLichDayMau(): Record<string, LichDayGiangVien> {
  const gv = taoDanhSachGiangVienMau();
  return {
    'gv-1': {
      giang_vien: gv[0],
      phan_cong: [
        {
          id: 'pc-1',
          vai_tro: 'giang_vien',
          so_gio: '4',
          da_xac_nhan_gio: false,
          xac_nhan_luc: null,
          lich_hoc: {
            id: 'lh-1',
            buoi_so: 1,
            thoi_gian_bat_dau: '2026-10-05T01:00:00.000Z',
            thoi_gian_ket_thuc: '2026-10-05T04:00:00.000Z',
            giai_doan: { id: 'gd-2', ten_giai_doan: 'Học trực tiếp', hinh_thuc: 'truc_tiep' },
            lop: { id: 'lop-1', ten_lop: 'Lớp 01 – Nhóm cơ bản A', loai_lop: 'truc_tiep', khoa: { id: 'khoa-1', ma_khoa: 'AG-2026-014', ten_khoa: 'Khóa mẫu' } },
            diem_hoc: null,
          },
        },
      ],
    },
    'gv-2': { giang_vien: gv[1], phan_cong: [] },
  };
}

// ADR 0004 L2/L3: Hồ sơ chuẩn bị lớp (người hỗ trợ GV) — buổi tương lai để sửa được.
export function taoTrangLopGvMau(): TrangLop {
  const mai = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  mai.setUTCHours(1, 0, 0, 0);
  return {
    lop: { id: 'lop-1', ten_lop: 'Lớp 01 – Nhóm cơ bản A', loai_lop: 'truc_tiep', si_so_toi_da: 30, khoa: { id: 'khoa-1', ma_khoa: 'AG-2026-014', ten_khoa: 'Khóa An Giang' } },
    giai_doan: { id: 'gd-2', thu_tu: 2, ten_giai_doan: 'Học trực tiếp', hinh_thuc: 'truc_tiep', thoi_gian_bat_dau: '2026-10-05T00:00:00.000Z', thoi_gian_ket_thuc: '2026-10-06T00:00:00.000Z' },
    buoi: [
      {
        id: 'lh-1',
        buoi_so: 1,
        thoi_gian_bat_dau: mai.toISOString(),
        thoi_gian_ket_thuc: new Date(mai.getTime() + 3 * 3600 * 1000).toISOString(),
        dia_diem_hoac_link: null,
        phong: 'P.101',
        trang_thai: 'chua_dien_ra',
        diem_hoc: { id: 'dh-1', ma_diem_hoc: 'AG-LX-01', ten: 'THPT Long Xuyên', dia_chi: '1 Trần Hưng Đạo', nguoi_lien_he: 'Cô Lan', sdt_lien_he: '0901000001', so_phong: 4, ghi_chu_csvc: null },
        giang_vien: [{ id: 'gv-1', ho_ten: 'Nguyễn Văn Long', vai_tro: 'giang_vien', so_dien_thoai: '0909123456', email: 'long@hcmue.edu.vn', so_gio: 4, da_xac_nhan_gio: false }],
      },
    ],
    hoc_vien: [
      {
        dang_ky_hoc_id: 'dk-1',
        hoc_vien_id: 'hv-1',
        ho_ten: 'Trần Thị Học',
        gioi_tinh: 'Nữ',
        don_vi: 'THPT Long Xuyên',
        doi_tuong: 'giao_vien',
        chuc_vu: null,
        muc_dau_vao: 'co_ban',
        so_dien_thoai: '0912000001',
        email: null,
        cum: { id: 'cum-1', ten_cum: 'Cụm Long Xuyên', nguoi_ho_tro: [{ ho_ten: 'Nguyễn Văn A', email: 'nguyen.a@hcmue.edu.vn' }] },
        diem_danh: {},
        ket_qua: null,
      },
    ],
    nhom_ho_tro_gv: [{ ho_ten: 'Phạm Văn Giảng', email: 'pham.g@hcmue.edu.vn' }],
    hau_can: [],
    thuc_dia: [],
  };
}

// ADR 0004 L1: lớp trong phạm vi người hỗ trợ giảng viên.
export function taoLopCuaToiGvMau(): LopCuaToiGv[] {
  return [
    {
      id: 'lop-1',
      ten_lop: 'Lớp 01 – Nhóm cơ bản A',
      loai_lop: 'truc_tiep',
      trang_thai: 'active',
      khoa: { id: 'khoa-1', ma_khoa: 'AG-2026-014', ten_khoa: 'Khóa An Giang' },
      _count: { lich_hoc: 3 },
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
  baoCaoTongQuan: taoBaoCaoTongQuanMau(),
  danhSachKhoa: taoDanhSachKhoaMau(),
  chiTietKhoa: taoChiTietKhoaMau(taoDanhSachKhoaMau()),
  danhSachDotXacNhan: taoDanhSachDotXacNhanMau(),
  baoCaoXacNhan: taoBaoCaoXacNhanMau(),
  baoCaoSuaTruongMoet: taoBaoCaoSuaTruongMoetMau(),
  baoCaoDieuKienDanhGia: taoBaoCaoDieuKienDanhGiaMau(),
  baoCaoVanHanh: taoBaoCaoVanHanhMau(),
  danhSachImport: taoDanhSachImportMau(),
  chiTietImport: taoChiTietImportMau(),
  khoaHocToi: taoKhoaHocToiMau(),
  khoaHocCuaHocVien: taoKhoaHocCuaHocVienMau(),
  danhSachYeuCauHoTro: taoDanhSachYeuCauHoTroMau(),
  taiKhoanDonVi: taoDanhSachTaiKhoanDonViMau(),
  taiKhoanHoTro: taoDanhSachTaiKhoanHoTroMau(),
  hoTroCum: taoHoTroCumMau(),
  hoTroHocVien: taoHoTroHocVienMau(),
  hoTroChiTiet: taoHoTroChiTietMau(),
  hoTroLichHoc: taoHoTroLichHocMau(),
  donViChuaCap: taoDonViChuaCapMau(),
  taiKhoanHocVien: taoDanhSachTaiKhoanHocVienMau(),
  nhatKyHocVien: taoNhatKyHocVienMau(),
  diemHoc: taoDanhSachDiemHocMau(),
  giangVien: taoDanhSachGiangVienMau(),
  lichDay: taoLichDayMau(),
  lopCuaToiGv: taoLopCuaToiGvMau(),
  trangLopGv: taoTrangLopGvMau(),
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
  db.baoCaoTongQuan = taoBaoCaoTongQuanMau();
  db.danhSachKhoa = taoDanhSachKhoaMau();
  db.chiTietKhoa = taoChiTietKhoaMau(db.danhSachKhoa);
  db.danhSachDotXacNhan = taoDanhSachDotXacNhanMau();
  db.baoCaoXacNhan = taoBaoCaoXacNhanMau();
  db.baoCaoSuaTruongMoet = taoBaoCaoSuaTruongMoetMau();
  db.baoCaoDieuKienDanhGia = taoBaoCaoDieuKienDanhGiaMau();
  db.baoCaoVanHanh = taoBaoCaoVanHanhMau();
  db.danhSachImport = taoDanhSachImportMau();
  db.chiTietImport = taoChiTietImportMau();
  db.khoaHocToi = taoKhoaHocToiMau();
  db.khoaHocCuaHocVien = taoKhoaHocCuaHocVienMau();
  db.danhSachYeuCauHoTro = taoDanhSachYeuCauHoTroMau();
  db.taiKhoanDonVi = taoDanhSachTaiKhoanDonViMau();
  db.taiKhoanHoTro = taoDanhSachTaiKhoanHoTroMau();
  db.hoTroCum = taoHoTroCumMau();
  db.hoTroHocVien = taoHoTroHocVienMau();
  db.hoTroChiTiet = taoHoTroChiTietMau();
  db.hoTroLichHoc = taoHoTroLichHocMau();
  db.donViChuaCap = taoDonViChuaCapMau();
  db.taiKhoanHocVien = taoDanhSachTaiKhoanHocVienMau();
  db.nhatKyHocVien = taoNhatKyHocVienMau();
  db.diemHoc = taoDanhSachDiemHocMau();
  db.giangVien = taoDanhSachGiangVienMau();
  db.lichDay = taoLichDayMau();
  db.lopCuaToiGv = taoLopCuaToiGvMau();
  db.trangLopGv = taoTrangLopGvMau();
}
