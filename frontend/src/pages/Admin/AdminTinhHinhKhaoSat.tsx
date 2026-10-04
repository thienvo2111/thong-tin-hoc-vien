import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Container,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import type { SsoTarget } from '@/api/hocVien';
import {
  useDanhSachTinhHinhKhaoSat,
  useThongKeKhaoSat,
  type HocVienTinhHinhKhaoSat,
  type LocTinhHinhKhaoSat,
} from '@/api/ketQuaKhaoSat';
import { useDanhSachKhoa } from '@/api/khoaBoiDuong';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { NHAN_MUC_NANG_LUC, TEN_BAI_KHAO_SAT, nhanTrangThaiKhaoSat } from '@/lib/trangThaiKhaoSat';
import { AdminPageHeader } from './AdminPageHeader';

const PAGE_SIZE = 20;

const TUY_CHON_LOAI: { value: SsoTarget; label: string }[] = [
  { value: 'khao-sat', label: TEN_BAI_KHAO_SAT['khao-sat'] },
  { value: 'danh-gia', label: TEN_BAI_KHAO_SAT['danh-gia'] },
  { value: 'dau-ra', label: TEN_BAI_KHAO_SAT['dau-ra'] },
];

const O_THONG_KE: { value: LocTinhHinhKhaoSat; nhan: string }[] = [
  { value: 'chua_lam', nhan: 'Chưa làm' },
  { value: 'da_mo', nhan: 'Đã mở, chưa nộp' },
  { value: 'dang_lam', nhan: 'Đang làm' },
  { value: 'hoan_thanh', nhan: 'Đã hoàn thành' },
  { value: 'can_kiem_tra', nhan: 'Cần kiểm tra lại' },
];

const NHAN_NGUON = { sso: 'Cổng (vào bài)', api: 'Hệ thống khảo sát', import: 'Nhập Excel' } as const;

/** Tình hình khảo sát (quan_tri, 2026-10-04): số học viên theo trạng thái từng bài + danh sách để rà soát
 * người "đã mở mà chưa nộp". Dữ liệu do hệ thống khảo sát báo về (POST /sso/ket-qua) hoặc import Excel
 * `ket_qua_khao_sat`. Mức ở đây chỉ để theo dõi — chốt mức đầu vào vẫn qua import `ket_qua_danh_gia`. */
