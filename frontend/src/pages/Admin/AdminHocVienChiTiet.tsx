import { useParams } from 'react-router-dom';
import { Alert, Container, Group, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { useHocVienTheoId } from '@/api/admin';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

// Placeholder tối thiểu cho phase này (yêu cầu phase 3 mục 4: "chưa cần đẹp, sẽ hoàn thiện ở phase
// sau") — hiện vài field chính từ GET /hoc-vien/{id}, không phải màn chi tiết đầy đủ.
const TRUONG_HIEN_THI = [
  'ma_dinh_danh_moet',
  'so_dinh_danh_ca_nhan',
  'ngay_sinh',
  'thang_sinh',
  'nam_sinh',
  'gioi_tinh',
  'chuc_vu',
  'so_dien_thoai_lien_he',
  'email_lien_he',
  'trinh_do_chuyen_mon',
  'cap_giang_day',
] as const;

export default function AdminHocVienChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useHocVienTheoId(id);

  return (
    <>
      <AdminPageHeader title="Chi tiết hồ sơ học viên" />
      <Container size="sm" py="lg" px={{ base: 'md', md: 28 }}>
        {isLoading && (
          <Stack gap="sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </Stack>
        )}

        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}

        {data && (
          <Paper withBorder radius={14} p="lg">
            <Group justify="space-between" mb="md">
              <Text fz={18} fw={700}>
                {data.ho_ten ?? '(Chưa có tên)'}
              </Text>
              <TrangThaiBadge trangThai={data.trang_thai} />
            </Group>
            <Text fz={13} c="dimmed" mb="lg">
              {data.don_vi_cong_tac_ten ?? data.don_vi_cong_tac_id ?? '—'}
            </Text>

            <Stack gap="xs">
              {TRUONG_HIEN_THI.map((truong) => (
                <Group key={truong} justify="space-between" py={6} style={{ borderBottom: '1px solid #F1F3F6' }}>
                  <Text fz={13} c="dimmed">
                    {nhanCuaTruong(truong)}
                  </Text>
                  <Text fz={13} fw={600}>
                    {String(data[truong] ?? '—')}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}
      </Container>
    </>
  );
}
