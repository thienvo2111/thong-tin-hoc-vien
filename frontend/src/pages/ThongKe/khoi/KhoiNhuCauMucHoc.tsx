import { useMemo, useState } from 'react';
import { BarChart } from '@mantine/charts';
import { Alert, Anchor, Box, Button, Group, SegmentedControl, Stack, Table, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams } from 'react-router-dom';
import { useNhuCauMucHoc, xuatNhuCauMucHoc, type LocThongKe } from '@/api/thongKe';
import type { NhuCauMucHocResult, NhuCauMucHocTheoMuc, NhuCauMucHocTruongDong } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { useLocTuUrl } from '../BoLocThongKe';
import { KhoiThongKe } from '../KhoiThongKe';
import { boDau, doiChieuSapXep, sapXepTheoCot, TieuDeSapXep, type Chieu } from '../bangTheoTruong';
import { dinhDangTyLe, MAU_SERIES } from '../mauMuc';

const THAM_SO_CACH_XEM = 'ncmh';
type CachXem = 'tong_hop' | 'theo_truong';
const LUA_CHON_CACH_XEM = [
  { value: 'tong_hop', label: 'Tổng hợp' },
  { value: 'theo_truong', label: 'Theo trường' },
];
const cachXemHopLe = (v: string | null): CachXem => (v === 'theo_truong' ? 'theo_truong' : 'tong_hop');

const SERIES = [
  { name: 'Theo mức đánh giá', color: MAU_SERIES.trung_tinh },
  { name: 'Theo nhu cầu', color: MAU_SERIES.chinh },
];

function chenhLech(n: number): { nhan: string; mau?: string } {
  if (n > 0) return { nhan: `+${n}`, mau: 'teal' };
  if (n < 0) return { nhan: `−${Math.abs(n)}`, mau: 'red' };
  return { nhan: '0' };
}

function DanhSachDieuChinh({ d }: { d: NhuCauMucHocResult }) {
  if (d.dieu_chinh.length === 0) return null;
  const nhan = new Map(d.theo_muc.map((m) => [m.muc, m.nhan]));
  return (
    <Stack gap={4} data-testid="danh-sach-dieu-chinh">
      <Text fw={600} size="sm">
        Học viên đề nghị điều chỉnh
      </Text>
      {d.dieu_chinh.map((o) => (
        <Text key={`${o.tu}-${o.den}`} size="sm">
          {nhan.get(o.tu)} → {nhan.get(o.den)}: {o.so_luong}
        </Text>
      ))}
    </Stack>
  );
}

