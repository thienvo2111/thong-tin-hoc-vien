import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { theoDoiPhienHetHan } from '@/auth/session';

/** Xóa toàn bộ cache TanStack Query khi đăng xuất hoặc phiên hết hạn (401) — không giữ lại hồ sơ/CCCD cũ trong bộ nhớ. */
export function LamMoiCacheKhiHetPhien() {
  const queryClient = useQueryClient();
  useEffect(() => theoDoiPhienHetHan(() => queryClient.clear()), [queryClient]);
  return null;
}
