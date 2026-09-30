import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Container,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDanhSachKhoa, useDonViChoKhoa, useTaoKhoa } from '@/api/khoaBoiDuong';
import { useToi } from '@/auth/AuthContext';
import { thongDiepLoiChung, loiFieldsThanhMap } from '@/lib/loiApi';
import { dinhDangNgay } from '@/lib/ngay';
import { KhoaTrangThaiBadge } from '@/components/KhoaTrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

const TUY_CHON_TRANG_THAI = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'nhap', label: 'Nháp' },
  { value: 'cho_duyet', label: 'Chờ duyệt' },
  { value: 'da_duyet', label: 'Đã duyệt' },
  { value: 'tu_choi', label: 'Từ chối' },
  { value: 'dong_dang_ky', label: 'Đóng đăng ký' },
];

interface FormTaoKhoa {
  ma_khoa: string;
  ten_khoa: string;
  dia_diem: string;
  thoi_gian_bat_dau: string;
  thoi_gian_ket_thuc: string;
  don_vi_to_chuc_id: string;
}

const FORM_RONG: FormTaoKhoa = {
  ma_khoa: '',
  ten_khoa: '',
  dia_diem: '',
  thoi_gian_bat_dau: '',
  thoi_gian_ket_thuc: '',
  don_vi_to_chuc_id: '',
};

/** Danh sách khóa bồi dưỡng (quản trị) — Phase 4 redesign. GET /khoa-boi-duong trả bản ghi thô
 * (khoa-boi-duong.service.ts#findAll: findMany không include quan hệ nào) nên KHÔNG có sẵn "số lớp"
 * — cột này chỉ có ở GET /khoa-boi-duong/{id} (findOne có include lop_hoc), hiển thị ở AdminKhoaChiTiet.
 * Không bịa thêm cột không có trong response thật (theo quy ước dự án). */
