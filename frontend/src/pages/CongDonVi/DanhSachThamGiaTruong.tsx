import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { ApiError } from '@/api/client';
import { useDanhSachCuaTruong, type DanhSachCuaTruong, type DongDanhSachTruong } from '@/api/truongDanhSach';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich, dinhDangTien } from '@/lib/ngayLich';
import { tokenKhac } from '@/theme';
import { NHAN_GIAI_DOAN, dinhDangSuat } from './danhSachThamGiaNhan';
import { NHAN_CHUONG_TRINH_NGAN, TRANG_THAI_DANH_SACH } from './hopDongNhan';

/** Màn "Xem danh sách tham gia" của trường (issue #60, ADR 0015 U1, X6): mỗi người một thẻ (mobile-first),
 * cuối màn tổng suất + giá trị tạm tính. Chỉ xem — đồng ý/không đồng ý ở lát sau (#61). */
export default function DanhSachThamGiaTruong() {
  const { dotId = '' } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useDanhSachCuaTruong(dotId);
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="sm" py="lg" px="md">
      <Stack gap="md">
        <Anchor component={Link} to="/trang-chu" size="sm">
          ← Trang chủ
        </Anchor>

        {isLoading && (
          <Stack gap="sm" aria-label="Đang tải">
            <Skeleton height={56} radius="md" />
            <Skeleton height={96} radius="md" />
            <Skeleton height={96} radius="md" />
          </Stack>
        )}

        {isError && khongThay && (
          <Paper withBorder radius="md" p="md">
            <Text>Không tìm thấy danh sách của trường cho đợt này</Text>
          </Paper>
        )}

        {isError && !khongThay && (
          <Alert color="red" title="Không tải được danh sách">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}

        {data && <NoiDung ds={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ ds }: { ds: DanhSachCuaTruong }) {
  const tt = TRANG_THAI_DANH_SACH[ds.trang_thai_danh_sach];
  return (
    <>
      <Stack gap={4}>
        <Group gap="xs">
          <Badge variant="filled">{NHAN_CHUONG_TRINH_NGAN[ds.dot.chuong_trinh]}</Badge>
          <Badge color={tt.mau} variant="light">
            {tt.nhan}
          </Badge>
        </Group>
        <Title order={1} size="h3" style={{ overflowWrap: 'anywhere' }}>
          Danh sách tham gia — {ds.dot.ten}
        </Title>
        <Text size="sm" c="dimmed">
          Hạn nộp: {dinhDangNgayLich(ds.dot.han_nop_ngay)} · {ds.dong.length} người
        </Text>
      </Stack>

      {ds.dong.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text c="dimmed">Danh sách của trường cho đợt này chưa có người nào.</Text>
        </Paper>
      ) : (
        <Stack component="ol" gap="sm" m={0} p={0} style={{ listStyle: 'none' }} aria-label="Người tham gia">
          {ds.dong.map((d) => (
            <TheNguoi key={d.id} d={d} />
          ))}
        </Stack>
      )}

      <Box
        component="section"
        aria-label="Tổng cộng"
        pos="sticky"
        bottom={0}
        py="sm"
        style={{ background: tokenKhac.bg, borderTop: `1px solid ${tokenKhac.border}` }}
      >
        <Text fw={600}>Tổng suất: {dinhDangSuat(ds.tong_suat)}</Text>
        <Text fw={600}>
          Giá trị tạm tính: {ds.gia_tri_tam_tinh === null ? 'chưa có đơn giá' : dinhDangTien(ds.gia_tri_tam_tinh)}
        </Text>
      </Box>
    </>
  );
}

function TheNguoi({ d }: { d: DongDanhSachTruong }) {
  return (
    <Paper component="li" withBorder radius="md" p="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
          {d.ho_ten}
        </Text>
        <Badge variant="light" style={{ flexShrink: 0 }}>
          {dinhDangSuat(d.ty_le_suat)} suất
        </Badge>
      </Group>
      <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
        Ngày sinh: {d.ngay_sinh ? dinhDangNgayLich(d.ngay_sinh) : '—'} · Lớp/môn: {d.lop || '—'} · Giai đoạn:{' '}
        {NHAN_GIAI_DOAN[d.giai_doan]}
      </Text>
      {d.ghi_chu && (
        <Text size="sm" c="orange.8" style={{ overflowWrap: 'anywhere' }}>
          Ghi chú: {d.ghi_chu}
        </Text>
      )}
    </Paper>
  );
}
