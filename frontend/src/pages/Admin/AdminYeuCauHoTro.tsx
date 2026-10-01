import { useState } from 'react';
import { Alert, Badge, Button, Container, Group, Paper, Skeleton, Stack, Table, Text, Textarea } from '@mantine/core';
import { useDanhSachYeuCauHoTroQuanTri, useTraLoiYeuCauHoTro } from '@/api/yeuCauHoTro';
import type { YeuCauHoTroQuanTri } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { AdminPageHeader } from './AdminPageHeader';

/** Trang quản trị "Yêu cầu hỗ trợ" (M8) — quan_tri xử lý ticket đang chờ, trả lời 1 lần (bảng phẳng,
 * không thread nhiều lượt — xem yeu-cau-ho-tro.service.ts#traLoi). Panel đếm tương ứng ở AdminTongQuan. */
export default function AdminYeuCauHoTroPage() {
  const { data, isLoading, isError, error } = useDanhSachYeuCauHoTroQuanTri({ trang_thai: 'cho_xu_ly' });
  const [dangTraLoiId, setDangTraLoiId] = useState<string | null>(null);

  return (
    <>
      <AdminPageHeader title="Yêu cầu hỗ trợ" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
          {isLoading && (
            <Stack p="md" gap="sm">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </Stack>
          )}

          {isError && (
            <Alert color="red" m="md">
              {thongDiepLoiChung(error)}
            </Alert>
          )}

          {data && data.data.length === 0 && (
            <Text c="dimmed" ta="center" py="lg">
              Không có yêu cầu hỗ trợ nào đang chờ xử lý.
            </Text>
          )}

          {data && data.data.length > 0 && (
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Loại vấn đề</Table.Th>
                  <Table.Th>Nội dung</Table.Th>
                  <Table.Th>Hỏi lại?</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.data.map((yc) => (
                  <DongTicket
                    key={yc.id}
                    yeuCau={yc}
                    dangTraLoi={dangTraLoiId === yc.id}
                    onBatDauTraLoi={() => setDangTraLoiId(yc.id)}
                    onHuy={() => setDangTraLoiId(null)}
                    onDaTraLoi={() => setDangTraLoiId(null)}
                  />
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Container>
    </>
  );
}

function DongTicket({
  yeuCau,
  dangTraLoi,
  onBatDauTraLoi,
  onHuy,
  onDaTraLoi,
}: {
  yeuCau: YeuCauHoTroQuanTri;
  dangTraLoi: boolean;
  onBatDauTraLoi: () => void;
  onHuy: () => void;
  onDaTraLoi: () => void;
}) {
  const [noiDung, setNoiDung] = useState('');
  const traLoi = useTraLoiYeuCauHoTro();

  function guiTraLoi() {
    traLoi.mutate({ id: yeuCau.id, noi_dung_tra_loi: noiDung }, { onSuccess: onDaTraLoi });
  }

  return (
    <Table.Tr>
      <Table.Td>{yeuCau.loai_van_de_ten}</Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Text size="sm">{yeuCau.noi_dung_hoi}</Text>
          {dangTraLoi && (
            <Stack gap={6}>
              <Textarea
                aria-label="Nội dung trả lời"
                minRows={2}
                value={noiDung}
                onChange={(e) => setNoiDung(e.currentTarget.value)}
              />
              <Group gap="xs">
                <Button size="xs" onClick={guiTraLoi} loading={traLoi.isPending}>
                  Gửi trả lời
                </Button>
                <Button size="xs" variant="subtle" onClick={onHuy}>
                  Hủy
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>{yeuCau.hoi_lai && <Badge color="red">Có</Badge>}</Table.Td>
      <Table.Td>
        {!dangTraLoi && (
          <Button size="xs" variant="light" onClick={onBatDauTraLoi}>
            Trả lời
          </Button>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
