import { BarChart, CompositeChart } from '@mantine/charts';
import { Stack, Tabs, Text } from '@mantine/core';
import { useChuyenCan, type LocThongKe } from '@/api/thongKe';
import type { BuoiChuyenCan, ChuyenCanResult } from '@/api/types';
import { ChuThich } from '../ChuThich';
import { KhoiThongKe } from '../KhoiThongKe';
import { MAU_SERIES } from '../mauMuc';

const SERIES_TRUC_TIEP = [
  { name: 'Có mặt', color: MAU_SERIES.thu_hai, type: 'bar' as const },
  { name: 'Vắng có phép', color: MAU_SERIES.chinh, type: 'bar' as const },
  { name: 'Vắng', color: MAU_SERIES.thu_ba, type: 'bar' as const },
  { name: 'Tỷ lệ có mặt', color: MAU_SERIES.trung_tinh, type: 'line' as const, yAxisId: 'right' },
];

function TrucTiep({ d }: { d: BuoiChuyenCan[] | null }) {
  if (d === null) return <Text c="dimmed" size="sm">Chọn một khóa để xem</Text>;
  if (d.length === 0) return <Text c="dimmed" size="sm">Chưa có dữ liệu điểm danh</Text>;
  return (
    <Stack gap="xs">
      <CompositeChart
        h={280}
        dataKey="nhan"
        data={d.map((b) => ({
          nhan: b.nhan,
          'Có mặt': b.co_mat,
          'Vắng có phép': b.vang_co_phep,
          Vắng: b.vang,
          'Tỷ lệ có mặt': b.ty_le_co_mat === null ? undefined : Math.round(b.ty_le_co_mat * 1000) / 10,
        }))}
        series={SERIES_TRUC_TIEP}
        barProps={{ stackId: 'diem-danh' }}
        withRightYAxis
        rightYAxisProps={{ domain: [0, 100], tickFormatter: (v: number) => `${v}%` }}
      />
      <ChuThich testId="chu-thich-chuyen-can" muc={SERIES_TRUC_TIEP.map((s) => ({ nhan: s.name, mau: s.color }))} />
    </Stack>
  );
}

function Vle({ d }: { d: ChuyenCanResult['vle'] }) {
  const tong = d.khoang.reduce((t, k) => t + k.so_luong, 0);
  if (tong === 0) return <Text c="dimmed" size="sm">Chưa có dữ liệu tiến trình VLE</Text>;
  return (
    <Stack gap="xs">
      <BarChart
        h={240}
        dataKey="khoang"
        data={d.khoang.map((k) => ({ khoang: `${k.khoang}%`, 'Số học viên': k.so_luong }))}
        series={[{ name: 'Số học viên', color: MAU_SERIES.chinh }]}
      />
      <Text size="xs" c="dimmed">
        Chưa có dữ liệu: {d.chua_co_du_lieu}
      </Text>
    </Stack>
  );
}

export function KhoiChuyenCan({ loc }: { loc: LocThongKe }) {
  const query = useChuyenCan(loc);
  const d = query.data;

  return (
    <KhoiThongKe tieu_de="Chuyên cần" query={query} rong={false}>
      {d && (
        <Tabs defaultValue="truc-tiep" keepMounted={false}>
          <Tabs.List mb="sm">
            <Tabs.Tab value="truc-tiep">Trực tiếp / Zoom</Tabs.Tab>
            <Tabs.Tab value="vle">VLE</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="truc-tiep">
            <TrucTiep d={d.truc_tiep} />
          </Tabs.Panel>
          <Tabs.Panel value="vle">
            <Vle d={d.vle} />
          </Tabs.Panel>
        </Tabs>
      )}
    </KhoiThongKe>
  );
}
