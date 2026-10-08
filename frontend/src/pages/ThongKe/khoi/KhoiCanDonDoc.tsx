import { useEffect, useState } from 'react';
import { Button, Group, Pagination, Table, Tabs, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCanDonDoc, xuatCanDonDoc, type LoaiCanDonDoc, type LocThongKe } from '@/api/thongKe';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { KhoiThongKe } from '../KhoiThongKe';

const CO_TRANG = 20;

const LOAI: { value: LoaiCanDonDoc; label: string }[] = [
  { value: 'chua_truy_cap', label: 'Chưa truy cập' },
  { value: 'chua_ky_nang_so', label: 'Chưa làm KS kĩ năng số' },
  { value: 'chua_khao_sat', label: 'Chưa làm đánh giá NLS' },
  { value: 'vang_nhieu', label: 'Vắng nhiều' },
  { value: 'vle_thap', label: 'VLE thấp' },
];

export function KhoiCanDonDoc({ loc }: { loc: LocThongKe }) {
  const [loai, setLoai] = useState<LoaiCanDonDoc>('chua_truy_cap');
  const [page, setPage] = useState(1);
  const [dangXuat, setDangXuat] = useState(false);
  const query = useCanDonDoc({ ...loc, loai, page });
  const d = query.data;

  // Đổi bộ lọc → về trang 1 (tổng số trang có thể đã khác).
  useEffect(() => setPage(1), [loc.khoa_id, loc.don_vi_id, loc.cum_id, loc.doi_tuong]);

  async function xuatExcel() {
    setDangXuat(true);
    try {
      await xuatCanDonDoc({ ...loc, loai });
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  return (
    <KhoiThongKe
      tieu_de="Cần đôn đốc"
      query={query}
      rong={d?.tong === 0}
      thong_bao_rong="Không có học viên cần đôn đốc"
      dieu_khien={
        <Group justify="space-between" align="flex-end">
          <Tabs
            value={loai}
            onChange={(v) => {
              setLoai(v as LoaiCanDonDoc);
              setPage(1);
            }}
          >
            <Tabs.List>
              {LOAI.map((l) => (
                <Tabs.Tab key={l.value} value={l.value}>
                  {l.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          <Button size="xs" variant="light" loading={dangXuat} onClick={() => void xuatExcel()}>
            Xuất Excel
          </Button>
        </Group>
      }
    >
      {d && (
        <>
          <Table.ScrollContainer minWidth={640}>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Họ tên</Table.Th>
                  <Table.Th>Đơn vị</Table.Th>
                  <Table.Th>Khóa</Table.Th>
                  <Table.Th>Số điện thoại</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Chi tiết</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {d.items.map((r) => (
                  <Table.Tr key={`${r.hoc_vien_id}-${r.ten_khoa}`}>
                    <Table.Td>{r.ho_ten}</Table.Td>
                    <Table.Td>{r.ten_don_vi}</Table.Td>
                    <Table.Td>{r.ten_khoa}</Table.Td>
                    <Table.Td>{r.so_dien_thoai ?? '—'}</Table.Td>
                    <Table.Td>{r.email ?? '—'}</Table.Td>
                    <Table.Td>{r.chi_tiet || '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group justify="space-between" mt="sm">
            <Text size="xs" c="dimmed">
              Tổng {d.tong} học viên
            </Text>
            {d.tong > CO_TRANG && (
              <Pagination size="sm" value={page} onChange={setPage} total={Math.ceil(d.tong / CO_TRANG)} />
            )}
          </Group>
        </>
      )}
    </KhoiThongKe>
  );
}
