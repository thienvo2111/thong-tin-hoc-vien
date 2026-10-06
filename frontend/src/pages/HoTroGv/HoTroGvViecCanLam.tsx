import { Link } from 'react-router-dom';
import { Alert, Anchor, Badge, Container, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDemViecCanLam, useViecCanLam } from '@/api/bangKiem';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { MAU_DOT } from './KhungBangKiem';
import { NHAN_NHAC } from '@/api/nhacLich';

/** Việc cần làm (ADR 0004 L4, issue #17) — đợt trực tiếp trong 21 ngày tới, màu theo bảng kiểm. */
export default function HoTroGvViecCanLam() {
  const { data, isLoading, isError, error } = useViecCanLam();
  const soDeNghi = useDemViecCanLam().data?.de_nghi ?? 0;

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Title order={3}>Việc cần làm</Title>
        <Text fz="sm" c="dimmed">
          Các đợt học trực tiếp trong 21 ngày tới. Đỏ = có mục quá hạn, vàng = còn việc chưa xong, xanh = sẵn sàng.
        </Text>
        {soDeNghi > 0 && (
          <Alert color="yellow" variant="light">
            Có {soDeNghi} đề nghị đổi lớp chờ duyệt.{' '}
            <Anchor component={Link} to="/ho-tro-gv/de-nghi-doi-lop" fw={600}>
              Xem đề nghị
            </Anchor>
          </Alert>
        )}
        {isLoading && <Skeleton height={160} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            Không có đợt học trực tiếp nào trong 21 ngày tới.
          </Text>
        )}
        {(data ?? []).map((d) => (
          <Paper key={`${d.lop.id}|${d.giai_doan.id}`} withBorder radius={12} p="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Anchor component={Link} to={`/ho-tro-gv/lop/${d.lop.id}/giai-doan/${d.giai_doan.id}`} fw={700}>
                  {d.lop.ten_lop} · GĐ {d.giai_doan.thu_tu} — {d.giai_doan.ten_giai_doan}
                </Anchor>
                <Text fz="xs" c="dimmed">
                  {d.lop.khoa.ma_khoa} · buổi đầu {d.buoi_dau ? dinhDangNgayGio(d.buoi_dau) : '—'}
                </Text>
              </div>
              <Badge color={MAU_DOT[d.mau].mau} size="lg">
                {MAU_DOT[d.mau].nhan}
              </Badge>
            </Group>
            {(d.nhac_gv ?? []).length > 0 && (
              <Text fz="sm" mt="xs" c="orange.8">
                Nhắc lịch giảng viên:{' '}
                {(d.nhac_gv ?? []).map((n) => `${n.ho_ten} (${NHAN_NHAC[n.trang_thai].nhan.toLowerCase()})`).join(', ')}
              </Text>
            )}
            {d.muc_chua_dat.length > 0 && (
              <Stack gap={2} mt="xs">
                {d.muc_chua_dat.map((m) => (
                  <Text key={m.ten} fz="sm" c={m.trang_thai === 'qua_han' ? 'red' : undefined}>
                    • {m.ten}
                    {m.han ? ` (hạn ${dinhDangNgay(m.han)})` : ''}
                  </Text>
                ))}
              </Stack>
            )}
          </Paper>
        ))}
      </Stack>
    </Container>
  );
}
