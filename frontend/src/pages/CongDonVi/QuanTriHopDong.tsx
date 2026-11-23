import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDanhSachDotTrienKhai } from '@/api/dotTrienKhai';
import { useDanhSachHopDong, xuatKhtc, type DongHopDongQuanTri } from '@/api/hopDong';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay } from '@/lib/ngay';
import { taiFileTuBlob } from '@/lib/taiFile';
import { dinhDangSuat } from './danhSachThamGiaNhan';
import { TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG, dinhDangGiaTri } from './hopDongNhan';
import { dotDangChon } from './dotMacDinh';

export const DA_XUAT_KHTC = 'Đã xuất — file chứa STK cá nhân, chỉ gửi Phòng KHTC';
export const CHUA_CO_HOP_DONG_NOP = 'Chưa có hợp đồng nào đã nộp — chưa xuất được file cho KHTC';

const lienKetChiTiet = (dotId: string, donViId: string) => `/quan-tri/hop-dong/${dotId}/${donViId}`;

/** Quản trị: danh sách hợp đồng của 1 đợt (issue #67, ADR 0015 O1, O2, O4, P2) — STK cá nhân đã che (server che),
 * "Chi tiết" mở trang hợp đồng 1 trường (có nút "Hiện"); xuất Excel 3 sheet cho Phòng KHTC (chỉ hợp đồng đã nộp). */
