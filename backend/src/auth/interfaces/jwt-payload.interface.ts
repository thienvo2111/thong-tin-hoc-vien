import { vai_tro_nguoi_dung } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  ten_dang_nhap: string;
  vai_tro: vai_tro_nguoi_dung;
  don_vi_id: string | null;
  hoc_vien_id: string | null;
  // Thêm 2026-09-28: định danh duy nhất mỗi token, dùng làm khóa của bảng
  // token_thu_hoi cho POST /auth/dang-xuat (JWT vốn stateless).
  jti: string;
}

// verifyAsync() trả thêm iat/exp chuẩn JWT bên cạnh payload tự khai báo —
// tách riêng type này thay vì nhét exp vào JwtPayload vì exp không phải do
// ta set trực tiếp (suy ra từ signOptions.expiresIn lúc ký).
export type DecodedJwtPayload = JwtPayload & { iat: number; exp: number };

// Gắn vào Request bởi JwtAuthGuard sau khi xác thực token + tra lại DB để
// chắc tài khoản còn active (cho phép vô hiệu hóa tức thời qua trang_thai).
export interface AuthenticatedUser {
  id: string;
  ten_dang_nhap: string;
  vai_tro: vai_tro_nguoi_dung;
  don_vi_id: string | null;
  hoc_vien_id: string | null;
  phai_doi_mat_khau: boolean;
  // jti/exp của token hiện tại — cần cho POST /auth/dang-xuat để ghi đúng
  // dòng token_thu_hoi (het_han = hạn gốc của token, không phải hạn mới).
  jti: string;
  exp: number;
}
