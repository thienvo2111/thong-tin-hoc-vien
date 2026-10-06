import { Link } from 'react-router-dom';
import { Alert, Anchor, Badge, Button, Container, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useCumCuaToi } from '@/api/hoTro';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung } from '@/lib/loiApi';

/** Trang chủ người hỗ trợ học viên (ADR 0003): các cụm được phân công. */
export default function HoTroTrangChu() {
  const { data, isLoading, isError, error } = useCumCuaToi();

  return (
    <Container size="lg" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Title order={3}>Cụm hỗ trợ của tôi</Title>
        {isLoading && <Skeleton height={120} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Alert color="yellow" variant="light">
            Tài khoản chưa được phân công cụm nào. Vui lòng liên hệ Quản trị để được phân công.
          </Alert>
        )}
        {data && data.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {data.map((c) => {
              const zalo = c.link_zalo ? chuanHoaLienKet(c.link_zalo) : null;
              return (
                <Paper key={c.cum_id} withBorder radius={14} p="md">
                  <Stack gap={6}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text fw={700}>{c.ten_cum}</Text>
                      {c.trang_thai !== 'active' && (
                        <Badge color="gray" variant="light">
                          Đã ngừng
                        </Badge>
                      )}
                    </Group>
                    <Text fz="sm" c="dimmed">
                      {c.ma_khoa} · {c.ten_khoa}
                    </Text>
                    <Text fz="sm">{c.so_hoc_vien.toLocaleString('vi-VN')} học viên</Text>
                    {zalo && (
                      <Anchor href={zalo} target="_blank" rel="noreferrer" fz="sm">
                        Nhóm Zalo của cụm
                      </Anchor>
                    )}
                    <Group gap="xs" mt={4}>
                      <Button component={Link} to={`/ho-tro/hoc-vien?cum_id=${c.cum_id}`} size="xs">
                        Xem học viên
                      </Button>
                      <Button component={Link} to={`/ho-tro/lich-hoc?cum_id=${c.cum_id}`} size="xs" variant="light">
                        Lịch học
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
