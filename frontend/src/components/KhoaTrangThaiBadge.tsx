import { Badge } from '@mantine/core';
import { mauTrangThaiKhoa, nhanTrangThaiKhoa } from '@/lib/trangThaiKhoa';

/** Badge trạng thái khóa bồi dưỡng (nhap/cho_duyet/da_duyet/tu_choi/dong_dang_ky) — tương tự
 * TrangThaiBadge (hồ sơ học viên) nhưng dùng bảng nhãn/màu riêng vì tập trạng thái khác nhau. */
export function KhoaTrangThaiBadge({ trangThai }: { trangThai: string }) {
  const { bg, mau } = mauTrangThaiKhoa(trangThai);
  return (
    <Badge radius="xl" styles={{ root: { backgroundColor: bg, color: mau } }}>
      {nhanTrangThaiKhoa(trangThai)}
    </Badge>
  );
}
