import { useMemo, useState } from 'react';
import { Anchor, Button, Group, Progress, Table, Tabs, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams } from 'react-router-dom';
import { useTienDoTruong, xuatTienDoTruong, type LocThongKe } from '@/api/thongKe';
import type { TienDoTruongDong } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { useLocTuUrl } from '../BoLocThongKe';
import { KhoiThongKe } from '../KhoiThongKe';
import { boDau, doiChieuSapXep, mauTheoNguong, sapXepTheoCot, TieuDeSapXep, type Chieu } from '../bangTheoTruong';
import { dinhDangTyLe } from '../mauMuc';

export { mauTheoNguong };

type KhoaSapXep = 'ten_don_vi' | 'so_hv' | TyLeKey;
type TyLeKey =
  | 'ty_le_truy_cap'
  | 'ty_le_ky_nang_so'
  | 'ty_le_dau_vao'
  | 'ty_le_dau_ra'
  | 'ty_le_co_mat'
  | 'ty_le_vle_dat'
  | 'ty_le_dat';

interface CotTyLe {
  key: TyLeKey;
  nhan: string;
  tu: keyof TienDoTruongDong;
  mau: keyof TienDoTruongDong;
  hauTo: string;
}

const cotHv = (key: TyLeKey, nhan: string, tu: keyof TienDoTruongDong): CotTyLe => ({
  key,
  nhan,
  tu,
  mau: 'so_hv',
  hauTo: '',
});

const TABS = [
  {
    value: 'dau-vao',
    nhan: 'Đầu vào',
    cot: [
      cotHv('ty_le_truy_cap', 'Truy cập', 'so_truy_cap'),
      cotHv('ty_le_ky_nang_so', 'KS kĩ năng số', 'so_ky_nang_so'),
      cotHv('ty_le_dau_vao', 'Đánh giá NLS đầu vào', 'so_dau_vao'),
    ],
  },
  {
    value: 'hoc-tap',
    nhan: 'Học tập',
    cot: [
      { key: 'ty_le_co_mat', nhan: 'Có mặt', tu: 'so_luot_co_mat', mau: 'so_luot_diem_danh', hauTo: ' lượt' },
      { key: 'ty_le_vle_dat', nhan: 'VLE ≥ 50%', tu: 'so_hv_vle_dat', mau: 'so_hv_co_vle', hauTo: ' HV' },
    ],
  },
  {
    value: 'dau-ra',
    nhan: 'Đầu ra',
    cot: [
      cotHv('ty_le_dau_ra', 'Đánh giá NLS đầu ra', 'so_dau_ra'),
      { key: 'ty_le_dat', nhan: 'Đạt', tu: 'so_dat', mau: 'so_dang_ky', hauTo: ' lượt ĐK' },
    ],
  },
] as const;

type TabValue = (typeof TABS)[number]['value'];
const TAB_MAC_DINH: TabValue = 'dau-vao';
const THAM_SO_TAB = 'tdt_tab';

function tabHopLe(v: string | null): TabValue {
  return TABS.find((t) => t.value === v)?.value ?? TAB_MAC_DINH;
}

const sapXepMacDinh = (tab: (typeof TABS)[number]): { cot: KhoaSapXep; chieu: Chieu } => ({
  cot: tab.cot[0].key,
  chieu: 'asc',
});

function OTyLe({ r, c }: { r: TienDoTruongDong; c: CotTyLe }) {
  const x = r[c.key];
  const mau = mauTheoNguong(x);
  if (mau === null) return <Text size="sm">—</Text>;
  return (
    <Group gap="xs" wrap="nowrap">
      <Progress value={(x ?? 0) * 100} color={mau} size="sm" w={56} aria-hidden />
      <Text size="sm">{`${r[c.tu]}/${r[c.mau]}${c.hauTo} · ${dinhDangTyLe(x)}`}</Text>
    </Group>
  );
}

export function KhoiTienDoTruong({ loc }: { loc: LocThongKe }) {
  const [, setLoc] = useLocTuUrl();
  const query = useTienDoTruong(loc);
  const [params, setParams] = useSearchParams();
  const tabHienTai = TABS.find((t) => t.value === tabHopLe(params.get(THAM_SO_TAB)))!;
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<{ cot: KhoaSapXep; chieu: Chieu }>(() => sapXepMacDinh(tabHienTai));
  const [dangXuat, setDangXuat] = useState(false);
  const d = query.data;

  const hien = useMemo(() => {
    if (!d) return [];
    const t = boDau(tim.trim());
    const loc2 = t ? d.filter((r) => boDau(r.ten_don_vi).includes(t)) : d;
    return sapXepTheoCot(loc2, sap.cot, sap.chieu);
  }, [d, tim, sap]);

  function doiSapXep(cot: KhoaSapXep) {
    setSap((cu) => doiChieuSapXep(cu, cot));
  }

  function doiTab(v: string | null) {
    const tab = TABS.find((t) => t.value === v);
    if (!tab) return;
    setSap(sapXepMacDinh(tab));
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.set(THAM_SO_TAB, tab.value);
        return moi;
      },
      { replace: true },
    );
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
        <Tabs value={tabHienTai.value} onChange={doiTab} keepMounted={false}>
          <Tabs.List mb="sm">
            {TABS.map((t) => (
              <Tabs.Tab key={t.value} value={t.value}>
                {t.nhan}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {TABS.map((t) => (
            <Tabs.Panel key={t.value} value={t.value}>
              <Table.ScrollContainer minWidth={640} maxHeight={520}>
                <Table striped stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <TieuDeSapXep nhan="Trường" cot="ten_don_vi" {...tieuDe} />
                      <TieuDeSapXep nhan="Số HV" cot="so_hv" canPhai {...tieuDe} />
                      {t.cot.map((c) => (
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
                            onClick={() => setLoc({ khoa_id: loc.khoa_id, don_vi_id: r.don_vi_id, doi_tuong: loc.doi_tuong })}
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
                        {t.cot.map((c) => (
                          <Table.Td key={c.key}>
                            <OTyLe r={r} c={c} />
                          </Table.Td>
                        ))}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
    </KhoiThongKe>
  );
}
