import { useMemo, useState } from 'react';
import { BarChart } from '@mantine/charts';
import { Group, Progress, ScrollArea, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core';
import { useKetQuaHoc, useKetQuaHocTheoTruong, type LocThongKe } from '@/api/thongKe';
import type { KetQuaHocTruongDong } from '@/api/types';
import { ChuThich } from '../ChuThich';
import { dinhDangTyLe, MAU_SERIES } from '../mauMuc';
import { KhoiThongKe } from '../KhoiThongKe';

const SERIES = [
  { name: 'Đạt', color: MAU_SERIES.thu_hai },
  { name: 'Không đạt', color: MAU_SERIES.thu_ba },
  { name: 'Vắng', color: MAU_SERIES.chinh },
  { name: 'Đang học', color: MAU_SERIES.trung_tinh },
];

const DOAN: { nhan: string; key: 'dat' | 'khong_dat' | 'vang' | 'dang_hoc'; mau: string }[] = [
  { nhan: 'Đạt', key: 'dat', mau: MAU_SERIES.thu_hai },
  { nhan: 'Không đạt', key: 'khong_dat', mau: MAU_SERIES.thu_ba },
  { nhan: 'Vắng', key: 'vang', mau: MAU_SERIES.chinh },
  { nhan: 'Đang học', key: 'dang_hoc', mau: MAU_SERIES.trung_tinh },
];

type CachSapXep = 'ty_le_dat' | 'ten';

const tong = (d: KetQuaHocTruongDong) => d.dat + d.khong_dat + d.vang + d.dang_hoc;
const tyLeDat = (d: KetQuaHocTruongDong) => (tong(d) === 0 ? null : d.dat / tong(d));

function sapXep(ds: KetQuaHocTruongDong[], cach: CachSapXep): KetQuaHocTruongDong[] {
  const theoTen = (a: KetQuaHocTruongDong, b: KetQuaHocTruongDong) => a.ten_don_vi.localeCompare(b.ten_don_vi, 'vi');
  return [...ds].sort((a, b) => {
    if (cach === 'ten') return theoTen(a, b);
    const x = tyLeDat(a);
    const y = tyLeDat(b);
    if (x === null && y === null) return theoTen(a, b);
    if (x === null) return 1; // tổng 0 luôn cuối
    if (y === null) return -1;
    return x - y || theoTen(a, b);
  });
}

function nhanAria(d: KetQuaHocTruongDong): string {
  return `${d.ten_don_vi}: Đạt ${d.dat}, Không đạt ${d.khong_dat}, Vắng ${d.vang}, Đang học ${d.dang_hoc}`;
}

function DongTruong({ d }: { d: KetQuaHocTruongDong }) {
  const t = tong(d);
  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="sm" w={220} truncate title={d.ten_don_vi}>
        {d.ten_don_vi}
      </Text>
      <Progress.Root size="lg" role="img" aria-label={nhanAria(d)} style={{ flex: 1 }}>
        {DOAN.filter((s) => d[s.key] > 0).map((s) => (
          <Tooltip key={s.key} label={`${s.nhan}: ${d[s.key]} (${dinhDangTyLe(d[s.key] / t)})`}>
            <Progress.Section value={(d[s.key] / t) * 100} color={s.mau} />
          </Tooltip>
        ))}
      </Progress.Root>
      <Text size="sm" w={64} ta="right">
        {dinhDangTyLe(tyLeDat(d))}
      </Text>
    </Group>
  );
}

function KetQuaTheoTruong({ loc }: { loc: LocThongKe }) {
  const query = useKetQuaHocTheoTruong(loc);
  const [cach, setCach] = useState<CachSapXep>('ty_le_dat');
  const d = query.data;
  const ds = useMemo(() => (d ? sapXep(d, cach) : []), [d, cach]);

  return (
    <KhoiThongKe
      tieu_de="Kết quả học tập"
      query={query}
      rong={d?.length === 0}
      thong_bao_rong="Chưa có học viên trong khóa đã chọn"
      dieu_khien={
        <Group justify="space-between">
          <Group gap="xs">
            <Text size="sm">Sắp theo:</Text>
            <SegmentedControl
              size="xs"
              aria-label="Cách sắp xếp trường"
              value={cach}
              onChange={(v) => setCach(v as CachSapXep)}
              data={[
                { value: 'ty_le_dat', label: '% Đạt tăng dần' },
                { value: 'ten', label: 'Tên trường' },
              ]}
            />
          </Group>
          {d && (
            <Text size="sm" c="dimmed">
              {d.length} trường
            </Text>
          )}
        </Group>
      }
    >
      {d && (
        <Stack gap="xs">
          <ScrollArea.Autosize mah={520}>
            <Stack gap="xs">
              {ds.map((x) => (
                <DongTruong key={x.don_vi_id} d={x} />
              ))}
            </Stack>
          </ScrollArea.Autosize>
          <ChuThich testId="chu-thich-ket-qua" muc={SERIES.map((s) => ({ nhan: s.name, mau: s.color }))} />
        </Stack>
      )}
    </KhoiThongKe>
  );
}

function KetQuaTheoKhoa({ loc }: { loc: LocThongKe }) {
  const query = useKetQuaHoc(loc);
  const d = query.data;

  return (
    <KhoiThongKe tieu_de="Kết quả học tập" query={query} rong={d?.length === 0}>
      {d && (
        <Stack gap="xs">
          <BarChart
            h={260}
            type="percent"
            dataKey="ten_khoa"
            data={d.map((c) => ({
              ten_khoa: c.ten_khoa,
              Đạt: c.dat,
              'Không đạt': c.khong_dat,
              Vắng: c.vang,
              'Đang học': c.dang_hoc,
            }))}
            series={SERIES}
          />
          <ChuThich testId="chu-thich-ket-qua" muc={SERIES.map((s) => ({ nhan: s.name, mau: s.color }))} />
        </Stack>
      )}
    </KhoiThongKe>
  );
}

export function KhoiKetQuaHoc({ loc }: { loc: LocThongKe }) {
  return loc.khoa_id ? <KetQuaTheoTruong loc={loc} /> : <KetQuaTheoKhoa loc={loc} />;
}
