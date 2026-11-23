import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Chip,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useDotSoPhong, useTienDoSoPhong, type DongTienDoSoPhong, type TheDotSoPhong } from '@/api/donViTienDo';
import { LOC_TIEN_DO, type LocTienDo } from '@/api/tienDoDot';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { khopTimKiem } from '@/lib/timKiemTiengViet';
import { dinhDangSuat } from './danhSachThamGiaNhan';
import { NHAN_CHUONG_TRINH_NGAN, TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG, dinhDangGiaTri } from './hopDongNhan';
import { dotDangChon } from './dotMacDinh';
import { NHAN_LOC, laLoc, soTheoLoc } from './tienDoNhan';

const lienKetDanhSachGv = (dotId: string, donViId: string) => `/don-vi/dot/${dotId}/truong/${donViId}`;

function KhoiLoi({
  tieuDe,
  loi,
  thuLai,
  dangTai,
}: {
  tieuDe: string;
  loi: unknown;
  thuLai: () => void;
  dangTai: boolean;
}) {
  return (
    <Alert color="red" title={tieuDe}>
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{thongDiepLoiChung(loi)}</Text>
        <Button size="sm" variant="light" color="red" onClick={thuLai} loading={dangTai}>
          Thử lại
        </Button>
      </Stack>
    </Alert>
  );
}

/** Trang chủ Sở/Phòng trên Cổng đơn vị (issue #71 / ADR 0015 P1, O3): thẻ các đợt có trường trong phạm vi, chọn
 * 1 đợt → bảng tiến độ các trường. Chỉ trạng thái, số GV, suất, giá trị — không thông tin tài khoản, người nhận,
 * liên hệ (API cũng không trả). */
export default function TrangChuSoPhong() {
  const [params, setParams] = useSearchParams();
  const dsDot = useDotSoPhong();
  const dotId = dotDangChon(
    dsDot.data?.map((t) => t.dot),
    params.get('dot'),
  );

  function chonDot(id: string) {
    const moi = new URLSearchParams(params);
    moi.set('dot', id);
    moi.delete('loc');
    setParams(moi, { replace: true });
  }

  return (
    <Container size="xl" py="lg" px="md">
      <Stack gap="md">
        <Title order={1} size="h3">
          Tiến độ các trường
        </Title>

        {dsDot.isLoading && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} aria-label="Đang tải đợt">
            <Skeleton height={140} radius="md" />
            <Skeleton height={140} radius="md" />
          </SimpleGrid>
        )}
        {dsDot.isError && (
          <KhoiLoi
            tieuDe="Không tải được danh sách đợt"
            loi={dsDot.error}
            thuLai={() => dsDot.refetch()}
            dangTai={dsDot.isFetching}
          />
        )}
        {dsDot.data && dsDot.data.length === 0 && (
          <Paper withBorder radius="md" p="md">
            <Text c="dimmed">Chưa có đợt bồi dưỡng nào cho các trường trong phạm vi</Text>
          </Paper>
        )}
        {dsDot.data && dsDot.data.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm" aria-label="Các đợt bồi dưỡng">
            {dsDot.data.map((t) => (
              <TheDot key={t.dot.id} the={t} dangChon={t.dot.id === dotId} onChon={() => chonDot(t.dot.id)} />
            ))}
          </SimpleGrid>
        )}

        {dotId && <BangTienDoDot key={dotId} dotId={dotId} />}
      </Stack>
    </Container>
  );
}

function TheDot({ the, dangChon, onChon }: { the: TheDotSoPhong; dangChon: boolean; onChon: () => void }) {
  const { dot } = the;
  return (
    <Paper
      component="button"
      type="button"
      onClick={onChon}
      aria-pressed={dangChon}
      withBorder
      radius="md"
      p="md"
      ta="left"
      style={{
        cursor: 'pointer',
        width: '100%',
        borderColor: dangChon ? 'var(--mantine-color-primary-6)' : undefined,
        borderWidth: dangChon ? 2 : undefined,
      }}
    >
      <Stack gap={6}>
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Badge variant="filled">{NHAN_CHUONG_TRINH_NGAN[dot.chuong_trinh]}</Badge>
          <Text size="xs" c="dimmed">
            Hạn nộp: {dinhDangNgayLich(dot.han_nop_ngay)}
          </Text>
        </Group>
        <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
          {dot.ten}
        </Text>
        <Text size="sm">
          {the.so_truong} trường · {the.so_da_xac_nhan_ds} đã xác nhận DS · {the.so_da_nop} đã nộp HĐ · {the.so_qua_han}{' '}
          quá hạn
        </Text>
        <Text size="sm" c="dimmed">
          Tổng suất {dinhDangSuat(the.tong_suat)} · {dinhDangGiaTri(the.tong_gia_tri)}
        </Text>
      </Stack>
    </Paper>
  );
}

