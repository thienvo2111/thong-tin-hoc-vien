import { useState } from 'react';
import { Alert, Badge, Button, Container, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useDanhSachDotTrienKhai, type DotTrienKhai } from '@/api/dotTrienKhai';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayLich, dinhDangTien } from '@/lib/ngayLich';
import { ModalDotTrienKhai } from './ModalDotTrienKhai';

const CHUA_CO = 'Chưa có';

function DongThongTin({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <Text fz="sm">
      <Text span c="dimmed" fz="sm">
        {nhan}:{' '}
      </Text>
      {giaTri}
    </Text>
  );
}

function TheDot({ dot, onSua }: { dot: DotTrienKhai; onSua: () => void }) {
  const khoangQd =
    dot.ngay_qd_tu && dot.ngay_qd_den
      ? `${dinhDangNgayLich(dot.ngay_qd_tu)} – ${dinhDangNgayLich(dot.ngay_qd_den)}`
      : CHUA_CO;
  return (
    <Paper component="li" withBorder radius="md" p="md" style={{ listStyle: 'none' }}>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
          <Group gap="xs" wrap="wrap" style={{ minWidth: 0 }}>
            <Badge color={dot.chuong_trinh === 'nls' ? 'primary' : 'accent'} radius="sm">
              {dot.chuong_trinh.toUpperCase()}
            </Badge>
            <Text fw={600}>{dot.ten}</Text>
          </Group>
          <Button size="xs" variant="default" aria-label={`Sửa đợt ${dot.ten}`} onClick={onSua}>
            Sửa
          </Button>
        </Group>
        <DongThongTin nhan="Sở GD&ĐT" giaTri={dot.so_gddt.ten_don_vi} />
        <DongThongTin nhan="Đơn giá" giaTri={dot.don_gia === null ? CHUA_CO : dinhDangTien(dot.don_gia)} />
        <DongThongTin nhan="QĐ chỉ định thầu" giaTri={khoangQd} />
        <DongThongTin nhan="Hạn nộp" giaTri={dinhDangNgayLich(dot.han_nop_ngay)} />
      </Stack>
    </Paper>
  );
}

/** Quản trị tạo/sửa đợt triển khai trên Cổng đơn vị (issue #56, ADR 0015 M1).
 * Route bọc ChiQuanTriCong: vai trò khác → 404. */
export default function QuanTriDotTrienKhai() {
  const { data, isLoading, isError, error } = useDanhSachDotTrienKhai();
  const [moForm, setMoForm] = useState(false);
  const [dangSua, setDangSua] = useState<DotTrienKhai | null>(null);

  function mo(dot: DotTrienKhai | null) {
    setDangSua(dot);
    setMoForm(true);
  }

  return (
    <Container size="md" py="lg">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Title order={1} size="h3">
            Chương trình / Đợt
          </Title>
          <Button onClick={() => mo(null)}>Tạo đợt</Button>
        </Group>
        {isLoading && <Skeleton height={120} radius="md" />}
        {isError && <Alert color="red">{thongDiepLoiXungDot(error)}</Alert>}
        {data && data.length === 0 && <Text c="dimmed">Chưa có đợt nào.</Text>}
        {data && data.length > 0 && (
          <Stack component="ul" gap="sm" p={0} m={0} aria-label="Danh sách đợt triển khai">
            {data.map((d) => (
              <TheDot key={d.id} dot={d} onSua={() => mo(d)} />
            ))}
          </Stack>
        )}
      </Stack>
      <ModalDotTrienKhai opened={moForm} onClose={() => setMoForm(false)} dot={dangSua} />
    </Container>
  );
}
