import { BarChart } from '@mantine/charts';
import { Stack } from '@mantine/core';
import { useSoSanhKhoa, type LocThongKe } from '@/api/thongKe';
import { ChuThich } from '../ChuThich';
import { MAU_SERIES } from '../mauMuc';
import { KhoiThongKe } from '../KhoiThongKe';

const SERIES = [
  { name: '% truy cập', color: MAU_SERIES.chinh },
  { name: '% hoàn thành KS đầu vào', color: MAU_SERIES.thu_hai },
  { name: '% Đạt', color: MAU_SERIES.thu_ba },
];

const phanTram = (x: number | null) => (x === null ? undefined : Math.round(x * 1000) / 10);

/** Chỉ có nghĩa khi chưa chọn khóa (spec §4 khối 3). */
export function KhoiSoSanhKhoa({ loc }: { loc: LocThongKe }) {
  const hien = !loc.khoa_id;
  const query = useSoSanhKhoa(loc, hien);
  if (!hien) return null;
  const d = query.data;

  return (
    <KhoiThongKe tieu_de="So sánh giữa các khóa" query={query} rong={d?.length === 0}>
      {d && (
        <Stack gap="xs">
          <BarChart
            h={260}
            dataKey="ten_khoa"
            data={d.map((c) => ({
              ten_khoa: c.ten_khoa,
              '% truy cập': phanTram(c.ty_le_truy_cap),
              '% hoàn thành KS đầu vào': phanTram(c.ty_le_dau_vao),
              '% Đạt': phanTram(c.ty_le_dat),
            }))}
            series={SERIES}
            yAxisProps={{ domain: [0, 100] }}
            valueFormatter={(v) => `${v}%`}
          />
          <ChuThich muc={SERIES.map((s) => ({ nhan: s.name, mau: s.color }))} />
        </Stack>
      )}
    </KhoiThongKe>
  );
}
