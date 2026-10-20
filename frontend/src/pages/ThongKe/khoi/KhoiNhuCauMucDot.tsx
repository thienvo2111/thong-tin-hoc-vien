import { useState } from 'react';
import { Button, Group, Paper, Select, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDotNhuCauMuc } from '@/api/nhuCauMuc';
import { useNhuCauMucDot, xuatNhuCauMucDot, type LocThongKe } from '@/api/thongKe';
import type { MucNangLuc, NhuCauMucDotResult } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { NHAN_MUC_NANG_LUC, THU_TU_MUC } from '@/lib/mucNangLuc';
import { KhoiThongKe } from '../KhoiThongKe';
import { CHON_TRUONG_MAC_DINH, ChonTruongXuat, donViIdsXuat, thieuTruong } from '../ChonTruongXuat';

const TIEU_DE = 'Nhu cầu mức học theo đợt';

const dinhDangPhanTram = (x: number) => `${x.toFixed(1).replace('.', ',')}%`;

function Kpi({ testid, nhan, gia_tri }: { testid: string; nhan: string; gia_tri: string }) {
  return (
    <Paper withBorder p="sm" radius="md" data-testid={testid}>
      <Text size="xs" c="dimmed">
        {nhan}
      </Text>
      <Text fw={700} size="xl">
        {gia_tri}
      </Text>
    </Paper>
  );
}

/** Lựa chọn chỉ được ≤ mốc (ADR 0013): ô chọn > mốc không hợp lệ -> "—". */
function MaTran({ d }: { d: NhuCauMucDotResult }) {
  const soLuong = (moc: MucNangLuc, chon: MucNangLuc) =>
    d.ma_tran.find((o) => o.muc_moc === moc && o.muc_chon === chon)?.so_luong;
  return (
    <Table.ScrollContainer minWidth={320}>
      <Table striped withTableBorder>
        <Table.Caption>Mốc của học viên (hàng) và mức đã chọn (cột)</Table.Caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Mốc \ Đã chọn</Table.Th>
            {THU_TU_MUC.map((m) => (
              <Table.Th key={m} scope="col" ta="right">
                {NHAN_MUC_NANG_LUC[m]}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {THU_TU_MUC.map((moc, i) => (
            <Table.Tr key={moc}>
              <Table.Th scope="row">{NHAN_MUC_NANG_LUC[moc]}</Table.Th>
              {THU_TU_MUC.map((chon, j) => (
                <Table.Td key={chon} ta="right">
                  {j > i ? (soLuong(moc, chon) ?? '—') : (soLuong(moc, chon) ?? 0)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function TheoTruong({ d }: { d: NhuCauMucDotResult }) {
  return (
    <Table.ScrollContainer minWidth={480}>
      <Table striped withTableBorder>
        <Table.Caption>Nhu cầu theo trường</Table.Caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">Trường</Table.Th>
            <Table.Th scope="col" ta="right">
              Đủ điều kiện
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Đã chọn
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Chưa chọn
            </Table.Th>
            <Table.Th scope="col" ta="right">
              Chọn hạ mức
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {d.theo_truong.map((r) => (
            <Table.Tr key={r.don_vi_id}>
              <Table.Td>{r.ten}</Table.Td>
              <Table.Td ta="right">{r.tong}</Table.Td>
              <Table.Td ta="right">{r.da_chon}</Table.Td>
              <Table.Td ta="right">{r.chua_chon}</Table.Td>
              <Table.Td ta="right">{r.ha_muc}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function ThongKeDot({ loc, khoaId }: { loc: LocThongKe; khoaId: string }) {
  const dsDot = useDotNhuCauMuc(khoaId);
  const [dotChon, setDotChon] = useState<string | null>(null);
  const [truong, setTruong] = useState(CHON_TRUONG_MAC_DINH);
  const [dangXuat, setDangXuat] = useState(false);

  const dots = dsDot.data ?? [];
  // API sắp mo_luc giảm dần -> phần tử đầu là đợt mới nhất.
  const dotId = dots.some((x) => x.id === dotChon) ? dotChon : (dots[0]?.id ?? null);
  const query = useNhuCauMucDot(loc, dotId);
  const d = query.data;
  const chuaChonTruong = thieuTruong(truong);

  async function xuat() {
    if (!dotId) return;
    setDangXuat(true);
    try {
      await xuatNhuCauMucDot(loc, dotId, donViIdsXuat(truong));
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  if (dsDot.isLoading) {
    return (
      <Paper withBorder p="md" radius="md" component="section" aria-label={TIEU_DE}>
        <Text c="dimmed" size="sm">
          Đang tải…
        </Text>
      </Paper>
    );
  }
  if (dsDot.isError) {
    return (
      <Paper withBorder p="md" radius="md" component="section" aria-label={TIEU_DE}>
        <Text c="red" size="sm">
          {thongDiepLoiChung(dsDot.error)}
        </Text>
      </Paper>
    );
  }
  if (dots.length === 0) {
    return (
      <Paper withBorder p="md" radius="md" component="section" aria-label={TIEU_DE}>
        <Stack gap="xs">
          <Title order={3} size="h4">
            {TIEU_DE}
          </Title>
          <Text c="dimmed" size="sm">
            Khóa này chưa có đợt nhu cầu
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <KhoiThongKe
      tieu_de={TIEU_DE}
      query={query}
      rong={false}
      dieu_khien={
        <Stack gap="sm">
          <Select
            label="Đợt"
            data={dots.map((x) => ({ value: x.id, label: x.ten_dot }))}
            value={dotId}
            onChange={setDotChon}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <ChonTruongXuat value={truong} onChange={setTruong} />
          <Group>
            <Button size="xs" variant="light" loading={dangXuat} disabled={chuaChonTruong} onClick={() => void xuat()}>
              Xuất Excel
            </Button>
            {chuaChonTruong && (
              <Text size="sm" c="dimmed">
                Chọn ít nhất một trường
              </Text>
            )}
          </Group>
        </Stack>
      }
    >
      {d && (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Kpi testid="kpi-du-dieu-kien" nhan="Đủ điều kiện" gia_tri={String(d.tong_du_dieu_kien)} />
            <Kpi testid="kpi-da-chon" nhan="Đã chọn" gia_tri={String(d.da_chon)} />
            <Kpi testid="kpi-chua-chon" nhan="Chưa chọn" gia_tri={String(d.chua_chon)} />
            <Kpi testid="kpi-ty-le" nhan="Tỷ lệ đã chọn" gia_tri={dinhDangPhanTram(d.ty_le_da_chon)} />
          </SimpleGrid>
          <MaTran d={d} />
          <TheoTruong d={d} />
        </Stack>
      )}
    </KhoiThongKe>
  );
}

export function KhoiNhuCauMucDot({ loc }: { loc: LocThongKe }) {
  if (!loc.khoa_id) {
    return (
      <Paper withBorder p="md" radius="md" component="section" aria-label={TIEU_DE}>
        <Stack gap="xs">
          <Title order={3} size="h4">
            {TIEU_DE}
          </Title>
          <Text c="dimmed" size="sm">
            Chọn khóa để xem nhu cầu theo đợt
          </Text>
        </Stack>
      </Paper>
    );
  }
  return <ThongKeDot loc={loc} khoaId={loc.khoa_id} />;
}
