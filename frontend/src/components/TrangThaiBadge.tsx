import { Badge } from '@mantine/core';
import { mauTrangThaiHoSo, nhanTrangThaiHoSo } from '@/lib/trangThaiHoSo';

/** Badge trạng thái hồ sơ (nhap/cho_duyet/da_duyet/tu_choi) theo màu token trong design/redesign-spec.md § 1. */
export function TrangThaiBadge({ trangThai }: { trangThai: string }) {
  const { bg, mau } = mauTrangThaiHoSo(trangThai);
  return (
    <Badge radius="xl" styles={{ root: { backgroundColor: bg, color: mau } }}>
      {nhanTrangThaiHoSo(trangThai)}
    </Badge>
  );
}
