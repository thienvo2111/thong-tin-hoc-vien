import { Text } from '@mantine/core';
import type { LichTrung } from '@/api/doiBuoi';
import { dinhDangGio, dinhDangThuNgay } from '@/lib/ngay';

const TOI_DA_HIEN = 2;

/** "Buổi 3 · Lớp 01 · Thứ bảy, 14/11/2026 08:00–12:00" */
export function moTaBuoiTrung(b: LichTrung): string {
  return `Buổi ${b.buoi_so} · ${b.lop.ten_lop} · ${dinhDangThuNgay(b.thoi_gian_bat_dau)} ${dinhDangGio(
    b.thoi_gian_bat_dau,
  )}–${dinhDangGio(b.thoi_gian_ket_thuc)}`;
}

/** "Buổi 3 · Lớp 01 · …; Buổi 4 · … +1 buổi khác" — tối đa 2 buổi. */
export function moTaDsTrung(ds: LichTrung[]): string {
  const conLai = ds.length - TOI_DA_HIEN;
  return ds.slice(0, TOI_DA_HIEN).map(moTaBuoiTrung).join('; ') + (conLai > 0 ? ` +${conLai} buổi khác` : '');
}

/** Cảnh báo gọn (1 dòng chữ cam) khi buổi trùng giờ với buổi khác trên lịch học viên — chỉ cảnh báo, không chặn. */
export function CanhBaoTrungLich({ ds }: { ds?: LichTrung[] }) {
  if (!ds || ds.length === 0) return null;
  return (
    <Text fz="xs" c="orange.8" fw={600} lh={1.35} data-testid="canh-bao-trung-lich">
      <span aria-hidden="true">⚠ </span>
      Trùng giờ với {moTaDsTrung(ds)}
    </Text>
  );
}
