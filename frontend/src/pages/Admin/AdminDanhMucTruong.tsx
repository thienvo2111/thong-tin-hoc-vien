import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Container, Group, Modal, Pagination, Paper, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { layDonViCongTacPhanTrang, useSuaDiaBanDonViCongTac } from '@/api/danhMuc';
import type { DonViCongTac } from '@/api/types';
import { SelectDiaDanh } from '@/components/SelectDiaDanh';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

/** Trang quản trị "Danh mục trường" (2026-10-01) — sau khi remap hàng loạt don_vi_cong_tac theo bộ
 * mã hành chính mới (T19), 119 trường khớp sai/không khớp tên phường-xã cần sửa tay dia_ban_id qua
 * giao diện (scripts/_report_remap_truong.md) — KHÔNG import lại Excel. Chỉ sửa dia_ban_id (PATCH
 * đã có sẵn, UpdateDonViCongTacDto nhận thẳng field này). */
export default function AdminDanhMucTruong() {
  const [tinhId, setTinhId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);

  const [dangSua, setDangSua] = useState<DonViCongTac | null>(null);
  const [tinhModal, setTinhModal] = useState<string | null>(null);
  const [phuongXaModal, setPhuongXaModal] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      loai_don_vi: 'truong',
      tinh_id: tinhId ?? undefined,
      q: qDebounced.trim() || undefined,
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [tinhId, qDebounced, page],
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'phan-trang', params],
    queryFn: () => layDonViCongTacPhanTrang(params),
    placeholderData: keepPreviousData,
  });

  const suaDiaBan = useSuaDiaBanDonViCongTac();

  function datBoLoc<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function moModalSua(truong: DonViCongTac) {
    setDangSua(truong);
    setTinhModal(truong.tinh_id);
    setPhuongXaModal(truong.dia_ban_id);
  }

  function dongModal() {
    setDangSua(null);
    setTinhModal(null);
    setPhuongXaModal(null);
  }

  function xuLyLuu() {
    if (!dangSua || !phuongXaModal) return;
    suaDiaBan.mutate(
      { id: dangSua.id, diaBanId: phuongXaModal },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã cập nhật địa bàn cho "${dangSua.ten_don_vi}"` });
          dongModal();
        },
        onError: (err) => {
          notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
        },
      },
    );
  }

  const luuHopLe = !!tinhModal && !!phuongXaModal;
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <AdminPageHeader title="Danh mục trường" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <SelectDiaDanh
              label="Tỉnh/thành"
              cap="tinh_thanh"
              phienBan="hien_tai"
              value={tinhId}
              onChange={datBoLoc(setTinhId)}
            />
            <TextInput
              label="Tìm theo tên trường"
              placeholder="Nhập tên trường..."
              value={q}
              onChange={(e) => datBoLoc(setQ)(e.currentTarget.value)}
              w={280}
            />
            <Text fz={12.5} c="dimmed" ml="auto" mt="auto">
              {data ? `${data.total.toLocaleString('vi-VN')} trường` : ''}
            </Text>
          </Group>

          <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
            {isLoading && (
              <Stack p="md" gap="sm">
                {Array.from({ length: 6 }).map((_, i) => (
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
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tên trường</Table.Th>
                    <Table.Th>Mã đơn vị</Table.Th>
                    <Table.Th>Tỉnh</Table.Th>
                    <Table.Th>Phường/xã hiện tại</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="lg">
                          Không có trường nào khớp bộ lọc.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {data.data.map((truong) => (
                    <Table.Tr key={truong.id}>
                      <Table.Td fw={600}>{truong.ten_don_vi}</Table.Td>
                      <Table.Td>{truong.ma_don_vi ?? '—'}</Table.Td>
                      <Table.Td>{truong.tinh_ten ?? '—'}</Table.Td>
                      <Table.Td>{truong.dia_ban_ten}</Table.Td>
                      <Table.Td ta="right">
                        <Button size="xs" variant="default" onClick={() => moModalSua(truong)}>
                          Sửa địa bàn
                        </Button>
                      </Table.Td>
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
      </Container>

      <Modal opened={dangSua !== null} onClose={dongModal} title="Sửa địa bàn trường" centered>
        <Stack gap="sm">
          {dangSua && (
            <Text fz={13.5} c="dimmed">
              Trường: <b>{dangSua.ten_don_vi}</b>
            </Text>
          )}
          <SelectDiaDanh
            label="Tỉnh/thành"
            cap="tinh_thanh"
            phienBan="hien_tai"
            value={tinhModal}
            onChange={(id) => {
              setTinhModal(id);
              setPhuongXaModal(null);
            }}
            required
          />
          <SelectDiaDanh
            label="Phường/xã"
            cap="phuong_xa_dac_khu"
            phienBan="hien_tai"
            parentId={tinhModal}
            value={phuongXaModal}
            onChange={setPhuongXaModal}
            required
          />
          <Button mt="sm" loading={suaDiaBan.isPending} disabled={!luuHopLe} onClick={xuLyLuu} fullWidth>
            Lưu
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
