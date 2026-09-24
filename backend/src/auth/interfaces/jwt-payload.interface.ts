import { vai_tro_nguoi_dung } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  ten_dang_nhap: string;
  vai_tro: vai_tro_nguoi_dung;
  don_vi_id: string | null;
  hoc_vien_id: string | null;
}

// Gắn vào Request bởi JwtAuthGuard sau khi xác thực token + tra lại DB để
// chắc tài khoản còn active (cho phép vô hiệu hóa tức thời qua trang_thai).
export interface AuthenticatedUser {
  id: string;
  ten_dang_nhap: string;
  vai_tro: vai_tro_nguoi_dung;
  don_vi_id: string | null;
  hoc_vien_id: string | null;
  phai_doi_mat_khau: boolean;
}
