/** Đủ để chọn đợt: DotTrienKhai của Quản trị, hoặc `dot` trên thẻ đợt của Sở/Phòng (issue #71). */
type DotChon = { id: string; han_nop: string };

// Chọn đợt trên các màn theo đợt (Tiến độ đợt #65, Hợp đồng #67, trang chủ Sở/Phòng #71): ?dot= nếu hợp lệ,
// không thì mặc định.

/** Mặc định: đợt có hạn nộp muộn nhất (đợt đang chạy gần đây nhất). */
export function dotMacDinh(ds: DotChon[]): string | null {
  if (ds.length === 0) return null;
  return ds.reduce((a, b) => (b.han_nop > a.han_nop ? b : a)).id;
}

/** Đợt đang chọn: `?dot=` khi có trong danh sách, ngược lại đợt mặc định (null khi chưa có đợt nào). */
export function dotDangChon(ds: DotChon[] | undefined, thamSo: string | null): string | null {
  return (ds?.some((d) => d.id === thamSo) ? thamSo : null) ?? dotMacDinh(ds ?? []);
}
