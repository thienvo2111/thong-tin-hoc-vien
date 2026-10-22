import { Alert, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useLichSuCauHinhKhoa } from '@/api/khoaBoiDuong';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

/** ADR 0014 (bổ sung nhật ký): mọi lần sửa cấu hình khóa — ai, lúc nào, giá trị cũ → mới. Chỉ quan_tri. */
export function LichSuCauHinhKhoa({ khoaId }: { khoaId: string }) {
  const { data, isLoading, error } = useLichSuCauHinhKhoa(khoaId);

  if (isLoading) return <Skeleton height={120} />;
  if (error) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  if (!data || data.length === 0) {
    return <Text c="dimmed">Chưa có lần cập nhật cấu hình nào được ghi nhận.</Text>;
  }

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped withTableBorder verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Thời gian</Table.Th>
            <Table.Th>Người thực hiện</Table.Th>
            <Table.Th>Thay đổi</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{dinhDangNgayGio(m.thoi_gian)}</Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>{m.nguoi_thuc_hien ?? '—'}</Table.Td>
              <Table.Td>
                <Stack gap={4}>
                  {m.thay_doi.map((t) => (
                    <Text key={t.truong} size="sm">
                      <Text span fw={500}>
                        {t.nhan}:
                      </Text>{' '}
                      {t.truoc_hien_thi} → {t.sau_hien_thi}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