export default function QuanTriHopDong() {
  const [params, setParams] = useSearchParams();
  const dsDot = useDanhSachDotTrienKhai();
  const dotId = dotDangChon(dsDot.data, params.get('dot'));
  const ds = useDanhSachHopDong(dotId);
  const nhoMan = useMediaQuery('(max-width: 48em)');
  const items = ds.data?.items ?? [];
  const soDaNop = items.filter((i) => i.trang_thai_hop_dong === 'da_nop').length;

  const xuat = useMutation({
    mutationFn: async () => {
      const blob = await xuatKhtc(dotId as string);
      taiFileTuBlob(blob, 'khtc-hop-dong.xlsx');
    },
    onSuccess: () => notifications.show({ color: 'green', message: DA_XUAT_KHTC }),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  function chonDot(v: string) {
    const moi = new URLSearchParams(params);
    moi.set('dot', v);
    setParams(moi, { replace: true });
  }

  return (
    <Container size="xl" py="lg" px="md">
      <Stack gap="md">
        <Title order={1} size="h3">
          Hợp đồng
        </Title>
        {dsDot.isLoading && <Skeleton height={56} radius="md" />}
        {dsDot.isError && <Alert color="red">{thongDiepLoiChung(dsDot.error)}</Alert>}
        {dsDot.data && dsDot.data.length === 0 && <Text c="dimmed">Chưa có đợt triển khai nào.</Text>}
        {dsDot.data && dsDot.data.length > 0 && (
          <Select
            label="Đợt triển khai"
            data={dsDot.data.map((d) => ({ value: d.id, label: `${d.chuong_trinh.toUpperCase()} – ${d.ten}` }))}
            value={dotId}
            onChange={(v) => v && chonDot(v)}
            allowDeselect={false}
            searchable
            maw={520}
          />
        )}

        {ds.isLoading && <Skeleton height={200} radius="md" aria-label="Đang tải hợp đồng" />}
        {ds.isError && (
          <Alert color="red" title="Không tải được danh sách hợp đồng">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(ds.error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => ds.refetch()} loading={ds.isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}
        {ds.data && dotId && (
          <>
            <Group gap="sm" align="center" justify="space-between">
              <Text fw={600}>
                {soDaNop}/{items.length} hợp đồng đã nộp
              </Text>
              <Stack gap={4} align="flex-end">
                <Button
                  variant="default"
                  loading={xuat.isPending}
                  disabled={soDaNop === 0}
                  onClick={() => xuat.mutate()}
                >
                  Xuất Excel cho KHTC
                </Button>
                {soDaNop === 0 && (
                  <Text size="xs" c="dimmed">
                    {CHUA_CO_HOP_DONG_NOP}
                  </Text>
                )}
              </Stack>
            </Group>
            <Text size="xs" c="dimmed">
              Số tài khoản cá nhân đã che còn 4 số cuối — xem đầy đủ ở "Chi tiết". File cho KHTC chỉ gồm hợp đồng đã
              nộp, lấy theo bản chụp hồ sơ lúc nộp.
            </Text>
            {items.length === 0 ? (
              <Text c="dimmed">Đợt này chưa có trường nào.</Text>
            ) : nhoMan ? (
              <Stack gap="sm" aria-label="Hợp đồng theo trường">
                {items.map((d) => (
                  <TheHopDong key={d.don_vi.id} d={d} dotId={dotId} />
                ))}
              </Stack>
            ) : (
              <BangHopDong items={items} dotId={dotId} />
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}

function TenTruong({ d }: { d: DongHopDongQuanTri }) {
  return (
    <div>
      <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
        {d.don_vi.ten}
      </Text>
      {d.don_vi.ma && (
        <Text size="xs" c="dimmed">
          {d.don_vi.ma}
        </Text>
      )}
    </div>
  );
}

function BadgeDanhSach({ d }: { d: DongHopDongQuanTri }) {
  const tt = TRANG_THAI_DANH_SACH[d.trang_thai_danh_sach];
  return (
    <Badge color={tt.mau} variant="light">
      {tt.nhan}
    </Badge>
  );
}

function BadgeHopDong({ d }: { d: DongHopDongQuanTri }) {
  const tt = TRANG_THAI_HOP_DONG[d.trang_thai_hop_dong];
  return (
    <Group gap={4}>
      <Badge color={tt.mau} variant="light">
        {tt.nhan}
      </Badge>
      {d.nop_luc && <Text size="xs">{dinhDangNgay(d.nop_luc)}</Text>}
      {d.qua_han && (
        <Badge color="red" variant="filled" tt="none">
          Quá hạn
        </Badge>
      )}
    </Group>
  );
}

/** Tên + STK đã che (server chỉ trả dạng che). */
function NguoiNhanTien({ ten, stkChe }: { ten: string | null; stkChe: string | null }) {
  return (
    <div>
      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
        {ten ?? '—'}
      </Text>
      {stkChe && (
        <Text size="xs" c="dimmed" ff="monospace">
          STK {stkChe}
        </Text>
      )}
    </div>
  );
}

function LienKetChiTiet({ d, dotId }: { d: DongHopDongQuanTri; dotId: string }) {
  return (
    <Button
      component={Link}
      to={lienKetChiTiet(dotId, d.don_vi.id)}
      size="xs"
      variant="subtle"
      aria-label={`Chi tiết hợp đồng ${d.don_vi.ten}`}
    >
      Chi tiết
    </Button>
  );
}

function BangHopDong({ items, dotId }: { items: DongHopDongQuanTri[]; dotId: string }) {
  return (
    <Table.ScrollContainer minWidth={1100}>
      <Table striped withTableBorder fz="sm" aria-label="Hợp đồng theo trường">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Trường</Table.Th>
            <Table.Th>Danh sách</Table.Th>
            <Table.Th>Hợp đồng</Table.Th>
            <Table.Th ta="right">Số người</Table.Th>
            <Table.Th ta="right">Tổng suất</Table.Th>
            <Table.Th ta="right">Giá trị</Table.Th>
            <Table.Th>Hiệu trưởng</Table.Th>
            <Table.Th>Kế toán</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((d) => (
            <Table.Tr key={d.don_vi.id}>
              <Table.Td>
                <TenTruong d={d} />
              </Table.Td>
              <Table.Td>
                <BadgeDanhSach d={d} />
              </Table.Td>
              <Table.Td>
                <BadgeHopDong d={d} />
              </Table.Td>
              <Table.Td ta="right">{d.so_nguoi}</Table.Td>
              <Table.Td ta="right">{dinhDangSuat(d.tong_suat)}</Table.Td>
              <Table.Td ta="right">{dinhDangGiaTri(d.gia_tri)}</Table.Td>
              <Table.Td>
                <NguoiNhanTien ten={d.ht_ho_ten} stkChe={d.ht_so_tai_khoan_che} />
              </Table.Td>
              <Table.Td>
                <NguoiNhanTien ten={d.kt_ho_ten} stkChe={d.kt_so_tai_khoan_che} />
              </Table.Td>
              <Table.Td>
                <LienKetChiTiet d={d} dotId={dotId} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Màn hẹp: mỗi trường 1 thẻ xếp dọc — không cuộn ngang trang ở 360px. */
function TheHopDong({ d, dotId }: { d: DongHopDongQuanTri; dotId: string }) {
  return (
    <Paper withBorder radius="md" p="sm" component="article" aria-label={d.don_vi.ten}>
      <Stack gap={6}>
        <TenTruong d={d} />
        <Text size="sm">
          {d.so_nguoi} người · {dinhDangSuat(d.tong_suat)} suất · {dinhDangGiaTri(d.gia_tri)}
        </Text>
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Danh sách
          </Text>
          <BadgeDanhSach d={d} />
        </Group>
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Hợp đồng
          </Text>
          <BadgeHopDong d={d} />
        </Group>
        <Group gap="lg" align="flex-start">
          <div>
            <Text size="xs" c="dimmed">
              Hiệu trưởng
            </Text>
            <NguoiNhanTien ten={d.ht_ho_ten} stkChe={d.ht_so_tai_khoan_che} />
          </div>
          <div>
            <Text size="xs" c="dimmed">
              Kế toán
            </Text>
            <NguoiNhanTien ten={d.kt_ho_ten} stkChe={d.kt_so_tai_khoan_che} />
          </div>
        </Group>
        <LienKetChiTiet d={d} dotId={dotId} />
      </Stack>
    </Paper>
  );
}
