import { useMemo, useState } from 'react';
import { Anchor, Button, Group, Progress, SegmentedControl, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams } from 'react-router-dom';
import { useMucNls, xuatMucNls, type LocThongKe } from '@/api/thongKe';
import type { LoaiMucNls, MucNlsTruongDong } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { useLocTuUrl } from '../BoLocThongKe';
import { KhoiThongKe } from '../KhoiThongKe';
import { boDau, doiChieuSapXep, sapXepTheoCot, TieuDeSapXep, type Chieu } from '../bangTheoTruong';
import { dinhDangTyLe, MAU_MUC, MAU_SERIES } from '../mauMuc';

const THAM_SO_LOAI = 'mnls';
const LOAI_MAC_DINH: LoaiMucNls = 'dau_vao';
const LUA_CHON_LOAI = [
  { value: 'dau_vao', label: 'Đầu vào' },
  { value: 'dau_ra', label: 'Đầu ra' },
];

const loaiHopLe = (v: string | null): LoaiMucNls => (v === 'dau_ra' ? 'dau_ra' : LOAI_MAC_DINH);

/** Dòng để sắp xếp: thêm tỷ lệ đã làm và một khóa số cho mỗi mức (muc_<ma>). */
type Dong = MucNlsTruongDong & { ty_le_da_lam: number | null; [khoa: `muc_${string}`]: number };

const khoaMuc = (ma: string) => `muc_${ma}` as const;

function themKhoaSapXep(r: MucNlsTruongDong): Dong {
  const dong: Dong = { ...r, ty_le_da_lam: r.so_hv === 0 ? null : r.da_lam / r.so_hv };
  for (const m of r.theo_muc) dong[khoaMuc(m.ma)] = m.so_luong;
  return dong;
}

const mauMuc = (ma: string): string => (ma in MAU_MUC ? MAU_MUC[ma as keyof typeof MAU_MUC] : MAU_SERIES.chinh);

const phanTramTrenDaLam = (so: number, daLam: number) => dinhDangTyLe(daLam === 0 ? null : so / daLam);

function ThanhPhanBo({ r }: { r: MucNlsTruongDong }) {
  if (r.da_lam === 0) return <Text size="sm">—</Text>;
  const phan = [
    ...r.theo_muc.map((m) => ({ nhan: m.nhan, so: m.so_luong, mau: mauMuc(m.ma) })),
    { nhan: 'Chưa xếp mức', so: r.chua_xep_muc, mau: 'gray.5' },
  ];
  const moTa = phan.filter((p) => p.so > 0 || p.nhan !== 'Chưa xếp mức').map((p) => `${p.nhan} ${p.so}`);
  return (
    <Progress.Root size="md" w={160} role="img" aria-label={`${r.ten_don_vi}: ${moTa.join(', ')}`}>
      {phan
        .filter((p) => p.so > 0)
        .map((p) => (
          <Tooltip key={p.nhan} label={`${p.nhan}: ${p.so} (${phanTramTrenDaLam(p.so, r.da_lam)})`}>
            <Progress.Section value={(p.so / r.da_lam) * 100} color={p.mau} />
          </Tooltip>
        ))}
    </Progress.Root>
  );
}

export function KhoiMucNlsTheoTruong({ loc }: { loc: LocThongKe }) {
  const [, setLoc] = useLocTuUrl();
  const [params, setParams] = useSearchParams();
  const loai = loaiHopLe(params.get(THAM_SO_LOAI));
  const query = useMucNls(loc, loai);
  const [tim, setTim] = useState('');
  const [sap, setSap] = useState<{ cot: string; chieu: Chieu }>({ cot: 'ty_le_da_lam', chieu: 'asc' });
  const [dangXuat, setDangXuat] = useState(false);
  const d = query.data;

  const hien = useMemo(() => {
    if (!d) return [];
    const t = boDau(tim.trim());
    const loc2 = t ? d.theo_truong.filter((r) => boDau(r.ten_don_vi).includes(t)) : d.theo_truong;
    return sapXepTheoCot(loc2.map(themKhoaSapXep), sap.cot as keyof Dong, sap.chieu);
  }, [d, tim, sap]);

  function doiLoai(v: string) {
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.set(THAM_SO_LOAI, loaiHopLe(v));
        return moi;
      },
      { replace: true },
    );
  }

  async function xuatExcel() {
    setDangXuat(true);
    try {
      await xuatMucNls(loc, loai);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  const tieuDe = { dangSap: sap.cot, chieu: sap.chieu, onSap: (cot: string) => setSap((cu) => doiChieuSapXep(cu, cot)) };

  return (
    <KhoiThongKe
      tieu_de="Đánh giá NLS thực tế theo mức — theo trường"
      query={query}
      rong={d?.theo_truong.length === 0}
      thong_bao_rong="Chưa có học viên trong phạm vi lọc"
      dieu_khien={
        <Group justify="space-between" align="flex-end">
          <Group align="flex-end" gap="md">
            <SegmentedControl
              aria-label="Loại đánh giá"
              data={LUA_CHON_LOAI}
              value={loai}
              onChange={doiLoai}
            />
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
      {d && loc.doi_tuong === 'nhan_vien' && (
        <Text size="xs" c="dimmed">
          Nhân viên hiện không thực hiện khảo sát – đánh giá.
        </Text>
      )}
      {d && (
        <Table.ScrollContainer minWidth={900} maxHeight={520}>
          <Table striped stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <TieuDeSapXep nhan="Trường" cot="ten_don_vi" {...tieuDe} />
                <TieuDeSapXep nhan="Số HV" cot="so_hv" canPhai {...tieuDe} />
                <TieuDeSapXep nhan="Đã làm" cot="ty_le_da_lam" {...tieuDe} />
                <Table.Th>Phân bố mức</Table.Th>
                {d.thang.map((m) => (
                  <TieuDeSapXep key={m.ma} nhan={m.nhan} cot={khoaMuc(m.ma)} canPhai {...tieuDe} />
                ))}
                <TieuDeSapXep nhan="Chưa làm" cot="chua_lam" canPhai {...tieuDe} />
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
                  <Table.Td>
                    {r.so_hv === 0 ? '—' : `${r.da_lam}/${r.so_hv} · ${dinhDangTyLe(r.ty_le_da_lam)}`}
                  </Table.Td>
                  <Table.Td>
                    <ThanhPhanBo r={r} />
                  </Table.Td>
                  {r.theo_muc.map((m) => (
                    <Table.Td key={m.ma} ta="right">
                      {m.so_luong}
                    </Table.Td>
                  ))}
                  <Table.Td ta="right">{r.chua_lam}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </KhoiThongKe>
  );
}
