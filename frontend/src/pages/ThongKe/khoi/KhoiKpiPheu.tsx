import { BarChart } from '@mantine/charts';
import { Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { usePheu, type LocThongKe } from '@/api/thongKe';
import type { PheuResult } from '@/api/types';
import { KhoiThongKe } from '../KhoiThongKe';
import { dinhDangTyLe } from '../mauMuc';

/** a/b, null khi mẫu số 0 (hiển thị "—", không NaN%). */
function tyLe(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

interface TheKpi {
  id: string;
  nhan: string;
  so: number;
  /** so với số tham gia; undefined = không hiện */
  ty_le?: number | null;
}

function dungKpi(d: PheuResult): TheKpi[] {
  return [
    { id: 'kpi-tham-gia', nhan: 'Tham gia', so: d.tham_gia },
    { id: 'kpi-da-truy-cap', nhan: 'Đã truy cập', so: d.da_truy_cap, ty_le: tyLe(d.da_truy_cap, d.tham_gia) },
    { id: 'kpi-ky-nang-so', nhan: 'Đã làm KS kĩ năng số', so: d.khao_sat_ky_nang_so, ty_le: tyLe(d.khao_sat_ky_nang_so, d.tham_gia) },
    { id: 'kpi-dau-vao', nhan: 'Đã làm đánh giá NLS đầu vào', so: d.danh_gia_dau_vao, ty_le: tyLe(d.danh_gia_dau_vao, d.tham_gia) },
    { id: 'kpi-dau-ra', nhan: 'Đã làm đánh giá NLS đầu ra', so: d.danh_gia_dau_ra, ty_le: tyLe(d.danh_gia_dau_ra, d.tham_gia) },
  ];
}

function dungPheu(d: PheuResult) {
  const buoc = [
    { id: 'pheu-tham-gia', nhan: 'Tham gia', so: d.tham_gia },
    { id: 'pheu-da-truy-cap', nhan: 'Truy cập', so: d.da_truy_cap },
    { id: 'pheu-ks-ky-nang-so', nhan: 'KS kĩ năng số', so: d.khao_sat_ky_nang_so },
    { id: 'pheu-dau-vao', nhan: 'Đánh giá NLS đầu vào', so: d.danh_gia_dau_vao },
    { id: 'pheu-dau-ra', nhan: 'Đánh giá NLS đầu ra', so: d.danh_gia_dau_ra },
  ];
  return buoc.map((b, i) => {
    return { ...b, ty_le: i === 0 ? undefined : tyLe(b.so, d.tham_gia) };
  });
}

export function KhoiKpiPheu({ loc }: { loc: LocThongKe }) {
  const query = usePheu(loc);
  const d = query.data;

  return (
    <Stack gap="md">
      <KhoiThongKe tieu_de="Tổng quan tham gia" query={query} rong={false}>
        {d && (
          <SimpleGrid cols={{ base: 2, md: d.ho_so_cho_duyet === null ? 5 : 6 }}>
            {dungKpi(d).map((t) => (
              <Paper key={t.id} withBorder p="sm" radius="md" data-testid={t.id}>
                <Text size="sm" c="dimmed">
                  {t.nhan}
                </Text>
                <Text fz={28} fw={700}>
                  {t.so}
                </Text>
                {t.ty_le !== undefined && (
                  <Text size="xs" c="dimmed">
                    {dinhDangTyLe(t.ty_le)} số tham gia
                  </Text>
                )}
              </Paper>
            ))}
            {d.ho_so_cho_duyet !== null && (
              <Paper
                withBorder
                p="sm"
                radius="md"
                component={Link}
                to="/admin/hoc-vien?trang_thai=cho_duyet"
                aria-label="Hồ sơ chờ duyệt: Xem danh sách"
                data-testid="kpi-cho-duyet"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Text size="sm" c="dimmed">
                  Hồ sơ chờ duyệt
                </Text>
                <Text fz={28} fw={700}>
                  {d.ho_so_cho_duyet}
                </Text>
              </Paper>
            )}
          </SimpleGrid>
        )}
      </KhoiThongKe>
      <KhoiThongKe tieu_de="Phễu tham gia" query={query} rong={false}>
        {d && <Pheu d={d} />}
      </KhoiThongKe>
    </Stack>
  );
}

function Pheu({ d }: { d: PheuResult }) {
  const buoc = dungPheu(d);
  return (
    <Stack gap="sm">
      {/* orientation="vertical" của @mantine/charts = thanh nằm ngang */}
      <BarChart
        h={220}
        orientation="vertical"
        data={buoc.map((b) => ({ buoc: b.nhan, 'Số học viên': b.so }))}
        dataKey="buoc"
        series={[{ name: 'Số học viên', color: 'blue.6' }]}
        yAxisProps={{ width: 150 }}
      />
      <Stack gap={4}>
        {buoc.map((b) => (
          <Group key={b.id} justify="space-between" data-testid={b.id}>
            <Text size="sm">{b.nhan}</Text>
            <Group gap="xs">
              <Text size="sm" fw={600}>
                {b.so}
              </Text>
              {b.ty_le !== undefined && (
                <Text size="xs" c="dimmed">
                  {dinhDangTyLe(b.ty_le)} số tham gia
                </Text>
              )}
            </Group>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
