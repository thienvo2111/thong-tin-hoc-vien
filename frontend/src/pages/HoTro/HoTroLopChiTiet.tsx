import { Link, useParams } from 'react-router-dom';
import { Alert, Anchor, Button, Container, Group, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useHocVienCuaLop } from '@/api/hoTro';
import { ApiError } from '@/api/client';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { NHAN_LOAI_LOP, useXuatDanhSachLop } from './HoTroLop';

/** Danh sách học viên của 1 lớp được gắn (ADR 0008) — học viên theo lớp gốc, không tính đổi buổi. */
export default function HoTroLopChiTiet() {
  const { lopId } = useParams<{ lopId: string }>();
  const { data, isLoading, isError, error } = useHocVienCuaLop(lopId);
  const { dangXuat, xuat } = useXuatDanhSachLop();
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Anchor component={Link} to="/ho-tro/lop" fz="sm">
          ← Lớp hỗ trợ
        </Anchor>
        {isLoading && <Skeleton height={160} />}
        {isError &&
          (khongThay ? (
            <Alert color="yellow" variant="light" title="Không tìm thấy lớp">
              Lớp không tồn tại hoặc Thầy/Cô không được gắn hỗ trợ lớp này.
            </Alert>
          ) : (
            <Alert color="red">{thongDiepLoiChung(error)}</Alert>
          ))}
        {data && (
          <>
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Text fz="sm" c="dimmed">
                  {data.lop.khoa.ma_khoa} · {data.lop.khoa.ten_khoa}
                </Text>
                <Title order={3}>
                  {NHAN_LOAI_LOP[data.lop.loai_lop]} · {data.lop.ten_lop}
                </Title>
                <Text fz="sm">{data.hoc_vien.length.toLocaleString('vi-VN')} học viên</Text>
              </Stack>
              <Button variant="default" onClick={() => xuat(data.lop.lop_id)} loading={dangXuat === data.lop.lop_id}>
                Xuất Excel lớp này
              </Button>
            </Group>
            <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
              <Table.ScrollContainer minWidth={900}>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Họ tên</Table.Th>
                      <Table.Th>Ngày sinh</Table.Th>
                      <Table.Th>Đơn vị</Table.Th>
                      <Table.Th>Số điện thoại</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Cụm</Table.Th>
                      <Table.Th>Giai đoạn</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.hoc_vien.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text c="dimmed" ta="center" py="lg">
                            Lớp chưa có học viên nào.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {data.hoc_vien.map((h) => (
                      <Table.Tr key={h.hoc_vien_id}>
                        <Table.Td>
                          <Anchor component={Link} to={`/ho-tro/hoc-vien/${h.hoc_vien_id}`} fw={600} fz="sm">
                            {h.ho_ten}
                          </Anchor>
                        </Table.Td>
                        <Table.Td>{h.ngay_sinh}</Table.Td>
                        <Table.Td>{h.don_vi_cong_tac_ten}</Table.Td>
                        <Table.Td>{h.so_dien_thoai_lien_he ?? '—'}</Table.Td>
                        <Table.Td>{h.email_lien_he ?? '—'}</Table.Td>
                        <Table.Td>{h.cum ?? '—'}</Table.Td>
                        <Table.Td>{h.giai_doan.join(', ') || '—'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
