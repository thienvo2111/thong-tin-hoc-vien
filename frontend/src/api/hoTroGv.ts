import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { LoaiLop, TrangThaiActive } from './types';

// Khu người hỗ trợ giảng viên (ADR 0004) — API /ho-tro-giang-vien/*, backend tự lọc theo nhóm của khóa.
export interface LopCuaToiGv {
  id: string;
  ten_lop: string;
  loai_lop: LoaiLop;
  trang_thai: TrangThaiActive;
  khoa: { id: string; ma_khoa: string; ten_khoa: string };
  _count: { lich_hoc: number };
}

export function useLopCuaToiGv() {
  return useQuery({
    queryKey: ['ho-tro-gv', 'lop-cua-toi'],
    queryFn: () => apiFetch<LopCuaToiGv[]>('/ho-tro-giang-vien/lop-cua-toi'),
  });
}
