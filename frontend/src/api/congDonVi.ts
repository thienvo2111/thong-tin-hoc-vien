import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

// Issue #70 / ADR 0015 P1: đơn vị đang tham gia chương trình nào (nhóm menu NLS chỉ hiện khi nls=true).
export interface ChuongTrinhCuaToi {
  nls: boolean;
}

/** Vai trò đơn vị được gọi GET /cong-don-vi/toi/chuong-trinh (Quản trị, học viên… nhận 403). */
export const VAI_TRO_DON_VI_NLS = ['truong', 'phong_vhxh', 'so_gddt'];

/** `batDau=false` (vai trò khác) → không gọi API. Cache 5 phút; cache bị xóa khi đăng xuất. */
export function useChuongTrinhCuaToi(batDau: boolean) {
  return useQuery({
    queryKey: ['cong-don-vi', 'toi', 'chuong-trinh'],
    queryFn: () => apiFetch<ChuongTrinhCuaToi>('/cong-don-vi/toi/chuong-trinh'),
    enabled: batDau,
    staleTime: 5 * 60 * 1000,
  });
}