export default function AdminTinhHinhKhaoSat() {
  const [khoaId, setKhoaId] = useState('');
  const [loai, setLoai] = useState<SsoTarget>('khao-sat');
  const [trangThai, setTrangThai] = useState<LocTinhHinhKhaoSat | ''>('');
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [page, setPage] = useState(1);

  const khoa = useDanhSachKhoa({ trang_thai: 'da_duyet', page_size: 200 });
  const thongKe = useThongKeKhaoSat(khoaId || undefined);
  const danhSach = useDanhSachTinhHinhKhaoSat({
    khoa_id: khoaId || undefined,
    loai,
    trang_thai: trangThai || undefined,
    q: qDebounced.trim() || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const tkLoai = thongKe.data?.theo_loai.find((t) => t.loai === loai);
  const tongSoTrang = danhSach.data ? Math.max(1, Math.ceil(danhSach.data.total / PAGE_SIZE)) : 1;

  function doiLoc(capNhat: () => void) {
    capNhat();
    setPage(1);
  }

  return (
    <>
      <AdminPageHeader title="Tình hình khảo sát" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group align="flex-end" gap="md">
            <Select
              label="Khóa bồi dưỡng"
              w={340}
              data={[
                { value: '', label: 'Tất cả học viên' },
                ...(khoa.data?.data ?? []).map((k) => ({ value: k.id, label: `${k.ma_khoa} — ${k.ten_khoa}` })),
              ]}
              value={khoaId}
              onChange={(v) => doiLoc(() => setKhoaId(v ?? ''))}
              allowDeselect={false}
              searchable
            />
            <SegmentedControl
              aria-label="Loại bài"
              data={TUY_CHON_LOAI}
              value={loai}
              onChange={(v) => doiLoc(() => setLoai(v as SsoTarget))}
            />
          </Group>

          {thongKe.isError && <Alert color="red">{thongDiepLoiChung(thongKe.error)}</Alert>}
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="md">
            {O_THONG_KE.map((o) => {
              const dangChon = trangThai === o.value;
              return (
                <UnstyledButton
                  key={o.value}
                  aria-pressed={dangChon}
                  onClick={() => doiLoc(() => setTrangThai(dangChon ? '' : o.value))}
                >
                  <Paper withBorder p="md" radius={14} style={dangChon ? { borderColor: 'var(--mantine-color-blue-6)' } : undefined}>
                    <Text fz={12.5} fw={600} c="dimmed" mb={8}>
                      {o.nhan}
                    </Text>
                    {thongKe.isLoading ? (
                      <Skeleton height={26} width="50%" />
                    ) : (
                      <Text fz={26} fw={800}>
                        {(tkLoai?.[o.value] ?? 0).toLocaleString('vi-VN')}
                      </Text>
                    )}
                  </Paper>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
          {tkLoai && tkLoai.hoan_thanh > 0 && (
            <Text fz={13} c="dimmed">
              Mức của bài đã hoàn thành: Cơ bản {tkLoai.theo_muc.co_ban} · Thành thạo {tkLoai.theo_muc.thanh_thao} · Nâng
              cao {tkLoai.theo_muc.nang_cao} · Chưa xếp mức {tkLoai.theo_muc.chua_xep_muc}
            </Text>
          )}

          <Group gap="md" align="flex-end">
            <TextInput
              label="Tìm học viên"
              placeholder="Họ tên hoặc mã định danh"
              w={300}
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value);
                setPage(1);
              }}
            />
            {trangThai && (
              <Text fz={13} c="dimmed">
                Đang lọc: {O_THONG_KE.find((o) => o.value === trangThai)?.nhan} — bấm lại ô thống kê để bỏ lọc
              </Text>
            )}
          </Group>

          <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
            {danhSach.isLoading && (
              <Stack p="md" gap="sm">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={36} />
                ))}
              </Stack>
            )}
            {danhSach.isError && (
              <Alert color="red" m="md">
                {thongDiepLoiChung(danhSach.error)}
              </Alert>
            )}
            {danhSach.data && danhSach.data.data.length === 0 && (
              <Text c="dimmed" ta="center" py="lg">
                Không có học viên nào khớp bộ lọc.
              </Text>
            )}
            {danhSach.data && danhSach.data.data.length > 0 && (
              <Table.ScrollContainer minWidth={960}>
                <Table verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Học viên</Table.Th>
                      <Table.Th>Đơn vị</Table.Th>
                      <Table.Th>Trạng thái</Table.Th>
                      <Table.Th>Mức</Table.Th>
                      <Table.Th>Điểm</Table.Th>
                      <Table.Th>Lần vào bài</Table.Th>
                      <Table.Th>Cập nhật</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {danhSach.data.data.map((hv) => (
                      <DongHocVien key={hv.id} hocVien={hv} loai={loai} />
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>

          {danhSach.data && danhSach.data.total > 0 && (
            <Group justify="space-between">
              <Text fz={12.5} c="dimmed">
                Trang {danhSach.data.page} / {tongSoTrang} — {danhSach.data.total.toLocaleString('vi-VN')} học viên
              </Text>
              <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
            </Group>
          )}
        </Stack>
      </Container>
    </>
  );
}

function DongHocVien({ hocVien, loai }: { hocVien: HocVienTinhHinhKhaoSat; loai: SsoTarget }) {
  const kq = hocVien.ket_qua.find((k) => k.loai === loai);
  const badge = nhanTrangThaiKhaoSat(kq?.trang_thai ?? 'chua_lam', kq?.can_kiem_tra ?? false);
  return (
    <Table.Tr>
      <Table.Td>
        <Anchor component={Link} to={`/admin/hoc-vien/${hocVien.id}`} fw={600} size="sm">
          {hocVien.ho_ten}
        </Anchor>
        <Text size="xs" c="dimmed">
          {hocVien.ma_dinh_danh_moet ?? '—'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{hocVien.ten_don_vi}</Text>
      </Table.Td>
      <Table.Td>
        <Badge color={badge.mau} variant="light">
          {badge.nhan}
        </Badge>
      </Table.Td>
      <Table.Td>{kq?.muc ? NHAN_MUC_NANG_LUC[kq.muc] : '—'}</Table.Td>
      <Table.Td>{kq?.diem ?? '—'}</Table.Td>
      <Table.Td>{kq ? kq.so_lan_mo : '—'}</Table.Td>
      <Table.Td>
        {kq ? (
          <>
            <Text size="sm">{dinhDangNgayGio(kq.cap_nhat_luc)}</Text>
            <Text size="xs" c="dimmed">
              {NHAN_NGUON[kq.nguon]}
            </Text>
          </>
        ) : (
          '—'
        )}
      </Table.Td>
    </Table.Tr>
  );
}
