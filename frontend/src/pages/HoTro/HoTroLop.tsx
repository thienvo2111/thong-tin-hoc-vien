import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Container, Group, Paper, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLopCuaToi, xuatDanhSachLopHoTro } from '@/api/hoTro';
import type { LoaiLop } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { NHAN_MUC_NANG_LUC } from '@/lib/mucNangLuc';
import { taiFileTuBlob } from '@/lib/taiFile';

export const NHAN_LOAI_LOP: Record<LoaiLop, string> = {
  truc_tiep: 'Trực tiếp',
  zoom: 'Zoom',
  vle: 'VLE',
};

/** Tải file Excel danh sách lớp (1 lớp hoặc mọi lớp của tôi). `dangXuat` = khóa xuất đang chạy ('tat-ca' | lopId). */
export function useXuatDanhSachLop() {
  const [dangXuat, setDangXuat] = useState<string | null>(null);
  async function xuat(lopId?: string) {
    setDangXuat(lopId ?? 'tat-ca');
    try {
      const blob = await xuatDanhSachLopHoTro(lopId);
      const ngay = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      taiFileTuBlob(blob, `ds-lop-ho-tro-${ngay}.xlsx`);
    } catch (err) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    } finally {
      setDangXuat(null);
    }
  }
  return { dangXuat, xuat };
}

/** Lớp người hỗ trợ được Quản trị gắn (ADR 0008) — tách khỏi "Cụm của tôi". */
export default function HoTroLop() {
  const { data, isLoading, isError, error } = useLopCuaToi();
  const { dangXuat, xuat } = useXuatDanhSachLop();

  return (
    <Container size="lg" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Lớp hỗ trợ</Title>
          {data && data.length > 0 && (
            <Button variant="default" onClick={() => xuat()} loading={dangXuat === 'tat-ca'}>
              Xuất tất cả lớp
            </Button>
          )}
        </Group>
        {isLoading && <Skeleton height={120} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Alert color="yellow" variant="light">
            Thầy/Cô chưa được gắn hỗ trợ lớp nào. Liên hệ Quản trị để được phân công.
          </Alert>
        )}
        {data && data.length > 0 && (
          <>
            <Text fz="sm" c="dimmed">
              File Excel lớp có ngày sinh học viên (cũng là mật khẩu mặc định) — chỉ dùng để hỗ trợ, không chuyển tiếp.
            </Text>
            <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
              <Table.ScrollContainer minWidth={720}>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Khóa</Table.Th>
                      <Table.Th>Loại lớp</Table.Th>
                      <Table.Th>Tên lớp</Table.Th>
                      <Table.Th>Mức</Table.Th>
                      <Table.Th>Sĩ số</Table.Th>
                      <Table.Th aria-label="Thao tác" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.map((l) => (
                      <Table.Tr key={l.lop_id}>
                        <Table.Td>
                          <Text fz="sm" fw={600}>
                            {l.khoa.ma_khoa}
                          </Text>
                          <Text fz="xs" c="dimmed">
                            {l.khoa.ten_khoa}
                          </Text>
                        </Table.Td>
                        <Table.Td>{NHAN_LOAI_LOP[l.loai_lop]}</Table.Td>
                        <Table.Td fw={600}>{l.ten_lop}</Table.Td>
                        <Table.Td>{l.muc_nang_luc ? NHAN_MUC_NANG_LUC[l.muc_nang_luc] : '—'}</Table.Td>
                        <Table.Td>{l.so_hoc_vien.toLocaleString('vi-VN')}</Table.Td>
                        <Table.Td>
                          <Group gap={6} justify="flex-end" wrap="nowrap">
                            <Button component={Link} to={`/ho-tro/lop/${l.lop_id}`} size="xs" variant="light">
                              Xem danh sách
                            </Button>
                            <Button
                              size="xs"
                              variant="default"
                              onClick={() => xuat(l.lop_id)}
                              loading={dangXuat === l.lop_id}
                              aria-label={`Xuất Excel lớp ${l.ten_lop}`}
                            >
                              Xuất Excel
                            </Button>
                          </Group>
                        </Table.Td>
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
