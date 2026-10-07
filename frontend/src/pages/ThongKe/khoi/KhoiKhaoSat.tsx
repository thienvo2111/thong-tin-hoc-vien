import { DonutChart } from '@mantine/charts';
import { Paper, Progress, SimpleGrid, Stack, Text } from '@mantine/core';
import { useKhaoSat, type LocThongKe } from '@/api/thongKe';
import type { KhaoSatResult } from '@/api/types';
import { ChuThich } from '../ChuThich';
import { KhoiThongKe } from '../KhoiThongKe';
import { MAU_MUC, MAU_SERIES, dinhDangTyLe } from '../mauMuc';

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
          <ChuThich muc={[{ nhan: `Chưa làm: ${k.chua_lam}`, mau: 'gray.3' }]} />
        </Stack>
      </Stack>
    </Paper>
  );
}

function KyNangSo({ k }: { k: KhaoSatResult['ky_nang_so'] }) {
  const tong = k.hoan_thanh + k.chua;
  const tyLe = tong > 0 ? k.hoan_thanh / tong : null;
  return (
    <Stack gap={4} data-testid="ky-nang-so">
      <Text fw={600} size="sm">
        Khảo sát kĩ năng số (không phân mức)
      </Text>
      <Progress value={(tyLe ?? 0) * 100} color={MAU_SERIES.chinh} aria-label="Tỷ lệ hoàn thành khảo sát kĩ năng số" />
      <Text size="sm">
        Hoàn thành: {k.hoan_thanh} / {tong} ({dinhDangTyLe(tyLe)}) · Chưa làm: {k.chua}
      </Text>
    </Stack>
  );
}

export function KhoiKhaoSat({ loc }: { loc: LocThongKe }) {
  const query = useKhaoSat(loc);
  const d = query.data;

  return (
    <KhoiThongKe tieu_de="Kết quả khảo sát" query={query} rong={false}>
      {d && (
        <Stack gap="sm">
          <KyNangSo k={d.ky_nang_so} />
          <Text fw={600} size="sm">
            Đánh giá năng lực số
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Donut tieu_de="Đánh giá NLS đầu vào" testId="donut-dau-vao" k={d.dau_vao} />
            <Donut tieu_de="Đánh giá NLS đầu ra" testId="donut-dau-ra" k={d.dau_ra} />
          </SimpleGrid>
        </Stack>
      )}
    </KhoiThongKe>
  );
}
