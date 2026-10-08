import { ApiError } from '@/api/client';
import { dinhDangNgayGio } from './ngay';

/** Thông điệp lỗi chung theo CLAUDE.md § Quy ước gọi API — dùng khi lỗi không gắn vào 1 field cụ thể. */
export function thongDiepLoiChung(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Đã có lỗi xảy ra, thử lại sau.';
  switch (err.code) {
    case 'ACCOUNT_LOCKED':
      return err.khoaDenLuc
        ? `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${dinhDangNgayGio(err.khoaDenLuc)}`
        : 'Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau.';
    case 'TOO_MANY_REQUESTS':
      return 'Bạn đã thử quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.';
    case 'CONFLICT':
      return 'Số CCCD này đã được dùng cho một hồ sơ khác. Liên hệ hỗ trợ.';
    case 'DOT_XAC_NHAN_DONG':
      return 'Đã hết thời gian chỉnh sửa';
    case 'DIEU_CHINH_MUC_DONG':
      return 'Đã hết thời gian điều chỉnh mức lớp học';
    case 'UNAUTHORIZED':
      return 'Phiên đăng nhập đã hết hạn';
    default:
      return err.message || 'Đã có lỗi xảy ra, thử lại sau.';
  }
}

/** Chuyển fields[] của lỗi VALIDATION_ERROR thành map field -> message để setError vào react-hook-form. */
export function loiFieldsThanhMap(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const f of err.fields) out[f.field] = f.message;
  return out;
}

export function laLoiDotDong(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === 'DOT_XAC_NHAN_DONG';
}

/** Như thongDiepLoiChung nhưng giữ thông điệp server cho 409 — dùng ở các thao tác có xung đột KHÔNG phải
 * CCCD (khóa lạc quan hậu cần, phân công đã xác nhận giờ...). thongDiepLoiChung map mọi CONFLICT thành
 * câu về CCCD (đúng cho màn hồ sơ học viên). */
export function thongDiepLoiXungDot(err: unknown): string {
  if (err instanceof ApiError && err.status === 409 && err.message) return err.message;
  return thongDiepLoiChung(err);
}
