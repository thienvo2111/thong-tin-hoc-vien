import { DonutChart } from '@mantine/charts';
import { Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { useKhaoSat, type LocThongKe } from '@/api/thongKe';
import type { KhaoSatResult } from '@/api/types';
import { ChuThich } from '../ChuThich';
import { KhoiThongKe } from '../KhoiThongKe';
import { MAU_MUC } from '../mauMuc';

type Khoi = KhaoSatResult['dau_vao'];

const mauMuc = (ma: string) => MAU_MUC[ma as keyof typeof MAU_MUC] ?? 'gray.5';

function Donut({ tieu_de, testId, k }: { tieu_de: string; testId: string; k: Khoi }) {
  const lat = k.theo_muc.map((m) => ({ name: m.nhan, value: m.so_luong, color: mauMuc(m.ma) }));
  const tong = lat.reduce((s, m) => s + m.value, 0) + k.chua_xep_muc;
  const duLieu = k.chua_xep_muc > 0 ? [...lat, { name: 'Chưa xếp mức', value: k.chua_xep_muc, color: 'gray.5' }] : lat;
  return (
    <Paper withBorder p="sm" radius="md" data-testid={testId}>
      <Stack gap="xs" align="center">
        <Text fw={600} size="sm">
          {tieu_de}
        </Text>
        {tong > 0 ? (
          <DonutChart size={160} thickness={24} withTooltip data={duLieu} />
        ) : (
          <Text size="sm" c="dimmed">
            Chưa có kết quả
          </Text>
        )}
        <Stack gap={4}>
          {k.theo_muc.map((m) => (
            <ChuThich key={m.ma} muc={[{ nhan: `${m.nhan}: ${m.so_luong}`, mau: mauMuc(m.ma) }]} />
          ))}
          <ChuThich muc={[{ nhan: `Chưa xếp mức: ${k.chua_xep_muc}`, mau: 'gray.5' }]} />
        </Stack>
      </Stack>
    </Paper>
  );
}

export function KhoiKhaoSat({ loc }: { loc: LocThongKe }) {
  const query = useKhaoSat(loc);
  const d = query.data;

  return (
    <KhoiThongKe tieu_de="Kết quả khảo sát" query={query} rong={false}>
      {d && (
        <Stack gap="sm">
          <Text size="sm" data-testid="ky-nang-so">
            Khảo sát kỹ năng số: {d.ky_nang_so.hoan_thanh}/{d.ky_nang_so.hoan_thanh + d.ky_nang_so.chua} hoàn thành
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Donut tieu_de="Đánh giá đầu vào" testId="donut-dau-vao" k={d.dau_vao} />
            <Donut tieu_de="Đánh giá đầu ra" testId="donut-dau-ra" k={d.dau_ra} />
          </SimpleGrid>
        </Stack>
      )}
    </KhoiThongKe>
  );
}
