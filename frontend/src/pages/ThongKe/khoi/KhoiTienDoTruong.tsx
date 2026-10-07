import { useMemo, useState } from 'react';
import { Anchor, Button, Group, Progress, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTienDoTruong, xuatTienDoTruong, type LocThongKe } from '@/api/thongKe';
import type { TienDoTruongDong } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { useLocTuUrl } from '../BoLocThongKe';
import { KhoiThongKe } from '../KhoiThongKe';
import { dinhDangTyLe } from '../mauMuc';

type KhoaSapXep = 'ten_don_vi' | 'so_hv' | TyLeKey;
type TyLeKey =
  | 'ty_le_truy_cap'
  | 'ty_le_ky_nang_so'
  | 'ty_le_dau_vao'
  | 'ty_le_dau_ra'
  | 'ty_le_co_mat'
  | 'ty_le_vle_dat'
  | 'ty_le_dat';
type Chieu = 'asc' | 'desc';

const COT_TY_LE: { key: TyLeKey; nhan: string }[] = [
  { key: 'ty_le_truy_cap', nhan: '% Truy cập' },
  { key: 'ty_le_ky_nang_so', nhan: '% KS kĩ năng số' },
  { key: 'ty_le_dau_vao', nhan: '% Đánh giá NLS đầu vào' },
  { key: 'ty_le_dau_ra', nhan: '% Đánh giá NLS đầu ra' },
  { key: 'ty_le_co_mat', nhan: '% Có mặt' },
  { key: 'ty_le_vle_dat', nhan: '% VLE ≥ 50%' },
  { key: 'ty_le_dat', nhan: '% Đạt' },
];

/** Màu thanh tiến độ theo ngưỡng; null (không có mẫu số) → không thanh. */
export function mauTheoNguong(x: number | null): string | null {
  if (x === null) return null;
  if (x < 0.5) return 'red.6';
  if (x < 0.8) return 'yellow.6';
  return 'teal.6';
}

const boDau = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase();

function sapXep(ds: TienDoTruongDong[], cot: KhoaSapXep, chieu: Chieu): TienDoTruongDong[] {
  const dau = chieu === 'asc' ? 1 : -1;
  return [...ds].sort((a, b) => {
    const x = a[cot];
    const y = b[cot];
    if (x === null && y === null) return 0;
    if (x === null) return 1; // null luôn cuối, bất kể chiều
    if (y === null) return -1;
    if (typeof x === 'string' && typeof y === 'string') return dau * x.localeCompare(y, 'vi');
    return dau * ((x as number) - (y as number));
  });
}

function OTyLe({ x }: { x: number | null }) {
  const mau = mauTheoNguong(x);
  if (mau === null) return <Text size="sm">—</Text>;
  return (
    <Group gap="xs" wrap="nowrap">
      <Progress value={(x ?? 0) * 100} color={mau} size="sm" w={56} aria-hidden />
      <Text size="sm">{dinhDangTyLe(x)}</Text>
    </Group>
  );
}

interface TieuDeProps {
  nhan: string;
  cot: KhoaSapXep;
  dangSap: KhoaSapXep;
  chieu: Chieu;
  onSap: (cot: KhoaSapXep) => void;
  canPhai?: boolean;
}

function TieuDeSapXep({ nhan, cot, dangSap, chieu, onSap, canPhai }: TieuDeProps) {
  const dang = dangSap === cot;
  const ariaSort = dang ? (chieu === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <Table.Th aria-sort={ariaSort} ta={canPhai ? 'right' : undefined}>
      <UnstyledButton onClick={() => onSap(cot)} fw={700} fz="sm">
        {nhan}
        {dang && <span aria-hidden> {chieu === 'asc' ? '↑' : '↓'}</span>}
      </UnstyledButton>
    </Table.Th>
  );
}

export function KhoiTienDoTruong({ loc }: { loc: LocThongKe }) {
  const [, setLoc] = useLocTuUrl();
  const query = useTienDoTruong(loc);
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<{ cot: KhoaSapXep; chieu: Chieu }>({ cot: 'ty_le_truy_cap', chieu: 'asc' });
  const [dangXuat, setDangXuat] = useState(false);
  const d = query.data;

  const hien = useMemo(() => {
    if (!d) return [];
    const t = boDau(tim.trim());
    const loc2 = t ? d.filter((r) => boDau(r.ten_don_vi).includes(t)) : d;
    return sapXep(loc2, sap.cot, sap.chieu);
  }, [d, tim, sap]);

  function doiSapXep(cot: KhoaSapXep) {
    setSap((cu) => (cu.cot === cot ? { cot, chieu: cu.chieu === 'asc' ? 'desc' : 'asc' } : { cot, chieu: 'asc' }));
  }

  async function xuatExcel() {
    setDangXuat(true);
    try {
      await xuatTienDoTruong(loc);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  const tieuDe = { dangSap: sap.cot, chieu: sap.chieu, onSap: doiSapXep };

  return (
    <KhoiThongKe
      tieu_de="Tiến độ theo trường"
      query={query}
      rong={d?.length === 0}
      thong_bao_rong="Chưa có học viên trong phạm vi lọc"
      dieu_khien={
        <Group justify="space-between" align="flex-end">
          <Group align="flex-end" gap="md">
            <TextInput label="Tìm trường" value={tim} onChange={(e) => setTim(e.currentTarget.value)} />
            {d && (
              <Text size="sm" c="dimmed" pb={8}>
                {hien.length} trường
              </Text>
            )}
          </Group>
          <Button size="xs" variant="light" loading={dangXuat} onClick={() => void xuatExcel()}>
            Xuất Excel
          </Button>
        </Group>
      }
    >
      {d && (
        <Table.ScrollContainer minWidth={960} maxHeight={520}>
          <Table striped stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <TieuDeSapXep nhan="Trường" cot="ten_don_vi" {...tieuDe} />
                <TieuDeSapXep nhan="Số HV" cot="so_hv" canPhai {...tieuDe} />
                {COT_TY_LE.map((c) => (
                  <TieuDeSapXep key={c.key} nhan={c.nhan} cot={c.key} {...tieuDe} />
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {hien.map((r) => (
                <Table.Tr key={r.don_vi_id}>
                  <Table.Td>
                    <Anchor
                      component="button"
                      type="button"
                      size="sm"
                      ta="left"
                      aria-label={`Xem riêng ${r.ten_don_vi}`}
                      onClick={() => setLoc({ khoa_id: loc.khoa_id, don_vi_id: r.don_vi_id })}
                    >
                      {r.ten_don_vi}
                    </Anchor>
                    {r.ten_don_vi_cha && (
                      <Text size="xs" c="dimmed">
                        {r.ten_don_vi_cha}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{r.so_hv}</Table.Td>
                  {COT_TY_LE.map((c) => (
                    <Table.Td key={c.key}>
                      <OTyLe x={r[c.key]} />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </KhoiThongKe>
  );
}
