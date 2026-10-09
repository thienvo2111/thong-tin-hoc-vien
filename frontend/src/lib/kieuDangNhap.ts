// Spec 2026-10-09 Q-C: học viên chọn đăng nhập/quên mật khẩu bằng mã định danh MOET hoặc số điện thoại.
// Nhớ lựa chọn gần nhất trong localStorage — chỉ là tiện ích, đọc/ghi lỗi (ẩn danh, bị chặn) thì bỏ qua.

export type KieuDangNhap = 'ma' | 'sdt';

const KHOA_LUU = 'kieu_dang_nhap';

export function docKieuDangNhapDaLuu(): KieuDangNhap {
  try {
    return localStorage.getItem(KHOA_LUU) === 'sdt' ? 'sdt' : 'ma';
  } catch {
    return 'ma';
  }
}

export function luuKieuDangNhap(kieu: KieuDangNhap) {
  try {
    localStorage.setItem(KHOA_LUU, kieu);
  } catch {
    // Không lưu được thì lần sau dùng mặc định 'ma'.
  }
}

/** Đếm chữ số sau khi bỏ ký tự lạ (dấu cách, chấm, gạch, +). */
export function soChuSo(giaTri: string) {
  return giaTri.replace(/\D/g, '').length;
}

/** Nhãn/gợi ý/bàn phím của ô nhập theo chế độ — dùng chung cho Đăng nhập và Quên mật khẩu. */
export function nhapTheoKieu(kieu: KieuDangNhap) {
  return kieu === 'sdt'
    ? {
        label: 'Số điện thoại',
        description: 'Số điện thoại Thầy/Cô đã cung cấp cho nhà trường, ví dụ 0912345678.',
        inputMode: 'tel' as const,
        autoComplete: 'tel',
      }
    : {
        label: 'Tên tài khoản hoặc mã định danh MOET',
        description: 'Nhập mã định danh MOET, có hoặc không có số 0 ở đầu đều được.',
        inputMode: 'numeric' as const,
        autoComplete: 'username',
      };
}
