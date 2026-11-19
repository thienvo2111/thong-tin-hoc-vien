import { useState } from 'react';
import { Alert, Button, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useDanhSachThamGia, type TongHopTruong } from '@/api/danhSachThamGia';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { NHAN_GIAI_DOAN, dinhDangSuat } from './danhSachThamGiaNhan';

/** Danh sách tham gia của đợt: tổng hợp theo trường, chọn 1 trường để xem từng người (issue #58). */
export function DanhSachTheoTruong({ dotId }: { dotId: string }) {
  const { data, isLoading, isError, error } = useDanhSachThamGia(dotId);
  const [truong, setTruong] = useState<TongHopTruong | null>(null);
  const dongCuaTruong = truong ? (data?.dong ?? []).filter((d) => d.don_vi_id === truong.don_vi_id) : [];
  const tongNguoi = data?.tong_hop.reduce((t, x) => t + x.so_nguoi, 0) ?? 0;
  const tongSuat = data?.tong_hop.reduce((t, x) => t + x.tong_suat, 0) ?? 0;

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={2} size="h4">
          Danh sách theo trường
        </Title>
        {isLoading && <Skeleton height={80} radius="md" />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.tong_hop.length === 0 && <Text c="dimmed">Chưa có danh sách cho đợt này.</Text>}
        {data && data.tong_hop.length > 0 && (
          <>
            <Text fz="sm">
              {data.tong_hop.length} trường, {tongNguoi} người, tổng {dinhDangSuat(tongSuat)} suất.
            </Text>
            <Table.ScrollContainer minWidth={560}>
              <Table striped withTableBorder fz="sm" aria-label="Tổng hợp theo trường">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Trường</Table.Th>
                    <Table.Th>Mã</Table.Th>
                    <Table.Th ta="right">Số người</Table.Th>
                    <Table.Th ta="right">Tổng suất</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.tong_hop.map((t) => (
                    <Table.Tr key={t.don_vi_id}>
                      <Table.Td>{t.ten_don_vi}</Table.Td>
                      <Table.Td>{t.ma_don_vi}</Table.Td>
                      <Table.Td ta="right">{t.so_nguoi}</Table.Td>
                      <Table.Td ta="right">{dinhDangSuat(t.tong_suat)}</Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant={truong?.don_vi_id === t.don_vi_id ? 'filled' : 'default'}
                          aria-label={`Xem danh sách ${t.ten_don_vi}`}
                          onClick={() => setTruong(t)}
                        >
                          Xem
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </>
        )}
        {truong && (
          <Stack gap="xs">
            <Title order={3} size="h5">
              {truong.ten_don_vi}
            </Title>
            <Table.ScrollContainer minWidth={720}>
              <Table striped withTableBorder fz="sm" aria-label={`Danh sách ${truong.ten_don_vi}`}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Họ tên</Table.Th>
                    <Table.Th>Ngày sinh</Table.Th>
                    <Table.Th>Giới tính</Table.Th>
                    <Table.Th>Lớp</Table.Th>
                    <Table.Th>Giai đoạn</Table.Th>
                    <Table.Th ta="right">Suất</Table.Th>
                    <Table.Th>Ghi chú</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dongCuaTruong.map((d) => (
                    <Table.Tr key={d.id}>
                      <Table.Td>{d.ho_ten}</Table.Td>
                      <Table.Td>{d.ngay_sinh ? dinhDangNgayLich(d.ngay_sinh) : ''}</Table.Td>
                      <Table.Td>{d.gioi_tinh}</Table.Td>
                      <Table.Td>{d.lop}</Table.Td>
                      <Table.Td>{NHAN_GIAI_DOAN[d.giai_doan]}</Table.Td>
                      <Table.Td ta="right">{dinhDangSuat(d.ty_le_suat)}</Table.Td>
                      <Table.Td>{d.ghi_chu}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
