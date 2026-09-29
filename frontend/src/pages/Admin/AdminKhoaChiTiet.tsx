import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useChiTietKhoa, useDonViChoKhoa, useDuyetKhoa, useNopDuyetKhoa } from '@/api/khoaBoiDuong';
import { useToi } from '@/auth/AuthContext';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay } from '@/lib/ngay';
import { KhoaTrangThaiBadge } from '@/components/KhoaTrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

const VAI_TRO_NOP_DUYET = ['truong', 'quan_tri'];
const VAI_TRO_DUYET = ['phong_vhxh', 'so_gddt', 'quan_tri'];

/** Chi tiết khóa bồi dưỡng (quản trị) — Phase 4 redesign. Nút hành động hiện theo trang_thai + vai_tro
 * đúng bảng "Ai gọi" của docs/api-contract.md mục 3 (POST .../nop-duyet: Trường chủ khóa + QuảnTrị;
 * POST .../duyet: Phòng VHXH/Sở/QuảnTrị) — FE chỉ lọc theo vai_tro, quyền phạm vi thật (chủ khóa/scope
 * cây đơn vị) do backend chặn (403) nếu tài khoản không đúng đơn vị, không tự đoán ở FE. Tab Giai đoạn/
 * Đơn vị theo dõi để "Sắp hoàn thiện" — ưu tiên tab Lớp học hoạt động đúng trước (yêu cầu công việc). */
export default function AdminKhoaChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useToi();
  const { data: khoa, isLoading, isError, error } = useChiTietKhoa(id);
  const donVi = useDonViChoKhoa();
  const donViMap = new Map((donVi.data ?? []).map((d) => [d.id, d.ten_don_vi]));

  const [modalTuChoi, setModalTuChoi] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState('');

  const nopDuyet = useNopDuyetKhoa(id ?? '');
  const duyet = useDuyetKhoa(id ?? '');

  function xuLyNopDuyet() {
    nopDuyet.mutate(undefined, {
      onSuccess: () => notifications.show({ color: 'green', message: 'Đã nộp duyệt khóa bồi dưỡng' }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
    });
  }

  function xuLyDuyet() {
    duyet.mutate(
      { ket_qua: 'da_duyet' },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã duyệt khóa bồi dưỡng' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  function xuLyTuChoi() {
    duyet.mutate(
      { ket_qua: 'tu_choi', ly_do: lyDoTuChoi || undefined },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã từ chối khóa bồi dưỡng' });
          setModalTuChoi(false);
          setLyDoTuChoi('');
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <>
      <AdminPageHeader title="Chi tiết khóa bồi dưỡng" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        {isLoading && (
          <Stack gap="sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={24} />
            ))}
          </Stack>
        )}

        {isError && (
          <Alert color="red">{thongDiepLoiChung(error)}</Alert>
        )}

        {khoa && (
          <Stack gap="lg">
            <Breadcrumbs fz={12.5}>
              <Anchor component={Link} to="/admin/khoa-boi-duong" fz={12.5} c="dimmed">
                Khóa bồi dưỡng
              </Anchor>
              <Text fz={12.5} c="dimmed">
                {khoa.ma_khoa}
              </Text>
            </Breadcrumbs>

            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Box>
                <Group gap="sm" mb={6}>
                  <Title order={1} size="h3">
                    {khoa.ten_khoa}
                  </Title>
                  <KhoaTrangThaiBadge trangThai={khoa.trang_thai} />
                </Group>
                <Text fz={13} c="dimmed">
                  Mã khóa <b>{khoa.ma_khoa}</b> · {donViMap.get(khoa.don_vi_to_chuc_id) ?? '—'} ·{' '}
                  {dinhDangNgay(khoa.thoi_gian_bat_dau)} – {dinhDangNgay(khoa.thoi_gian_ket_thuc)} ·{' '}
                  {khoa.lop_hoc.length} lớp học
                </Text>
              </Box>

              <Group gap="sm">
                {VAI_TRO_NOP_DUYET.includes(nguoiDung?.vai_tro ?? '') && ['nhap', 'tu_choi'].includes(khoa.trang_thai) && (
                  <Button variant="default" loading={nopDuyet.isPending} onClick={xuLyNopDuyet}>
                    Nộp duyệt
                  </Button>
                )}
                {VAI_TRO_DUYET.includes(nguoiDung?.vai_tro ?? '') && khoa.trang_thai === 'cho_duyet' && (
                  <>
                    <Button variant="default" color="red" onClick={() => setModalTuChoi(true)}>
                      Từ chối
                    </Button>
                    <Button loading={duyet.isPending} onClick={xuLyDuyet}>
                      ✓ Duyệt khóa
                    </Button>
                  </>
                )}
              </Group>
            </Group>

            <Tabs defaultValue="lop-hoc">
              <Tabs.List>
                <Tabs.Tab value="lop-hoc">Lớp học</Tabs.Tab>
                <Tabs.Tab value="giai-doan">Giai đoạn</Tabs.Tab>
                <Tabs.Tab value="don-vi-theo-doi">Đơn vị theo dõi</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="lop-hoc" pt="md">
                <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
                  <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Tên lớp</Table.Th>
                        <Table.Th>Sĩ số tối đa</Table.Th>
                        <Table.Th>Giảng viên / nhân sự</Table.Th>
                        <Table.Th>Số buổi đã lên lịch</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {khoa.lop_hoc.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Text c="dimmed" ta="center" py="lg">
                              Khóa chưa có lớp học nào.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                      {khoa.lop_hoc.map((lop) => (
                        <Table.Tr key={lop.id}>
                          <Table.Td fw={600}>{lop.ten_lop}</Table.Td>
                          <Table.Td>{lop.si_so_toi_da ?? '—'}</Table.Td>
                          <Table.Td>
                            {lop.nhan_su && lop.nhan_su.length > 0
                              ? lop.nhan_su.map((n) => n.ho_ten).join(', ')
                              : '—'}
                          </Table.Td>
                          <Table.Td>{lop.lich_hoc?.length ?? 0}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Tabs.Panel>

              <Tabs.Panel value="giai-doan" pt="md">
                <Text c="dimmed" ta="center" py="xl">
                  Sắp hoàn thiện.
                </Text>
              </Tabs.Panel>

              <Tabs.Panel value="don-vi-theo-doi" pt="md">
                <Text c="dimmed" ta="center" py="xl">
                  Sắp hoàn thiện.
                </Text>
              </Tabs.Panel>
            </Tabs>
          </Stack>
        )}
      </Container>

      <Modal opened={modalTuChoi} onClose={() => setModalTuChoi(false)} title="Từ chối khóa bồi dưỡng" centered>
        <Stack gap="sm">
          <Textarea
            label="Lý do từ chối"
            value={lyDoTuChoi}
            onChange={(e) => setLyDoTuChoi(e.currentTarget.value)}
            minRows={3}
          />
          <Button color="red" loading={duyet.isPending} onClick={xuLyTuChoi} fullWidth>
            Xác nhận từ chối
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
