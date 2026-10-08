import { useMemo, useState } from 'react';
import { Anchor, Button, Group, Paper, Progress, SimpleGrid, Table, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useChatLuongHoSo, xuatChatLuongHoSo, type LocThongKe } from '@/api/thongKe';
import type { ChatLuongHoSoDong, DemChatLuongHoSo } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { useLocTuUrl } from '../BoLocThongKe';
import { KhoiThongKe } from '../KhoiThongKe';
import { boDau, doiChieuSapXep, mauTheoNguong, sapXepTheoCot, TieuDeSapXep, type Chieu } from '../bangTheoTruong';
import { dinhDangTyLe } from '../mauMuc';

type KhoaSapXep = 'ten_don_vi' | 'so_hv' | 'thieu_doi_tuong' | 'thieu_cap' | 'thieu_email' | 'thieu_sdt' | 'ty_le_du';

const COT_THIEU = [
  { key: 'thieu_doi_tuong', nhan: 'Thiếu đối tượng', id: 'the-thieu-doi-tuong' },
  { key: 'thieu_cap', nhan: 'Thiếu cấp giảng dạy', id: 'the-thieu-cap' },
  { key: 'thieu_email', nhan: 'Thiếu email', id: 'the-thieu-email' },
  { key: 'thieu_sdt', nhan: 'Thiếu SĐT', id: 'the-thieu-sdt' },
] as const;

const tyLeTrenTong = (so: number, tong: number) => dinhDangTyLe(tong === 0 ? null : so / tong);

function The({ id, nhan, giaTri }: { id: string; nhan: string; giaTri: string }) {
  return (
    <Paper withBorder p="sm" radius="md" data-testid={id}>
      <Text size="xs" c="dimmed">
        {nhan}
      </Text>
      <Text fw={700}>{giaTri}</Text>
    </Paper>
  );
}

function TheTong({ tong }: { tong: DemChatLuongHoSo }) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm" mb="md">
      <The
        id="the-du-ho-so"
        nhan="Đủ hồ sơ"
        giaTri={`${tong.du_ho_so} / ${tong.so_hv} · ${dinhDangTyLe(tong.ty_le_du)}`}
      />
      {COT_THIEU.map((c) => (
        <The
          key={c.key}
          id={c.id}
          nhan={c.nhan}
          giaTri={`${tong[c.key]} · ${tyLeTrenTong(tong[c.key], tong.so_hv)}`}
        />
      ))}
    </SimpleGrid>
  );
}

function ODuHoSo({ r }: { r: ChatLuongHoSoDong }) {
  const mau = mauTheoNguong(r.ty_le_du);
  if (mau === null) return <Text size="sm">—</Text>;
  return (
    <Group gap="xs" wrap="nowrap">
      <Progress value={(r.ty_le_du ?? 0) * 100} color={mau} size="sm" w={56} aria-hidden />
      <Text size="sm">{`${r.du_ho_so}/${r.so_hv} · ${dinhDangTyLe(r.ty_le_du)}`}</Text>
    </Group>
  );
}

export function KhoiChatLuongHoSo({ loc }: { loc: LocThongKe }) {
  const [, setLoc] = useLocTuUrl();
  const query = useChatLuongHoSo(loc);
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<{ cot: KhoaSapXep; chieu: Chieu }>({ cot: 'ty_le_du', chieu: 'asc' });
  const [dangXuat, setDangXuat] = useState(false);
  const d = query.data;

  const hien = useMemo(() => {
    if (!d) return [];
    const t = boDau(tim.trim());
    const loc2 = t ? d.theo_truong.filter((r) => boDau(r.ten_don_vi).includes(t)) : d.theo_truong;
    return sapXepTheoCot(loc2, sap.cot, sap.chieu);
  }, [d, tim, sap]);

  async function xuatExcel() {
    setDangXuat(true);
    try {
      await xuatChatLuongHoSo(loc);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  const tieuDe = {
    dangSap: sap.cot,
    chieu: sap.chieu,
    onSap: (cot: KhoaSapXep) => setSap((cu) => doiChieuSapXep(cu, cot)),
  };

  return (
    <KhoiThongKe
      tieu_de="Chất lượng hồ sơ"
      query={query}
      rong={d?.theo_truong.length === 0}
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
        <>
          <TheTong tong={d.tong} />
          <Table.ScrollContainer minWidth={720} maxHeight={520}>
            <Table striped stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <TieuDeSapXep nhan="Trường" cot="ten_don_vi" {...tieuDe} />
                  <TieuDeSapXep nhan="Số HV" cot="so_hv" canPhai {...tieuDe} />
                  {COT_THIEU.map((c) => (
                    <TieuDeSapXep key={c.key} nhan={c.nhan} cot={c.key} canPhai {...tieuDe} />
                  ))}
                  <TieuDeSapXep nhan="Đủ hồ sơ" cot="ty_le_du" {...tieuDe} />
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
                    {COT_THIEU.map((c) => (
                      <Table.Td key={c.key} ta="right">
                        {r[c.key]}
                      </Table.Td>
                    ))}
                    <Table.Td>
                      <ODuHoSo r={r} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </>
      )}
    </KhoiThongKe>
  );
}