function BangTienDoDot({ dotId }: { dotId: string }) {
  const [params, setParams] = useSearchParams();
  const locParam = params.get('loc');
  const loc: LocTienDo = laLoc(locParam) ? locParam : 'tat_ca';
  const [tuKhoa, setTuKhoa] = useState('');
  const tienDo = useTienDoSoPhong(dotId, loc);
  const nhoMan = useMediaQuery('(max-width: 48em)');

  function chonLoc(giaTri: string) {
    const moi = new URLSearchParams(params);
    moi.set('dot', dotId);
    moi.set('loc', giaTri);
    setParams(moi, { replace: true });
  }

  const data = tienDo.data;
  const dong = (data?.dong ?? []).filter((d) => khopTimKiem(`${d.don_vi.ma ?? ''} ${d.don_vi.ten}`, tuKhoa));
  const soLoc = data ? soTheoLoc(data.tong_hop) : null;

  return (
    <Stack gap="md" component="section" aria-label="Tiến độ đợt đang chọn">
      {data && (
        <Title order={2} size="h4" style={{ overflowWrap: 'anywhere' }}>
          {data.dot.ten}
        </Title>
      )}
      <Chip.Group multiple={false} value={loc} onChange={chonLoc}>
        <Group gap="xs" role="radiogroup" aria-label="Lọc theo trạng thái">
          {LOC_TIEN_DO.map((l) => (
            <Chip key={l} value={l} size="sm">
              {NHAN_LOC[l]}
              {soLoc ? ` (${soLoc[l]})` : ''}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      <TextInput
        label="Tìm trường"
        placeholder="Tên hoặc mã trường"
        value={tuKhoa}
        onChange={(e) => setTuKhoa(e.currentTarget.value)}
        w={{ base: '100%', sm: 320 }}
      />

      {tienDo.isLoading && <Skeleton height={200} radius="md" aria-label="Đang tải tiến độ" />}
      {tienDo.isError && (
        <KhoiLoi
          tieuDe="Không tải được tiến độ đợt"
          loi={tienDo.error}
          thuLai={() => tienDo.refetch()}
          dangTai={tienDo.isFetching}
        />
      )}
      {data &&
        (dong.length === 0 ? (
          <Text c="dimmed">
            {data.dong.length === 0 ? 'Không có trường nào ở trạng thái này' : 'Không có trường nào khớp tìm kiếm'}
          </Text>
        ) : nhoMan ? (
          <Stack gap="sm" aria-label="Tiến độ theo trường">
            {dong.map((d) => (
              <TheTruong key={d.don_vi.id} d={d} dotId={dotId} />
            ))}
          </Stack>
        ) : (
          <BangTienDo dong={dong} dotId={dotId} />
        ))}
    </Stack>
  );
}

function BadgeDanhSach({ d }: { d: DongTienDoSoPhong }) {
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

function BadgeHopDong({ d }: { d: DongTienDoSoPhong }) {
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

function HanTruong({ d }: { d: DongTienDoSoPhong }) {
  return (
    <Group gap={4}>
      <Text size="sm">{dinhDangNgayLich(d.han_hieu_luc_ngay)}</Text>
      {d.qua_han && (
        <Badge color="red" variant="filled" tt="none">
          Quá hạn
        </Badge>
      )}
    </Group>
  );
}

const thaoTacCuoi = (d: DongTienDoSoPhong) => (d.thao_tac_cuoi_luc ? dinhDangNgayGio(d.thao_tac_cuoi_luc) : '—');

function TenTruong({ d }: { d: DongTienDoSoPhong }) {
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

function XemDanhSach({ d, dotId }: { d: DongTienDoSoPhong; dotId: string }) {
  return (
    <Button
      component={Link}
      to={lienKetDanhSachGv(dotId, d.don_vi.id)}
      size="xs"
      variant="subtle"
      aria-label={`Xem danh sách GV ${d.don_vi.ten}`}
    >
      Xem danh sách GV
    </Button>
  );
}

function BangTienDo({ dong, dotId }: { dong: DongTienDoSoPhong[]; dotId: string }) {
  return (
    <Table.ScrollContainer minWidth={1100}>
      <Table striped withTableBorder fz="sm" aria-label="Tiến độ theo trường">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Trường</Table.Th>
            <Table.Th ta="right">Số GV</Table.Th>
            <Table.Th ta="right">Tổng suất</Table.Th>
            <Table.Th ta="right">Giá trị</Table.Th>
            <Table.Th>Danh sách</Table.Th>
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
                <BadgeHopDong d={d} />
              </Table.Td>
              <Table.Td>
                <HanTruong d={d} />
              </Table.Td>
              <Table.Td>{thaoTacCuoi(d)}</Table.Td>
              <Table.Td>
                <XemDanhSach d={d} dotId={dotId} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

/** Màn hẹp: mỗi trường 1 thẻ xếp dọc — không cuộn ngang trang ở 360px. */
function TheTruong({ d, dotId }: { d: DongTienDoSoPhong; dotId: string }) {
  return (
    <Paper withBorder radius="md" p="sm" component="article" aria-label={d.don_vi.ten}>
      <Stack gap={6}>
        <TenTruong d={d} />
        <Text size="sm">
          {d.so_nguoi} GV · {dinhDangSuat(d.tong_suat)} suất · {dinhDangGiaTri(d.gia_tri)}
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
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Hạn
          </Text>
          <HanTruong d={d} />
        </Group>
        <Text size="xs" c="dimmed">
          Thao tác gần nhất: {thaoTacCuoi(d)}
        </Text>
        <div>
          <XemDanhSach d={d} dotId={dotId} />
        </div>
      </Stack>
    </Paper>
  );
}
