import { BarChart } from '@mantine/charts';
import { Stack } from '@mantine/core';
import { useKetQuaHoc, type LocThongKe } from '@/api/thongKe';
import { ChuThich } from '../ChuThich';
import { KhoiThongKe } from '../KhoiThongKe';

const SERIES = [
  { name: 'Đạt', color: 'green.7' },
  { name: 'Không đạt', color: 'red.6' },
  { name: 'Vắng', color: 'yellow.6' },
  { name: 'Đang học', color: 'gray.5' },
];

export function KhoiKetQuaHoc({ loc }: { loc: LocThongKe }) {
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
