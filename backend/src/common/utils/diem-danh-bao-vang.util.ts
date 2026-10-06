// ADR 0004 G13 (issue #18): hợp nhất điểm danh nạp vào với báo vắng đã ghi
// trước. Dùng khi nạp mẫu điểm danh (L6): "vắng" + có báo vắng → "vắng có
// phép"; "có mặt" luôn thắng (học viên báo vắng nhưng vẫn đến học).

export type TrangThaiDiemDanh = 'co_mat' | 'vang' | 'vang_co_phep';

export function hopNhatDiemDanh(
  nap: TrangThaiDiemDanh,
  coBaoVang: boolean,
): TrangThaiDiemDanh {
  if (nap === 'vang' && coBaoVang) return 'vang_co_phep';
  return nap;
}
