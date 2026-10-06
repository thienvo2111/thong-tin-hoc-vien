import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDiemHoc, useSuaDiemHoc, useTaoDiemHoc, type LuuDiemHocDto } from '@/api/diemHoc';
import type { DiemHoc, TrangThaiActive } from '@/api/types';
import { SelectDiaDanh } from '@/components/SelectDiaDanh';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

interface FormDiemHoc {
  ma_diem_hoc: string;
  ten: string;
  dia_chi: string;
  tinh_id: string | null;
  dia_ban_id: string | null;
  so_phong: string;
  suc_chua: string;
  nguoi_lien_he: string;
  sdt_lien_he: string;
  ghi_chu_csvc: string;
}

const FORM_RONG: FormDiemHoc = {
  ma_diem_hoc: '',
  ten: '',
  dia_chi: '',
  tinh_id: null,
  dia_ban_id: null,
  so_phong: '',
  suc_chua: '',
  nguoi_lien_he: '',
  sdt_lien_he: '',
  ghi_chu_csvc: '',
};

function formTuDiemHoc(d: DiemHoc): FormDiemHoc {
  return {
    ma_diem_hoc: d.ma_diem_hoc,
    ten: d.ten,
    dia_chi: d.dia_chi,
    tinh_id: d.dia_ban?.parent_id ?? null,
    dia_ban_id: d.dia_ban_id,
    so_phong: d.so_phong == null ? '' : String(d.so_phong),
    suc_chua: d.suc_chua == null ? '' : String(d.suc_chua),
    nguoi_lien_he: d.nguoi_lien_he ?? '',
    sdt_lien_he: d.sdt_lien_he ?? '',
    ghi_chu_csvc: d.ghi_chu_csvc ?? '',
  };
}

function soHoacNull(v: string): number | null {
  return v.trim() === '' ? null : Number(v);
}

