import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Container, Select, Skeleton, Stack, Title } from '@mantine/core';
import { useDanhSachDotTrienKhai } from '@/api/dotTrienKhai';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { DanhSachTheoTruong } from './DanhSachTheoTruong';
import { HangDoiDeNghi } from './HangDoiDeNghi';
import { LayDanhSachTuKhoa } from './LayDanhSachTuKhoa';
import { NapDanhSachHsg } from './NapDanhSachHsg';

/** Quản trị: Danh sách tham gia theo đợt (issue #58, ADR 0015 M3/M6/T7). Nạp Excel chỉ cho đợt HSG;
 * xem danh sách cho mọi đợt. Route bọc ChiQuanTriCong: vai trò khác → 404.
 * Issue #62: mục "Đề nghị của trường" — hàng đợi Áp dụng / Từ chối đề nghị sửa/thêm/bớt người. */
export default function QuanTriDanhSachThamGia() {
  const { data, isLoading, isError, error } = useDanhSachDotTrienKhai();
  // Issue #65: mở từ bảng Tiến độ đợt với ?dot=…&don_vi_id=… → chọn sẵn đợt và trường.
  const [params] = useSearchParams();
  const [dotId, setDotId] = useState<string | null>(params.get('dot'));
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
        {dot?.chuong_trinh === 'nls' && <LayDanhSachTuKhoa key={dot.id} dot={dot} />}
        {dot && <HangDoiDeNghi key={`de-nghi-${dot.id}`} dotId={dot.id} />}
        {dot && (
          <DanhSachTheoTruong
            key={dot.id}
            dotId={dot.id}
            choThem={dot.chuong_trinh === 'hsg'}
            donViIdBanDau={dot.id === params.get('dot') ? params.get('don_vi_id') : null}
          />
        )}
      </Stack>
    </Container>
  );
}
