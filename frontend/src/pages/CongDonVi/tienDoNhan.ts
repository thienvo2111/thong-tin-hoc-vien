import { LOC_TIEN_DO, type LocTienDo, type TongHopTienDo } from '@/api/tienDoDot';

// Bộ lọc bảng tiến độ dùng chung: Quản trị (issue #65) và Sở/Phòng (issue #71).
export const NHAN_LOC: Record<LocTienDo, string> = {
  tat_ca: 'Tất cả',
  chua_xac_nhan_ds: 'Chưa xác nhận DS',
  bao_sai_lech: 'Báo sai lệch',
  chua_nop_hd: 'Chưa nộp HĐ',
  qua_han: 'Quá hạn',
};

/** Số trường mỗi bộ lọc, suy ra từ tổng hợp (không phụ thuộc bộ lọc đang chọn). */
export function soTheoLoc(t: TongHopTienDo): Record<LocTienDo, number> {
  return {
    tat_ca: t.so_truong,
    chua_xac_nhan_ds: t.so_truong - t.so_da_xac_nhan_ds,
    bao_sai_lech: t.so_bao_sai_lech,
    chua_nop_hd: t.so_truong - t.so_da_nop,
    qua_han: t.so_qua_han,
  };
}

export const laLoc = (v: string | null): v is LocTienDo => !!v && (LOC_TIEN_DO as readonly string[]).includes(v);
