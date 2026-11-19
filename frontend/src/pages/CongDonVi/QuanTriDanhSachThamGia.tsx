import { useState } from 'react';
import { Alert, Container, Select, Skeleton, Stack, Title } from '@mantine/core';
import { useDanhSachDotTrienKhai } from '@/api/dotTrienKhai';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { DanhSachTheoTruong } from './DanhSachTheoTruong';
import { NapDanhSachHsg } from './NapDanhSachHsg';

/** Quản trị: Danh sách tham gia theo đợt (issue #58, ADR 0015 M3/M6/T7). Nạp Excel chỉ cho đợt HSG;
 * xem danh sách cho mọi đợt. Route bọc ChiQuanTriCong: vai trò khác → 404. */
export default function QuanTriDanhSachThamGia() {
  const { data, isLoading, isError, error } = useDanhSachDotTrienKhai();
  const [dotId, setDotId] = useState<string | null>(null);
  const dot = data?.find((d) => d.id === dotId) ?? null;

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Title order={1} size="h3">
          Danh sách tham gia
        </Title>
        {isLoading && <Skeleton height={56} radius="md" />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && (
          <Select
            label="Đợt triển khai"
            placeholder={data.length === 0 ? 'Chưa có đợt nào' : 'Chọn đợt'}
            data={data.map((d) => ({ value: d.id, label: `${d.chuong_trinh.toUpperCase()} – ${d.ten}` }))}
            value={dotId}
            onChange={setDotId}
            searchable
            maw={520}
          />
        )}
        {dot?.chuong_trinh === 'hsg' && <NapDanhSachHsg key={dot.id} dotId={dot.id} />}
        {dot?.chuong_trinh === 'nls' && (
          <Alert color="blue">Đợt NLS lấy danh sách từ khóa — chức năng này sẽ có ở bước sau.</Alert>
        )}
        {dot && <DanhSachTheoTruong key={dot.id} dotId={dot.id} />}
      </Stack>
    </Container>
  );
}
