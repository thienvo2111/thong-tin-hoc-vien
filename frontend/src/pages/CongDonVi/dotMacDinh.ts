import type { DotTrienKhai } from '@/api/dotTrienKhai';

// Chọn đợt trên các màn Quản trị theo đợt (Tiến độ đợt #65, Hợp đồng #67): ?dot= nếu hợp lệ, không thì mặc định.

/** Mặc định: đợt có hạn nộp muộn nhất (đợt đang chạy gần đây nhất). */
export function dotMacDinh(ds: DotTrienKhai[]): string | null {
  if (ds.length === 0) return null;
  return ds.reduce((a, b) => (b.han_nop > a.han_nop ? b : a)).id;
}

/** Đợt đang chọn: `?dot=` khi có trong danh sách, ngược lại đợt mặc định (null khi chưa có đợt nào). */
export function dotDangChon(ds: DotTrienKhai[] | undefined, thamSo: string | null): string | null {
  return (ds?.some((d) => d.id === thamSo) ? thamSo : null) ?? dotMacDinh(ds ?? []);
}
