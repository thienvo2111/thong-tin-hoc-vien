import { Stack, Text } from '@mantine/core';
import type { KhoaHocDangKy } from '@/api/types';
import { nhanKetQuaHeThong, nhanMucNangLuc } from '@/lib/mucNangLuc';
import { dinhDangNgayGio } from '@/lib/ngay';

type DuLieuMuc = Pick<
  KhoaHocDangKy,
  'muc_dau_vao' | 'muc_hoc_chon' | 'muc_hoc_chon_luc' | 'muc_he_thong' | 'nhan_muc_goc_danh_gia'
>;

/** ADR 0006: 3 nguồn mức đầu vào của 1 khóa — kết quả hệ thống, nhu cầu học viên, mức chính thức (chốt).
 * Chỉ mức chính thức dùng để xếp lớp. Dùng chung cho học viên (M7) và Quản trị. */
export function CacNguonMucHoc({ dangKy }: { dangKy: DuLieuMuc }) {
  const heThong = nhanKetQuaHeThong(dangKy);
  const nhuCau = dangKy.muc_hoc_chon
    ? nhanMucNangLuc(dangKy.muc_hoc_chon)
    : dangKy.muc_he_thong
      ? 'Học theo kết quả đánh giá'
      : 'Chưa chọn';

  return (
    <Stack gap={2} data-testid="cac-nguon-muc-hoc">
      <Text size="sm">
        Kết quả hệ thống: <b>{heThong ?? 'Chưa có kết quả'}</b>
      </Text>
      <Text size="sm">
        Nhu cầu đã chọn: <b>{nhuCau}</b>
      </Text>
      {dangKy.muc_hoc_chon_luc && (
        <Text size="xs" c="dimmed">
          Đã điều chỉnh lúc {dinhDangNgayGio(dangKy.muc_hoc_chon_luc)}
        </Text>
      )}
      <Text size="sm">
        Mức chính thức (xếp lớp): <b>{dangKy.muc_dau_vao ? nhanMucNangLuc(dangKy.muc_dau_vao) : 'Chưa chốt'}</b>
      </Text>
    </Stack>
  );
}
