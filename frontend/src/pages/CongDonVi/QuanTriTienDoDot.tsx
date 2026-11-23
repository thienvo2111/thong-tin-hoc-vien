import { Suspense, lazy, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Chip,
  Container,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDanhSachDotTrienKhai } from '@/api/dotTrienKhai';
import {
  LOC_TIEN_DO,
  useTienDoDot,
  xuatExcelTienDoDot,
  type DongTienDo,
  type LocTienDo,
  type TongHopTienDo,
} from '@/api/tienDoDot';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { taiFileTuBlob } from '@/lib/taiFile';
import { khopTimKiem } from '@/lib/timKiemTiengViet';
import { dinhDangSuat } from './danhSachThamGiaNhan';
import { TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG, dinhDangGiaTri } from './hopDongNhan';
import { dotDangChon } from './dotMacDinh';

// Issue #66: hộp thoại Gia hạn riêng (kèm @mantine/dates) chỉ tải khi mở — trang bảng không nặng thêm.
const ModalGiaHanRieng = lazy(() => import('./ModalGiaHanRieng').then((m) => ({ default: m.ModalGiaHanRieng })));

const NHAN_LOC: Record<LocTienDo, string> = {
  tat_ca: 'Tất cả',
  chua_xac_nhan_ds: 'Chưa xác nhận DS',
  bao_sai_lech: 'Báo sai lệch',
  chua_nop_hd: 'Chưa nộp HĐ',
  qua_han: 'Quá hạn',
};

function soTheoLoc(t: TongHopTienDo): Record<LocTienDo, number> {
  return {
    tat_ca: t.so_truong,
    chua_xac_nhan_ds: t.so_truong - t.so_da_xac_nhan_ds,
    bao_sai_lech: t.so_bao_sai_lech,
    chua_nop_hd: t.so_truong - t.so_da_nop,
    qua_han: t.so_qua_han,
  };
}

const laLoc = (v: string | null): v is LocTienDo => !!v && (LOC_TIEN_DO as readonly string[]).includes(v);

const lienKetDanhSach = (dotId: string, donViId: string) =>
  `/quan-tri/danh-sach-tham-gia?${new URLSearchParams({ dot: dotId, don_vi_id: donViId })}`;
const lienKetHopDong = (dotId: string, donViId: string) => `/quan-tri/hop-dong/${dotId}/${donViId}`;

/** Quản trị: bảng Tiến độ đợt (issue #65, ADR 0015 X7, T5, P2) — mỗi trường 1 dòng, lọc theo trạng thái,
 * xuất Excel trường chưa xong kèm người liên hệ. Không nhắc tự động — HCMUE tự gọi/Zalo theo file. */
