// Bảng nhãn tiếng Việt cho tên trường dữ liệu học viên — dùng chung M3, M4, M5.
// (dac-ta-cong-hoc-vien.md § M3: "đặt trong src/lib/nhanTruong.ts, dùng chung cho M3, M4, M5")
export const nhanTruong: Record<string, string> = {
  ma_dinh_danh_moet: 'Mã định danh CSDL ngành',
  so_dinh_danh_ca_nhan: 'Số CCCD',
  ho_ten: 'Họ và tên',
  ngay_sinh: 'Ngày sinh',
  thang_sinh: 'Tháng sinh',
  nam_sinh: 'Năm sinh',
  gioi_tinh: 'Giới tính',
  noi_sinh: 'Nơi sinh',
  cu_tru: 'Cư trú',
  cu_tru_tinh_id: 'Cư trú (tỉnh/thành)',
  cu_tru_phuong_xa_id: 'Cư trú (phường/xã)',
  don_vi_cong_tac_id: 'Đơn vị công tác',
  chuc_vu: 'Chức vụ',
  doi_tuong: 'Đối tượng',
  so_dien_thoai_lien_he: 'Số điện thoại',
  email_lien_he: 'Email',
  trinh_do_chuyen_mon: 'Trình độ chuyên môn',
  trinh_do_chuyen_mon_khac: 'Mô tả trình độ khác',
  cap_giang_day: 'Cấp giảng dạy',
  mon_giang_day_id: 'Môn giảng dạy',
  chuyen_mon: 'Chuyên môn',
};

export function nhanCuaTruong(truong: string): string {
  return nhanTruong[truong] ?? truong;
}