/** Danh mục điểm học trực tiếp (T10, issue #2) — chỉ Quản trị. Không xóa cứng: "Ngưng" / "Mở lại". */
export default function AdminDiemHoc() {
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [trangThai, setTrangThai] = useState<TrangThaiActive>('active');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useDiemHoc({
    q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
    trang_thai: trangThai,
    page,
    page_size: KICH_THUOC_TRANG,
  });
  const taoDiemHoc = useTaoDiemHoc();
  const suaDiemHoc = useSuaDiemHoc();

  const [moModal, setMoModal] = useState(false);
  const [dangSua, setDangSua] = useState<DiemHoc | null>(null);
  const [form, setForm] = useState<FormDiemHoc>(FORM_RONG);
  const [loi, setLoi] = useState<Record<string, string>>({});

  function moTao() {
    setDangSua(null);
    setForm(FORM_RONG);
    setLoi({});
    setMoModal(true);
  }

  function moSua(d: DiemHoc) {
    setDangSua(d);
    setForm(formTuDiemHoc(d));
    setLoi({});
    setMoModal(true);
  }

  function datTruong<K extends keyof FormDiemHoc>(k: K, v: FormDiemHoc[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function xuLyLoi(err: unknown) {
    const fields = loiFieldsThanhMap(err);
    if (Object.keys(fields).length > 0) setLoi(fields);
    else notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
  }

  function xuLyLuu() {
    setLoi({});
    const dto: LuuDiemHocDto = {
      ma_diem_hoc: form.ma_diem_hoc.trim(),
      ten: chuanHoaNfc(form.ten.trim()),
      dia_chi: chuanHoaNfc(form.dia_chi.trim()),
      dia_ban_id: form.dia_ban_id ?? undefined,
      so_phong: soHoacNull(form.so_phong),
      suc_chua: soHoacNull(form.suc_chua),
      nguoi_lien_he: chuanHoaNfc(form.nguoi_lien_he.trim()) || null,
      sdt_lien_he: form.sdt_lien_he.trim() || null,
      ghi_chu_csvc: chuanHoaNfc(form.ghi_chu_csvc.trim()) || null,
    };
    const xong = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: dangSua ? 'Đã lưu điểm học' : 'Đã thêm điểm học' });
        setMoModal(false);
      },
      onError: xuLyLoi,
    };
    if (dangSua) {
      suaDiemHoc.mutate({ id: dangSua.id, dto }, xong);
    } else {
      // POST không nhận null — bỏ các trường tùy chọn đang trống.
      const taoDto = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== null)) as LuuDiemHocDto;
      taoDiemHoc.mutate(taoDto, xong);
    }
  }

  function doiTrangThai(d: DiemHoc) {
    const moi: TrangThaiActive = d.trang_thai === 'active' ? 'ngung' : 'active';
    suaDiemHoc.mutate(
      { id: d.id, dto: { trang_thai: moi } },
      {
        onSuccess: () =>
          notifications.show({
            color: 'green',
            message: moi === 'ngung' ? `Đã ngưng "${d.ten}"` : `Đã mở lại "${d.ten}"`,
          }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  const hopLe =
    form.ma_diem_hoc.trim() !== '' && form.ten.trim() !== '' && form.dia_chi.trim() !== '' && !!form.dia_ban_id;
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <AdminPageHeader title="Điểm học trực tiếp" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap" align="flex-end">
            <TextInput
              label="Tìm theo tên, mã, địa chỉ"
              placeholder="Nhập từ khóa..."
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value);
                setPage(1);
              }}
              w={280}
            />
            <SegmentedControl
              value={trangThai}
              onChange={(v) => {
                setTrangThai(v as TrangThaiActive);
                setPage(1);
              }}
              data={[
                { value: 'active', label: 'Đang dùng' },
                { value: 'ngung', label: 'Đã ngưng' },
              ]}
            />
            <Button ml="auto" onClick={moTao}>
              + Thêm điểm học
            </Button>
          </Group>

          <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
            {isLoading && (
              <Stack p="md" gap="sm">
                {Array.from({ length: 5 }).map((_, i) => (
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
              <Table.ScrollContainer minWidth={760}>
                <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Điểm học</Table.Th>
                      <Table.Th>Địa chỉ</Table.Th>
                      <Table.Th>Số phòng</Table.Th>
                      <Table.Th>Liên hệ</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.data.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" ta="center" py="lg">
                            Chưa có điểm học nào khớp bộ lọc.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {data.data.map((d) => (
                      <Table.Tr key={d.id}>
                        <Table.Td>
                          <Text fw={600} fz={14}>
                            {d.ten}
                          </Text>
                          <Group gap={6}>
                            <Text fz={12} c="dimmed">
                              {d.ma_diem_hoc}
                            </Text>
                            {d.trang_thai === 'ngung' && (
                              <Badge size="xs" color="gray">
                                Đã ngưng
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text fz={13.5}>{d.dia_chi}</Text>
                          <Text fz={12} c="dimmed">
                            {d.dia_ban?.ten ?? ''}
                          </Text>
                        </Table.Td>
                        <Table.Td>{d.so_phong ?? '—'}</Table.Td>
                        <Table.Td>
                          <Text fz={13.5}>{d.nguoi_lien_he ?? '—'}</Text>
                          <Text fz={12} c="dimmed">
                            {d.sdt_lien_he ?? ''}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Button size="xs" variant="default" onClick={() => moSua(d)} mr={8}>
                            Sửa
                          </Button>
                          <Button size="xs" variant="subtle" color={d.trang_thai === 'active' ? 'red' : 'blue'} onClick={() => doiTrangThai(d)}>
                            {d.trang_thai === 'active' ? 'Ngưng' : 'Mở lại'}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Paper>

          {data && data.total > 0 && (
            <Group justify="space-between">
              <Text fz={12.5} c="dimmed">
                {data.total.toLocaleString('vi-VN')} điểm học
              </Text>
              <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
            </Group>
          )}
        </Stack>
      </Container>

      <Modal
        opened={moModal}
        onClose={() => setMoModal(false)}
        title={dangSua ? `Sửa điểm học — ${dangSua.ten}` : 'Thêm điểm học'}
        centered
        size="lg"
      >
        <Stack gap="sm">
          <Group grow align="flex-start">
            <TextInput
              label="Mã điểm học"
              description="Chữ không dấu, số, _ - . (dùng ở cột ma_diem_hoc khi import lịch)"
              required
              value={form.ma_diem_hoc}
              error={loi.ma_diem_hoc}
              onChange={(e) => datTruong('ma_diem_hoc', e.currentTarget.value)}
            />
            <TextInput
              label="Tên điểm học"
              required
              value={form.ten}
              error={loi.ten}
              onChange={(e) => datTruong('ten', e.currentTarget.value)}
            />
          </Group>
          <TextInput
            label="Địa chỉ"
            required
            value={form.dia_chi}
            error={loi.dia_chi}
            onChange={(e) => datTruong('dia_chi', e.currentTarget.value)}
          />
          <Group grow align="flex-start">
            <SelectDiaDanh
              label="Tỉnh/thành"
              cap="tinh_thanh"
              phienBan="hien_tai"
              value={form.tinh_id}
              onChange={(id) => setForm((f) => ({ ...f, tinh_id: id, dia_ban_id: null }))}
              required
            />
            <SelectDiaDanh
              label="Phường/xã"
              cap="phuong_xa_dac_khu"
              phienBan="hien_tai"
              parentId={form.tinh_id}
              value={form.dia_ban_id}
              onChange={(id) => datTruong('dia_ban_id', id)}
              error={loi.dia_ban_id}
              required
            />
          </Group>
          <Group grow align="flex-start">
            <NumberInput
              label="Số phòng học"
              description="Dùng để cảnh báo khi nhiều lớp học cùng lúc"
              min={1}
              value={form.so_phong}
              error={loi.so_phong}
              onChange={(v) => datTruong('so_phong', v === '' ? '' : String(v))}
            />
            <NumberInput
              label="Sức chứa (người)"
              min={1}
              value={form.suc_chua}
              error={loi.suc_chua}
              onChange={(v) => datTruong('suc_chua', v === '' ? '' : String(v))}
            />
          </Group>
          <Group grow align="flex-start">
            <TextInput
              label="Người liên hệ tại điểm học"
              value={form.nguoi_lien_he}
              error={loi.nguoi_lien_he}
              onChange={(e) => datTruong('nguoi_lien_he', e.currentTarget.value)}
            />
            <TextInput
              label="SĐT liên hệ"
              value={form.sdt_lien_he}
              error={loi.sdt_lien_he}
              onChange={(e) => datTruong('sdt_lien_he', e.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Ghi chú cơ sở vật chất"
            placeholder="Máy chiếu, wifi, bãi xe..."
            autosize
            minRows={2}
            value={form.ghi_chu_csvc}
            error={loi.ghi_chu_csvc}
            onChange={(e) => datTruong('ghi_chu_csvc', e.currentTarget.value)}
          />
          <Button mt="sm" loading={taoDiemHoc.isPending || suaDiemHoc.isPending} disabled={!hopLe} onClick={xuLyLuu} fullWidth>
            {dangSua ? 'Lưu thay đổi' : 'Thêm điểm học'}
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
