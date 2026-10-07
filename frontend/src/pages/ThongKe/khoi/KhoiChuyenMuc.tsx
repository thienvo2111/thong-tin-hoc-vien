import { Box, Stack, Text, alpha } from '@mantine/core';
import { useChuyenMuc, type LocThongKe } from '@/api/thongKe';
import type { ChuyenMucResult } from '@/api/types';
import { KhoiThongKe } from '../KhoiThongKe';
import { dinhDangTyLe } from '../mauMuc';

function MaTran({ d }: { d: ChuyenMucResult }) {
  const n = d.thang.length;
  const max = Math.max(1, ...d.o.map((o) => o.so_luong));
  const soLuong = (tu: string, den: string) => d.o.find((o) => o.tu === tu && o.den === den)?.so_luong ?? 0;

  return (
    <Box
      style={{ display: 'grid', gridTemplateColumns: `auto repeat(${n}, minmax(48px, 1fr))`, gap: 4 }}
      data-testid="ma-tran-chuyen-muc"
    >
      <Text size="xs" c="dimmed" ta="center">
        Vào ↓ / Ra →
      </Text>
      {d.thang.map((t) => (
        <Text key={t.ma} size="xs" fw={600} ta="center">
          {t.nhan}
        </Text>
      ))}
      {d.thang.map((tu) => [
        <Text key={`h-${tu.ma}`} size="xs" fw={600} pr="xs" style={{ alignSelf: 'center' }}>
          {tu.nhan}
        </Text>,
        ...d.thang.map((den) => {
          const so = soLuong(tu.ma, den.ma);
          return (
            <Box
              key={`${tu.ma}-${den.ma}`}
              role="img"
              aria-label={`Từ ${tu.ma} sang ${den.ma}: ${so} học viên`}
              style={{
                background: alpha('var(--mantine-color-indigo-6)', so / max),
                borderRadius: 4,
                textAlign: 'center',
                padding: '12px 4px',
                fontWeight: 600,
              }}
            >
              {so}
            </Box>
          );
        }),
      ])}
    </Box>
  );
}

export function KhoiChuyenMuc({ loc }: { loc: LocThongKe }) {
  const query = useChuyenMuc(loc);
  const d = query.data;

  return (
    <KhoiThongKe
      tieu_de="Chuyển mức đầu vào → đầu ra"
      query={query}
      rong={d?.tong === 0}
      thong_bao_rong="Chưa có học viên đủ kết quả đầu vào và đầu ra"
    >
      {d && (
        <Stack gap="sm">
          <MaTran d={d} />
          <Text size="sm">
            {`${dinhDangTyLe(d.tang / d.tong)} tăng mức · ${dinhDangTyLe(d.giu / d.tong)} giữ nguyên · ${dinhDangTyLe(d.giam / d.tong)} giảm`}
          </Text>
        </Stack>
      )}
    </KhoiThongKe>
  );
}
