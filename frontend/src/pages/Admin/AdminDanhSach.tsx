import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Container,
  Group,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import { useDanhSachHocVien, xuatHocVienTheoTruong } from '@/api/admin';
import { useTenDonViTheoId } from '@/api/danhMuc';
import type { DonViCongTac } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { SelectDonViTimKiem } from '@/components/SelectDonViTimKiem';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

const TUY_CHON_TRANG_THAI = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'nhap', label: 'Nháp' },
  { value: 'cho_duyet', label: 'Chờ duyệt' },
  { value: 'da_duyet', label: 'Đã duyệt' },
  { value: 'tu_choi', label: 'Từ chối' },
];

const TUY_CHON_CAP_GIANG_DAY = [
  { value: '', label: 'Tất cả cấp' },
  { value: 'mam_non', label: 'Mầm non' },
  { value: 'tieu_hoc', label: 'Tiểu học' },
  { value: 'thcs', label: 'THCS' },
  { value: 'thpt', label: 'THPT' },
  { value: 'trung_cap_nghe', label: 'Trung cấp nghề' },
];

/** Danh sách học viên (quản trị) — bộ lọc map đúng query param thật của GET /hoc-vien (trang_thai,
 * don_vi_cong_tac_id, cap_giang_day, q), phân trang server-side thật (PaginatedResult trong types.ts).
 * KHÔNG có lọc "đợt": GET /hoc-vien không có query dot_id/khoa_id trong api-contract.md — mockup có
 * ô "đợt" nhưng đó là dữ liệu mẫu, không map API thật nên không đưa vào (yêu cầu phase 3: không bịa). */
export default function AdminDanhSach() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [trangThai, setTrangThai] = useState(searchParams.get('trang_thai') ?? '');
  const [donViId, setDonViId] = useState('');
  const [donViDaChon, setDonViDaChon] = useState<DonViCongTac | null>(null);
  const [capGiangDay, setCapGiangDay] = useState('');
  const [page, setPage] = useState(1);
  const [dangXuat, setDangXuat] = useState(false);

  async function xuatTheoTruong() {
    setDangXuat(true);
    try {
      await xuatHocVienTheoTruong(donViId);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

  const params = useMemo(
    () => ({
      q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
      trang_thai: trangThai || undefined,
      don_vi_cong_tac_id: donViId || undefined,
      cap_giang_day: capGiangDay || undefined,
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, trangThai, donViId, capGiangDay, page],
  );

  const { data, isLoading, isError, error, isFetching } = useDanhSachHocVien(params);
  // Tên đơn vị để hiện ở cột bảng — tra riêng từng id xuất hiện trên trang hiện tại (không tải cả
  // danh mục ~5.000 đơn vị): xem useTenDonViTheoId trong api/danhMuc.ts.
  const donViMap = useTenDonViTheoId((data?.data ?? []).map((hv) => hv.don_vi_cong_tac_id), new Map());
  // Chỉ xuất theo đúng 1 trường (BE trả 400 với Phòng/Sở).
  const coTheXuat = donViDaChon?.loai_don_vi === 'truong';

  function datBoLoc<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <AdminPageHeader title="Danh sách học viên" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Tìm theo tên, CCCD, mã MOET..."
              value={q}
              onChange={(e) => datBoLoc(setQ)(e.currentTarget.value)}
              w={280}
            />
            <Select
              data={TUY_CHON_TRANG_THAI}
              value={trangThai}
              onChange={(v) => datBoLoc(setTrangThai)(v ?? '')}
              allowDeselect={false}
              w={180}
            />
            <SelectDonViTimKiem
              placeholder="Tất cả đơn vị — gõ tên để tìm"
              loaiDonVi="truong"
              value={donViId || null}
              onChange={(id, donVi) => {
                datBoLoc(setDonViId)(id ?? '');
                setDonViDaChon(donVi);
              }}
              w={260}
            />
            <Select
              data={TUY_CHON_CAP_GIANG_DAY}
              value={capGiangDay}
              onChange={(v) => datBoLoc(setCapGiangDay)(v ?? '')}
              allowDeselect={false}
              w={160}
            />
            {/* data-disabled thay vì disabled: nút disabled không phát mouseleave nên Tooltip kẹt (Mantine). */}
            <Tooltip label="Chọn một trường để xuất" disabled={coTheXuat}>
              <Button
                variant="light"
                loading={dangXuat}
                data-disabled={!coTheXuat || undefined}
                aria-disabled={!coTheXuat}
                onClick={() => {
                  if (coTheXuat) void xuatTheoTruong();
                }}
              >
                Xuất Excel theo trường
              </Button>
            </Tooltip>
            <Text fz={12.5} c="dimmed" ml="auto">
              {data ? `${data.total.toLocaleString('vi-VN')} học viên` : ''}
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
                    <Table.Th>Họ và tên</Table.Th>
                    <Table.Th>Số CCCD</Table.Th>
                    <Table.Th>Đơn vị công tác</Table.Th>
                    <Table.Th>Cấp giảng dạy</Table.Th>
                    <Table.Th>Trạng thái hồ sơ</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text c="dimmed" ta="center" py="lg">
                          Không có học viên nào khớp bộ lọc.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {data.data.map((hv) => (
                    <Table.Tr
                      key={hv.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/hoc-vien/${hv.id}`)}
                    >
                      <Table.Td fw={600}>{hv.ho_ten ?? '(Chưa có tên)'}</Table.Td>
                      <Table.Td>{hv.so_dinh_danh_ca_nhan ?? '—'}</Table.Td>
                      <Table.Td>{hv.don_vi_cong_tac_id ? (donViMap.get(hv.don_vi_cong_tac_id) ?? '—') : '—'}</Table.Td>
                      <Table.Td>{TUY_CHON_CAP_GIANG_DAY.find((c) => c.value === hv.cap_giang_day)?.label ?? '—'}</Table.Td>
                      <Table.Td>
                        <TrangThaiBadge trangThai={hv.trang_thai} />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text fz={12.5} fw={700}>
                          Xem →
                        </Text>
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
    </>
  );
}
