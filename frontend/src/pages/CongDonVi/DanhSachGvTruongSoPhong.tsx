import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useDanhSachGvSoPhong, type DanhSachGvSoPhong, type DongDanhSachSoPhong } from '@/api/donViTienDo';
import { ApiError } from '@/api/client';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { NHAN_GIAI_DOAN, NHAN_Y_KIEN, dinhDangSuat } from './danhSachThamGiaNhan';
import { TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG, dinhDangGiaTri } from './hopDongNhan';

const ngaySinh = (d: DongDanhSachSoPhong) => (d.ngay_sinh ? dinhDangNgayLich(d.ngay_sinh) : '—');

function YKien({ d }: { d: DongDanhSachSoPhong }) {
  const yk = NHAN_Y_KIEN[d.y_kien_truong ?? 'chua_co'];
  return (
    <Badge color={yk.mau} variant="light" tt="none">
      {yk.nhan}
    </Badge>
  );
}

/** Sở/Phòng xem danh sách GV của 1 trường trong phạm vi (issue #71 / ADR 0015 O3) — chỉ xem, không sửa, không
 * thông tin tài khoản/người nhận/liên hệ. Ngoài phạm vi → API 404. */
export default function DanhSachGvTruongSoPhong() {
  const { dotId = '', donViId = '' } = useParams();
  const q = useDanhSachGvSoPhong(dotId, donViId);
  const nhoMan = useMediaQuery('(max-width: 48em)');
  const khongThay = q.error instanceof ApiError && q.error.status === 404;

  return (
    <Container size="xl" py="lg" px="md">
      <Stack gap="md">
        <Anchor component={Link} to={`/trang-chu?dot=${encodeURIComponent(dotId)}`} size="sm">
          ← Về bảng tiến độ
        </Anchor>

        {q.isLoading && <Skeleton height={240} radius="md" aria-label="Đang tải danh sách" />}
        {q.isError &&
          (khongThay ? (
            <Paper withBorder radius="md" p="md">
              <Text c="dimmed">Không tìm thấy danh sách của trường này trong phạm vi của đơn vị.</Text>
            </Paper>
          ) : (
            <Alert color="red" title="Không tải được danh sách">
              <Stack gap="sm" align="flex-start">
                <Text size="sm">{thongDiepLoiChung(q.error)}</Text>
                <Button size="sm" variant="light" color="red" onClick={() => q.refetch()} loading={q.isFetching}>
                  Thử lại
                </Button>
              </Stack>
            </Alert>
          ))}
        {q.data && <NoiDung data={q.data} nhoMan={!!nhoMan} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ data, nhoMan }: { data: DanhSachGvSoPhong; nhoMan: boolean }) {
  const ds = TRANG_THAI_DANH_SACH[data.trang_thai_danh_sach];
  const hd = TRANG_THAI_HOP_DONG[data.trang_thai_hop_dong];
  return (
    <>
      <div>
        <Title order={1} size="h3" style={{ overflowWrap: 'anywhere' }}>
          {data.truong.ten}
        </Title>
        <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
          {[data.truong.ma, data.dot.ten].filter(Boolean).join(' · ')}
        </Text>
      </div>
      <Group gap="xs">
        <Badge color={ds.mau} variant="light">
          Danh sách: {ds.nhan}
        </Badge>
        <Badge color={hd.mau} variant="light">
          Hợp đồng: {hd.nhan}
        </Badge>
        <Badge color="gray" variant="light">
          Chỉ xem
        </Badge>
      </Group>

      {data.dong.length === 0 ? (
        <Text c="dimmed">Danh sách của trường đang trống</Text>
      ) : nhoMan ? (
        <Stack gap="sm" aria-label="Danh sách giáo viên">
          {data.dong.map((d) => (
            <TheGv key={d.id} d={d} />
          ))}
        </Stack>
      ) : (
        <BangGv dong={data.dong} />
      )}

      <Paper withBorder radius="md" p="sm" aria-label="Tổng cộng" component="section">
        <Text fw={600} size="sm">
          Tổng: {data.so_nguoi} GV · {dinhDangSuat(data.tong_suat)} suất · {dinhDangGiaTri(data.gia_tri)}
        </Text>
        {data.trang_thai_hop_dong === 'da_nop' && (
          <Text size="xs" c="dimmed">
            Số liệu lúc trường nộp hợp đồng.
          </Text>
        )}
      </Paper>
    </>
  );
}

function BangGv({ dong }: { dong: DongDanhSachSoPhong[] }) {
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table striped withTableBorder fz="sm" aria-label="Danh sách giáo viên">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Họ tên</Table.Th>
            <Table.Th>Ngày sinh</Table.Th>
            <Table.Th>Giới tính</Table.Th>
            <Table.Th>Lớp/môn</Table.Th>
            <Table.Th>Giai đoạn</Table.Th>
            <Table.Th ta="right">Suất</Table.Th>
            <Table.Th>Ghi chú</Table.Th>
            <Table.Th>Ý kiến trường</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dong.map((d) => (
            <Table.Tr key={d.id}>
              <Table.Td fw={600}>{d.ho_ten}</Table.Td>
              <Table.Td>{ngaySinh(d)}</Table.Td>
              <Table.Td>{d.gioi_tinh ?? '—'}</Table.Td>
              <Table.Td>{d.lop ?? '—'}</Table.Td>
              <Table.Td>{NHAN_GIAI_DOAN[d.giai_doan]}</Table.Td>
              <Table.Td ta="right">{dinhDangSuat(d.ty_le_suat)}</Table.Td>
              <Table.Td>{d.ghi_chu ?? '—'}</Table.Td>
              <Table.Td>
                <YKien d={d} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function TheGv({ d }: { d: DongDanhSachSoPhong }) {
  return (
    <Paper withBorder radius="md" p="sm" component="article" aria-label={d.ho_ten}>
      <Stack gap={4}>
        <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
          {d.ho_ten}
        </Text>
        <Text size="xs" c="dimmed">
          {[ngaySinh(d), d.gioi_tinh, d.lop].filter(Boolean).join(' · ')}
        </Text>
        <Text size="sm">
          {NHAN_GIAI_DOAN[d.giai_doan]} · {dinhDangSuat(d.ty_le_suat)} suất
        </Text>
        {d.ghi_chu && (
          <Text size="xs" style={{ overflowWrap: 'anywhere' }}>
            Ghi chú: {d.ghi_chu}
          </Text>
        )}
        <div>
          <YKien d={d} />
        </div>
      </Stack>
    </Paper>
  );
}