export default function AdminKhoaBoiDuong() {
  const navigate = useNavigate();
  const { nguoiDung } = useToi();

  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [trangThai, setTrangThai] = useState('');
  const [donViId, setDonViId] = useState('');
  const [page, setPage] = useState(1);
  const [modalMoTao, setModalMoTao] = useState(false);
  const [form, setForm] = useState<FormTaoKhoa>(FORM_RONG);
  const [loiField, setLoiField] = useState<Record<string, string>>({});

  const params = useMemo(
    () => ({
      q: qDebounced.trim() || undefined,
      trang_thai: (trangThai || undefined) as never,
      don_vi_to_chuc_id: donViId || undefined,
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, trangThai, donViId, page],
  );

  const { data, isLoading, isError, error, isFetching } = useDanhSachKhoa(params);
  const donVi = useDonViChoKhoa();
  const donViMap = new Map((donVi.data ?? []).map((d) => [d.id, d.ten_don_vi]));
  const tuyChonDonVi = [
    { value: '', label: 'Tất cả đơn vị tổ chức' },
    ...(donVi.data?.map((d) => ({ value: d.id, label: d.ten_don_vi })) ?? []),
  ];

  const taoKhoa = useTaoKhoa();

  function datBoLoc<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function moModalTao() {
    const donViKhac = (donVi.data ?? []).filter((d) => d.loai_don_vi === 'khac');
    const donViToChucId =
      nguoiDung?.vai_tro === 'quan_tri' && donViKhac.length === 1 ? donViKhac[0].id : '';
    setForm({ ...FORM_RONG, don_vi_to_chuc_id: donViToChucId });
    setLoiField({});
    setModalMoTao(true);
  }

  function xuLyTao() {
    setLoiField({});
    taoKhoa.mutate(
      {
        ma_khoa: form.ma_khoa,
        ten_khoa: form.ten_khoa,
        dia_diem: form.dia_diem || undefined,
        thoi_gian_bat_dau: form.thoi_gian_bat_dau,
        thoi_gian_ket_thuc: form.thoi_gian_ket_thuc,
        don_vi_to_chuc_id: form.don_vi_to_chuc_id || undefined,
      },
      {
        onSuccess: (khoa) => {
          notifications.show({ color: 'green', message: `Đã tạo khóa "${khoa.ten_khoa}"` });
          setModalMoTao(false);
          navigate(`/admin/khoa-boi-duong/${khoa.id}`);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiField(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
        },
      },
    );
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const formHopLe =
    form.ma_khoa.trim() &&
    form.ten_khoa.trim() &&
    form.thoi_gian_bat_dau &&
    form.thoi_gian_ket_thuc &&
    (nguoiDung?.vai_tro !== 'quan_tri' || form.don_vi_to_chuc_id);

  return (
    <>
      <AdminPageHeader
        title="Khóa bồi dưỡng"
        actions={
          <Button color="accent" onClick={moModalTao}>
            + Tạo khóa mới
          </Button>
        }
      />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Tìm theo mã khóa, tên khóa..."
              value={q}
              onChange={(e) => datBoLoc(setQ)(e.currentTarget.value)}
              w={280}
            />
            <Select
              data={TUY_CHON_TRANG_THAI}
              value={trangThai}
              onChange={(v) => datBoLoc(setTrangThai)(v ?? '')}
              allowDeselect={false}
              w={190}
            />
            <Select
              data={tuyChonDonVi}
              value={donViId}
              onChange={(v) => datBoLoc(setDonViId)(v ?? '')}
              allowDeselect={false}
              searchable
              w={220}
            />
            <Text fz={12.5} c="dimmed" ml="auto">
              {data ? `${data.total.toLocaleString('vi-VN')} khóa bồi dưỡng` : ''}
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
                    <Table.Th>Mã khóa</Table.Th>
                    <Table.Th>Tên khóa</Table.Th>
                    <Table.Th>Đơn vị tổ chức</Table.Th>
                    <Table.Th>Thời gian</Table.Th>
                    <Table.Th>Trạng thái</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text c="dimmed" ta="center" py="lg">
                          Không có khóa bồi dưỡng nào khớp bộ lọc.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {data.data.map((khoa) => (
                    <Table.Tr
                      key={khoa.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/khoa-boi-duong/${khoa.id}`)}
                    >
                      <Table.Td fw={600}>{khoa.ma_khoa}</Table.Td>
                      <Table.Td>{khoa.ten_khoa}</Table.Td>
                      <Table.Td>{donViMap.get(khoa.don_vi_to_chuc_id) ?? '—'}</Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        {dinhDangNgay(khoa.thoi_gian_bat_dau)} – {dinhDangNgay(khoa.thoi_gian_ket_thuc)}
                      </Table.Td>
                      <Table.Td>
                        <KhoaTrangThaiBadge trangThai={khoa.trang_thai} />
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

      <Modal opened={modalMoTao} onClose={() => setModalMoTao(false)} title="Tạo khóa bồi dưỡng mới" centered>
        <Stack gap="sm">
          <TextInput
            label="Mã khóa"
            required
            value={form.ma_khoa}
            error={loiField.ma_khoa}
            onChange={(e) => setForm((f) => ({ ...f, ma_khoa: e.currentTarget.value }))}
          />
          <TextInput
            label="Tên khóa"
            required
            value={form.ten_khoa}
            error={loiField.ten_khoa}
            onChange={(e) => setForm((f) => ({ ...f, ten_khoa: e.currentTarget.value }))}
          />
          <TextInput
            label="Địa điểm"
            value={form.dia_diem}
            error={loiField.dia_diem}
            onChange={(e) => setForm((f) => ({ ...f, dia_diem: e.currentTarget.value }))}
          />
          <Group grow>
            <TextInput
              type="date"
              label="Ngày bắt đầu"
              required
              value={form.thoi_gian_bat_dau}
              error={loiField.thoi_gian_bat_dau}
              onChange={(e) => setForm((f) => ({ ...f, thoi_gian_bat_dau: e.currentTarget.value }))}
            />
            <TextInput
              type="date"
              label="Ngày kết thúc"
              required
              value={form.thoi_gian_ket_thuc}
              error={loiField.thoi_gian_ket_thuc}
              onChange={(e) => setForm((f) => ({ ...f, thoi_gian_ket_thuc: e.currentTarget.value }))}
            />
          </Group>
          {nguoiDung?.vai_tro === 'quan_tri' && (
            <Select
              label="Đơn vị tổ chức"
              description="Bắt buộc khi tạo khóa với tài khoản Quản trị hệ thống"
              required
              searchable
              data={(donVi.data ?? []).map((d) => ({ value: d.id, label: d.ten_don_vi }))}
              value={form.don_vi_to_chuc_id || null}
              error={loiField.don_vi_to_chuc_id}
              onChange={(v) => setForm((f) => ({ ...f, don_vi_to_chuc_id: v ?? '' }))}
            />
          )}

          <Button mt="sm" loading={taoKhoa.isPending} disabled={!formHopLe} onClick={xuLyTao} fullWidth>
            Tạo khóa
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