export default function QuanTriTienDoDot() {
  const [params, setParams] = useSearchParams();
  const dsDot = useDanhSachDotTrienKhai();
  const dotId = dotDangChon(dsDot.data, params.get('dot'));
  const locParam = params.get('loc');
  const loc: LocTienDo = laLoc(locParam) ? locParam : 'tat_ca';
  const [tuKhoa, setTuKhoa] = useState('');
  // Issue #66 / T3: trường đang mở "Gia hạn riêng".
  const [giaHan, setGiaHan] = useState<DongTienDo | null>(null);
  const tienDo = useTienDoDot(dotId, loc);
  const nhoMan = useMediaQuery('(max-width: 48em)');

  const xuat = useMutation({
    mutationFn: async () => {
      const blob = await xuatExcelTienDoDot(dotId as string, loc);
      taiFileTuBlob(blob, 'tien-do-truong-chua-xong.xlsx');
    },
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  function datThamSo(khoa: 'dot' | 'loc', giaTri: string) {
    const moi = new URLSearchParams(params);
    moi.set(khoa, giaTri);
    if (khoa === 'dot') moi.delete('loc');
    setParams(moi, { replace: true });
  }

  const data = tienDo.data;
  const dong = (data?.dong ?? []).filter((d) => khopTimKiem(`${d.don_vi.ma ?? ''} ${d.don_vi.ten}`, tuKhoa));
  const soLoc = data ? soTheoLoc(data.tong_hop) : null;

  return (
    <Container size="xl" py="lg" px="md">
      <Stack gap="md">
        <Title order={1} size="h3">
          Tiến độ đợt
        </Title>
        {dsDot.isLoading && <Skeleton height={56} radius="md" />}
        {dsDot.isError && <Alert color="red">{thongDiepLoiChung(dsDot.error)}</Alert>}
        {dsDot.data && dsDot.data.length === 0 && <Text c="dimmed">Chưa có đợt triển khai nào.</Text>}
        {dsDot.data && dsDot.data.length > 0 && (
          <Select
            label="Đợt triển khai"
            data={dsDot.data.map((d) => ({ value: d.id, label: `${d.chuong_trinh.toUpperCase()} – ${d.ten}` }))}
            value={dotId}
            onChange={(v) => v && datThamSo('dot', v)}
            allowDeselect={false}
            searchable
            maw={520}
          />
        )}

        {dotId && (
          <>
            <Chip.Group multiple={false} value={loc} onChange={(v) => datThamSo('loc', v)}>
              <Group gap="xs" role="radiogroup" aria-label="Lọc theo trạng thái">
                {LOC_TIEN_DO.map((l) => (
                  <Chip key={l} value={l} size="sm">
                    {NHAN_LOC[l]}
                    {soLoc ? ` (${soLoc[l]})` : ''}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
            <Group gap="sm" align="flex-end" justify="space-between">
              <TextInput
                label="Tìm trường"
                placeholder="Tên hoặc mã trường"
                value={tuKhoa}
                onChange={(e) => setTuKhoa(e.currentTarget.value)}
                w={{ base: '100%', sm: 320 }}
              />
              <Button variant="default" loading={xuat.isPending} onClick={() => xuat.mutate()}>
                Xuất Excel trường chưa xong
              </Button>
            </Group>
          </>
        )}

        {tienDo.isLoading && <Skeleton height={200} radius="md" aria-label="Đang tải tiến độ" />}
        {tienDo.isError && (
          <Alert color="red" title="Không tải được tiến độ đợt">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(tienDo.error)}</Text>
              <Button
                size="sm"
                variant="light"
                color="red"
                onClick={() => tienDo.refetch()}
                loading={tienDo.isFetching}
              >
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}
        {data && dotId && (
          <>
            <TheTongHop t={data.tong_hop} />
            {dong.length === 0 ? (
              <Text c="dimmed">
                {data.dong.length === 0 ? 'Không có trường nào ở trạng thái này' : 'Không có trường nào khớp tìm kiếm'}
              </Text>
            ) : nhoMan ? (
              <Stack gap="sm" aria-label="Tiến độ theo trường">
                {dong.map((d) => (
                  <TheTruong key={d.don_vi.id} d={d} dotId={dotId} onGiaHan={setGiaHan} />
                ))}
              </Stack>
            ) : (
              <BangTienDo dong={dong} dotId={dotId} onGiaHan={setGiaHan} />
            )}
            {giaHan && (
              <Suspense fallback={null}>
                <ModalGiaHanRieng dotId={dotId} dong={giaHan} onClose={() => setGiaHan(null)} />
              </Suspense>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}

function TheTongHop({ t }: { t: TongHopTienDo }) {
  const o = (nhan: string, giaTri: string) => (
    <Paper withBorder radius="md" p="sm" key={nhan}>
      <Text size="xs" c="dimmed">
        {nhan}
      </Text>
      <Text fw={700} fz="lg" style={{ overflowWrap: 'anywhere' }}>
        {giaTri}
      </Text>
    </Paper>
  );
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm" aria-label="Tổng hợp đợt">
      {o('Số trường', String(t.so_truong))}
      {o('Đã xác nhận DS', `${t.so_da_xac_nhan_ds}/${t.so_truong}`)}
      {o('Đã nộp HĐ', `${t.so_da_nop}/${t.so_truong}`)}
      {o('Tổng suất', dinhDangSuat(t.tong_suat))}
      {o('Tổng giá trị', dinhDangGiaTri(t.tong_gia_tri))}
    </SimpleGrid>
  );
}

function BadgeDanhSach({ d }: { d: DongTienDo }) {
  const tt = TRANG_THAI_DANH_SACH[d.trang_thai_danh_sach];
  return (
    <Group gap={4}>
      <Badge color={tt.mau} variant="light">
        {tt.nhan}
      </Badge>
      {d.so_de_nghi_cho > 0 && (
        <Text size="xs" c="orange.8">
          {d.so_de_nghi_cho} đề nghị chờ
        </Text>
      )}
    </Group>
  );
}

function BadgeHopDong({ d }: { d: DongTienDo }) {
  const tt = TRANG_THAI_HOP_DONG[d.trang_thai_hop_dong];
  return (
    <Group gap={4}>
      <Badge color={tt.mau} variant="light">
        {tt.nhan}
      </Badge>
      {d.nop_luc && <Text size="xs">{dinhDangNgay(d.nop_luc)}</Text>}
    </Group>
  );
}

function nhanHoSo(d: DongTienDo): { nhan: string; mau: string } {
  if (!d.co_ho_so) return { nhan: 'Chưa khai', mau: 'gray' };
  return d.ho_so_du ? { nhan: 'Đủ', mau: 'green' } : { nhan: 'Thiếu', mau: 'yellow' };
}

function BadgeHoSo({ d }: { d: DongTienDo }) {
  const hs = nhanHoSo(d);
  return (
    <Badge color={hs.mau} variant="light">
      {hs.nhan}
    </Badge>
  );
}

/** Issue #66: hạn hiệu lực dd/mm/yyyy + "Hạn riêng" khi có + đỏ "Quá hạn" (hết hạn, chưa nộp). */
function HanTruong({ d }: { d: DongTienDo }) {
  return (
    <Group gap={4}>
      <Text size="sm">{dinhDangNgayLich(d.han_hieu_luc_ngay)}</Text>
      {d.han_rieng && (
        <Badge color="blue" variant="light" tt="none">
          Hạn riêng
        </Badge>
      )}
      {d.qua_han && (
        <Badge color="red" variant="filled" tt="none">
          Quá hạn
        </Badge>
      )}
    </Group>
  );
}

const thaoTacCuoi = (d: DongTienDo) => (d.thao_tac_cuoi_luc ? dinhDangNgayGio(d.thao_tac_cuoi_luc) : '—');

type GiaHan = (d: DongTienDo) => void;

function LienKetDong({ d, dotId, onGiaHan }: { d: DongTienDo; dotId: string; onGiaHan: GiaHan }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        component={Link}
        to={lienKetDanhSach(dotId, d.don_vi.id)}
        size="xs"
        variant="subtle"
        aria-label={`Danh sách ${d.don_vi.ten}`}
      >
        Danh sách
      </Button>
      <Button
        component={Link}
        to={lienKetHopDong(dotId, d.don_vi.id)}
        size="xs"
        variant="subtle"
        aria-label={`Hợp đồng ${d.don_vi.ten}`}
      >
        Hợp đồng
      </Button>
      <Button size="xs" variant="subtle" aria-label={`Gia hạn riêng ${d.don_vi.ten}`} onClick={() => onGiaHan(d)}>
        Gia hạn riêng
      </Button>
    </Group>
  );
}

function TenTruong({ d }: { d: DongTienDo }) {
  return (
    <div>
      <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
        {d.don_vi.ten}
      </Text>
      <Text size="xs" c="dimmed">
        {[d.don_vi.ma, d.don_vi.dia_ban].filter(Boolean).join(' · ')}
      </Text>
    </div>
  );
}

function BangTienDo({ dong, dotId, onGiaHan }: { dong: DongTienDo[]; dotId: string; onGiaHan: GiaHan }) {
  return (
    <Table.ScrollContainer minWidth={1280}>
      <Table striped withTableBorder fz="sm" aria-label="Tiến độ theo trường">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Trường</Table.Th>
            <Table.Th ta="right">Số người</Table.Th>
            <Table.Th ta="right">Tổng suất</Table.Th>
            <Table.Th ta="right">Giá trị</Table.Th>
            <Table.Th>Danh sách</Table.Th>
            <Table.Th>Hồ sơ</Table.Th>
            <Table.Th>Hợp đồng</Table.Th>
            <Table.Th>Hạn</Table.Th>
            <Table.Th>Thao tác gần nhất</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dong.map((d) => (
            <Table.Tr key={d.don_vi.id}>
              <Table.Td>
                <TenTruong d={d} />
              </Table.Td>
              <Table.Td ta="right">{d.so_nguoi}</Table.Td>
              <Table.Td ta="right">{dinhDangSuat(d.tong_suat)}</Table.Td>
              <Table.Td ta="right">{dinhDangGiaTri(d.gia_tri)}</Table.Td>
              <Table.Td>
                <BadgeDanhSach d={d} />
              </Table.Td>
              <Table.Td>
                <BadgeHoSo d={d} />
              </Table.Td>
              <Table.Td>
                <BadgeHopDong d={d} />
              </Table.Td>
              <Table.Td>
                <HanTruong d={d} />
              </Table.Td>
              <Table.Td>{thaoTacCuoi(d)}</Table.Td>
              <Table.Td>
                <LienKetDong d={d} dotId={dotId} onGiaHan={onGiaHan} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Màn hẹp: mỗi trường 1 thẻ xếp dọc — không cuộn ngang trang ở 360px. */
function TheTruong({ d, dotId, onGiaHan }: { d: DongTienDo; dotId: string; onGiaHan: GiaHan }) {
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
            Hồ sơ
          </Text>
          <BadgeHoSo d={d} />
          <Text size="xs" c="dimmed">
            Hợp đồng
          </Text>
          <BadgeHopDong d={d} />
        </Group>
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Hạn
          </Text>
          <HanTruong d={d} />
        </Group>
        <Text size="xs" c="dimmed">
          Thao tác gần nhất: {thaoTacCuoi(d)}
        </Text>
        <LienKetDong d={d} dotId={dotId} onGiaHan={onGiaHan} />
      </Stack>
    </Paper>
  );
}