function TongHop({ d }: { d: NhuCauMucHocResult }) {
  const coMuc = d.so_dang_ky - d.chua_co_muc;
  return (
    <Stack gap="sm">
      <Text size="sm">
        {`Có mức đánh giá: ${coMuc}/${d.so_dang_ky} đăng ký · Đề nghị học mức thấp hơn: ${d.da_dieu_chinh} (${dinhDangTyLe(
          coMuc > 0 ? d.da_dieu_chinh / coMuc : null,
        )} trên số có mức) · Chưa có mức: ${d.chua_co_muc}${
          d.moc_tu_khao_sat > 0 ? ` · Trong đó lấy từ khảo sát: ${d.moc_tu_khao_sat}` : ''
        }`}
      </Text>
      <Text size="xs" c="dimmed">
        Mức đánh giá: mức đầu vào đã chốt; chưa chốt thì quy đổi từ bài đánh giá NLS đầu vào (M1, M2 → Cơ bản; M3 →
        Thành thạo; M4 → Nâng cao). Nhu cầu: mức học viên chọn để xếp lớp (bằng mức đánh giá hoặc thấp hơn 1 mức).
        Tính theo đăng ký khóa học.
      </Text>
      <BarChart
        h={240}
        dataKey="nhan"
        data={d.theo_muc.map((m) => ({
          nhan: m.nhan,
          'Theo mức đánh giá': m.theo_danh_gia,
          'Theo nhu cầu': m.theo_nhu_cau,
        }))}
        series={SERIES}
        withLegend
        legendProps={{ verticalAlign: 'bottom' }}
      />
      <Table.ScrollContainer minWidth={420}>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Mức</Table.Th>
              <Table.Th>Theo mức đánh giá</Table.Th>
              <Table.Th>Theo nhu cầu</Table.Th>
              <Table.Th>Chênh lệch</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {d.theo_muc.map((m) => {
              const cl = chenhLech(m.theo_nhu_cau - m.theo_danh_gia);
              return (
                <Table.Tr key={m.muc}>
                  <Table.Td>{m.nhan}</Table.Td>
                  <Table.Td>{m.theo_danh_gia}</Table.Td>
                  <Table.Td>{m.theo_nhu_cau}</Table.Td>
                  <Table.Td c={cl.mau}>{cl.nhan}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <DanhSachDieuChinh d={d} />
    </Stack>
  );
}

/** Dòng để sắp xếp: thêm "có mức" (tính sẵn từ so_dang_ky - chua_co_muc). */
type Dong = NhuCauMucHocTruongDong & { co_muc: number };

function themKhoaSapXep(r: NhuCauMucHocTruongDong): Dong {
  return { ...r, co_muc: r.so_dang_ky - r.chua_co_muc };
}

function MucCell({ m }: { m: NhuCauMucHocTheoMuc }) {
  const tang = m.theo_nhu_cau > m.theo_danh_gia;
  const giam = m.theo_nhu_cau < m.theo_danh_gia;
  return (
    <Box role="img" aria-label={`${m.nhan}: đánh giá ${m.theo_danh_gia}, nhu cầu ${m.theo_nhu_cau}`}>
      <Text size="sm" span>
        {m.theo_danh_gia} →{' '}
        <Text span fw={700} c={tang ? 'teal' : giam ? 'red' : undefined}>
          {m.theo_nhu_cau}
        </Text>
      </Text>
    </Box>
  );
}

function TheoTruong({ d, loc }: { d: NhuCauMucHocResult; loc: LocThongKe }) {
  const [, setLoc] = useLocTuUrl();
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<{ cot: keyof Dong; chieu: Chieu }>({ cot: 'da_dieu_chinh', chieu: 'desc' });

  const hien = useMemo(() => {
    const t = boDau(tim.trim());
    const loc2 = t ? d.theo_truong.filter((r) => boDau(r.ten_don_vi).includes(t)) : d.theo_truong;
    return sapXepTheoCot(loc2.map(themKhoaSapXep), sap.cot, sap.chieu);
  }, [d, tim, sap]);

  const tieuDe = { dangSap: sap.cot, chieu: sap.chieu, onSap: (cot: keyof Dong) => setSap((cu) => doiChieuSapXep(cu, cot)) };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end">
        <TextInput label="Tìm trường" value={tim} onChange={(e) => setTim(e.currentTarget.value)} />
        <Text size="sm" c="dimmed" pb={8}>
          {hien.length} trường
        </Text>
      </Group>
      <Table.ScrollContainer minWidth={900} maxHeight={520}>
        <Table striped stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <TieuDeSapXep nhan="Trường" cot="ten_don_vi" {...tieuDe} />
              <TieuDeSapXep nhan="Số ĐK" cot="so_dang_ky" canPhai {...tieuDe} />
              <TieuDeSapXep nhan="Có mức" cot="co_muc" canPhai {...tieuDe} />
              <TieuDeSapXep nhan="Đã điều chỉnh" cot="da_dieu_chinh" canPhai {...tieuDe} />
              {d.theo_muc.map((m) => (
                <Table.Th key={m.muc}>{m.nhan}</Table.Th>
              ))}
              <TieuDeSapXep nhan="Chưa có mức" cot="chua_co_muc" canPhai {...tieuDe} />
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
                <Table.Td ta="right">{r.so_dang_ky}</Table.Td>
                <Table.Td ta="right">{r.co_muc}</Table.Td>
                <Table.Td ta="right">
                  {`${r.da_dieu_chinh} (${dinhDangTyLe(r.co_muc > 0 ? r.da_dieu_chinh / r.co_muc : null)})`}
                </Table.Td>
                {r.theo_muc.map((m) => (
                  <Table.Td key={m.muc}>
                    <MucCell m={m} />
                  </Table.Td>
                ))}
                <Table.Td ta="right">{r.chua_co_muc}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

export function KhoiNhuCauMucHoc({ loc }: { loc: LocThongKe }) {
  const query = useNhuCauMucHoc(loc);
  const d = query.data;
  const coMuc = d ? d.so_dang_ky - d.chua_co_muc : 0;
  const [params, setParams] = useSearchParams();
  const cach = cachXemHopLe(params.get(THAM_SO_CACH_XEM));
  const [dangXuat, setDangXuat] = useState(false);

  function doiCach(v: string) {
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.set(THAM_SO_CACH_XEM, cachXemHopLe(v));
        return moi;
      },
      { replace: true },
    );
  }

  async function xuatExcel() {
    setDangXuat(true);
    try {
      await xuatNhuCauMucHoc(loc);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  return (
    <KhoiThongKe
      tieu_de="Nhu cầu mức học (theo đề nghị của học viên)"
      query={query}
      rong={coMuc === 0}
      thong_bao_rong="Chưa có học viên có mức đánh giá đầu vào"
      dieu_khien={
        <Group justify="space-between" align="flex-end">
          <SegmentedControl
            aria-label="Cách xem nhu cầu"
            data={LUA_CHON_CACH_XEM}
            value={cach}
            onChange={doiCach}
          />
          <Button size="xs" variant="light" loading={dangXuat} onClick={() => void xuatExcel()}>
            Xuất Excel
          </Button>
        </Group>
      }
    >
      {d && d.so_nhan_vien_loai_tru > 0 && (
        <Alert color="orange" variant="light" p="xs" mb="xs">
          {`Không tính ${d.so_nhan_vien_loai_tru} đăng ký của nhân viên (không tham gia khảo sát – đánh giá và tập huấn).`}
        </Alert>
      )}
      {d && (cach === 'theo_truong' ? <TheoTruong d={d} loc={loc} /> : <TongHop d={d} />)}
    </KhoiThongKe>
  );
}
