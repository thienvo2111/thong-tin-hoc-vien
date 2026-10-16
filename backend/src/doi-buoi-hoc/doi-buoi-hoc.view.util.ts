// Hàm thuần dùng chung cho các màn đọc theo buổi (trang lớp, bảng điểm danh) —
// spec đổi buổi §5. Dữ liệu vào là kết quả DoiBuoiHocQueryService.dieuChinhTheoBuoi.

export type NhanDoiBuoi = Record<string, { loai: 'ra' | 'vao'; lop: string }>;

export type DieuChinhTheoBuoi = ReadonlyMap<
  string,
  {
    ra: { dang_ky_hoc_id: string; lop_chot: { ten_lop: string } }[];
    vao: { dang_ky_hoc_id: string; lop_nguon: { ten_lop: string } }[];
  }
>;

/** dang_ky_hoc_id → (lich_hoc_id → nhãn đổi ra / đổi vào). */
export function nhanDoiBuoiTheoDangKy(
  dieuChinh: DieuChinhTheoBuoi,
): Map<string, NhanDoiBuoi> {
  const nhan = new Map<string, NhanDoiBuoi>();
  const gan = (dkId: string, lichId: string, loai: 'ra' | 'vao', lop: string) =>
    nhan.set(dkId, { ...nhan.get(dkId), [lichId]: { loai, lop } });
  for (const [lichId, dc] of dieuChinh) {
    for (const r of dc.ra) {
      gan(r.dang_ky_hoc_id, lichId, 'ra', r.lop_chot.ten_lop);
    }
    for (const v of dc.vao) {
      gan(v.dang_ky_hoc_id, lichId, 'vao', v.lop_nguon.ten_lop);
    }
  }
  return nhan;
}

/** Chỉ giữ các ô (điểm danh, báo vắng…) của những buổi có trong nhãn. */
export function chiOCuaBuoi<T>(
  o: Record<string, T>,
  nhan: NhanDoiBuoi,
): Record<string, T> {
  return Object.fromEntries(Object.entries(o).filter(([id]) => id in nhan));
}
