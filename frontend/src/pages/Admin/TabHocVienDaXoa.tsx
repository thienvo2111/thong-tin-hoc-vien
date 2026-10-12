import { useState } from 'react';
import { Alert, Group, Pagination, Paper, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useDanhSachHocVienDaXoa } from '@/api/admin';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { dinhDangNgayGio } from '@/lib/ngay';

const KICH_THUOC_TRANG = 20;
const SO_COT = 8;

/** Issue #32: tab "Đã xóa" — nhật ký học viên bị Quản trị xóa cứng (GET /hoc-vien/da-xoa), chỉ đọc:
 * không xuất Excel, không sửa/xóa nhật ký. */
export function TabHocVienDaXoa() {
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useDanhSachHocVienDaXoa({
    q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
    page,
    page_size: KICH_THUOC_TRANG,
  });
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Tìm theo họ tên, mã MOET..."
          aria-label="Tìm học viên đã xóa"
          value={q}
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setPage(1);
          }}
          w={280}
        />
        <Text fz={12.5} c="dimmed" ml="auto">
          {data ? `${data.total.toLocaleString('vi-VN')} học viên đã xóa` : ''}
        </Text>
      </Group>

      <Paper withBorder radius={14} style={{ overflowX: 'auto' }}>
        {isLoading && (
          <Stack p="md" gap="sm">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={36} />
            ))}
          </Stack>
        )}

        {isError && (
          <Alert color="red" m="md">
            {thongDiepLoiChung(error)}
          </Alert>
        )}

        {data && (
          <Table verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Họ và tên</Table.Th>
                <Table.Th>Mã MOET</Table.Th>
                <Table.Th>Trường</Table.Th>
                <Table.Th>Số ghi danh đã xóa</Table.Th>
                <Table.Th>Tài khoản VLE</Table.Th>
                <Table.Th>Lý do</Table.Th>
                <Table.Th>Người xóa</Table.Th>
                <Table.Th>Thời điểm</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={SO_COT}>
                    <Text c="dimmed" ta="center" py="lg">
                      {qDebounced.trim()
                        ? 'Không có học viên đã xóa nào khớp tìm kiếm.'
                        : 'Chưa có học viên nào bị xóa.'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {data.data.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td fw={600}>{r.ho_ten}</Table.Td>
                  <Table.Td>{r.ma_dinh_danh_moet ?? '—'}</Table.Td>
                  <Table.Td>{r.ten_don_vi}</Table.Td>
                  <Table.Td>{r.so_dang_ky_da_xoa}</Table.Td>
                  <Table.Td>{r.ten_dang_nhap_vle ?? '—'}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'pre-wrap' }}>{r.ly_do}</Table.Td>
                  <Table.Td>
                    {r.nguoi_xoa.ho_ten}
                    <Text fz={12} c="dimmed">
                      {r.nguoi_xoa.ten_dang_nhap}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(r.thoi_gian)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {data && data.total > 0 && (
        <Group justify="space-between">
          <Text fz={12.5} c="dimmed">
            Trang {data.page} / {tongSoTrang} — {data.total.toLocaleString('vi-VN')} kết quả
          </Text>
          <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
        </Group>
      )}
    </Stack>
  );
}
