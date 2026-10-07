import { useState } from 'react';
import { BarChart } from '@mantine/charts';
import { Paper, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { useXepHang, type ChiSoXepHang, type LocThongKe } from '@/api/thongKe';
import type { XepHangDong, XepHangResult } from '@/api/types';
import { KhoiThongKe } from '../KhoiThongKe';
import { dinhDangTyLe, MAU_SERIES } from '../mauMuc';

const CHI_SO = [
  { value: 'truy_cap', label: 'Truy cập' },
  { value: 'khao_sat', label: 'Khảo sát' },
  { value: 'dat', label: 'Đạt' },
];

function BangTop({ tieu_de, dong, mau }: { tieu_de: string; dong: XepHangDong[]; mau: string }) {
  return (
    <Stack gap={4}>
      <Text fw={600} size="sm">
        {tieu_de}
      </Text>
      <BarChart
        h={Math.max(120, dong.length * 36 + 40)}
        orientation="vertical"
        dataKey="ten_don_vi"
        data={dong.map((r) => ({ ten_don_vi: r.ten_don_vi, 'Tỷ lệ (%)': Math.round(r.gia_tri * 1000) / 10 }))}
        series={[{ name: 'Tỷ lệ (%)', color: mau }]}
        xAxisProps={{ domain: [0, 100] }}
        yAxisProps={{ width: 140 }}
        valueFormatter={(v) => `${v}%`}
      />
    </Stack>
  );
}

function ViTri({ d }: { d: Extract<XepHangResult, { kieu: 'vi_tri' }> }) {
  if (d.tong_so === 0) {
    return <Text c="dimmed">Không có trường cùng cấp để so sánh</Text>;
  }
  if (d.thu_hang === null) {
    return <Text c="dimmed">Chưa đủ 5 học viên để xếp hạng</Text>;
  }
  return (
    <Paper withBorder p="md" radius="md" data-testid="xep-hang-vi-tri">
      <Text fw={700} size="xl">
        Thứ {d.thu_hang}/{d.tong_so}
      </Text>
      <Text size="sm">
        Trường bạn {dinhDangTyLe(d.gia_tri)} · Trung bình {dinhDangTyLe(d.trung_binh)}
      </Text>
    </Paper>
  );
}

export function KhoiXepHang({ loc }: { loc: LocThongKe }) {
  const [chiSo, setChiSo] = useState<ChiSoXepHang>('truy_cap');
  const query = useXepHang({ ...loc, chi_so: chiSo });
  const d = query.data;
  const rong = d?.kieu === 'bang' && d.top.length === 0 && d.bottom.length === 0;

  return (
    <KhoiThongKe
      tieu_de="Xếp hạng đơn vị"
      query={query}
      rong={rong}
      dieu_khien={
        <SegmentedControl
          aria-label="Chỉ số xếp hạng"
          value={chiSo}
          onChange={(v) => setChiSo(v as ChiSoXepHang)}
          data={CHI_SO}
        />
      }
    >
      <Stack gap="sm">
        {d?.kieu === 'bang' && (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <BangTop tieu_de="Cao nhất" dong={d.top} mau={MAU_SERIES.thu_hai} />
            <BangTop tieu_de="Thấp nhất" dong={d.bottom} mau={MAU_SERIES.thu_ba} />
          </SimpleGrid>
        )}
        {d?.kieu === 'vi_tri' && <ViTri d={d} />}
      </Stack>
    </KhoiThongKe>
  );
}
