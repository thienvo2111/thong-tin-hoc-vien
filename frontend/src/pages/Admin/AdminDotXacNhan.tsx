import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import { useDanhSachDot, useTaoDot, useSuaDot } from '@/api/dotXacNhan';
import type { DotXacNhan, LoaiDotXacNhan } from '@/api/dotXacNhan';
import { useDanhSachKhoa } from '@/api/khoaBoiDuong';
import { thongDiepLoiChung, loiFieldsThanhMap } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { AdminPageHeader } from './AdminPageHeader';

const TUY_CHON_LOAI: { value: LoaiDotXacNhan; label: string }[] = [
  { value: 'kiem_tra_bo_sung', label: 'Kiểm tra/bổ sung hồ sơ' },
  { value: 'xac_nhan_truoc_danh_gia', label: 'Xác nhận trước đánh giá' },
];

const NHAN_LOAI: Record<LoaiDotXacNhan, string> = {
  kiem_tra_bo_sung: 'Kiểm tra/bổ sung hồ sơ',
  xac_nhan_truoc_danh_gia: 'Xác nhận trước đánh giá',
};

const MAU_LOAI: Record<LoaiDotXacNhan, string> = {
  kiem_tra_bo_sung: 'primary',
  xac_nhan_truoc_danh_gia: 'accent',
};

type TrangThaiDot = 'chua_mo' | 'dang_mo' | 'da_dong';

function tinhTrangThaiDot(dot: DotXacNhan, now: Date): TrangThaiDot {
  if (now < new Date(dot.mo_luc)) return 'chua_mo';
  if (now > new Date(dot.dong_luc)) return 'da_dong';
  return 'dang_mo';
}

const NHAN_TRANG_THAI: Record<TrangThaiDot, string> = {
  chua_mo: 'Chưa mở',
  dang_mo: 'Đang mở',
  da_dong: 'Đã đóng',
};

const MAU_TRANG_THAI: Record<TrangThaiDot, string> = {
  chua_mo: 'gray',
  dang_mo: 'success',
  da_dong: 'danger',
};

/** thongDiepLoiChung() hard-code case 'CONFLICT' thành thông báo trùng CCCD (dùng cho luồng hồ sơ học
 * viên) — không đúng ngữ cảnh cho lỗi trùng thời gian đợt (ConflictAppException từ kiemTraChongCheo()
 * trong dot-xac-nhan.service.ts). Dùng thẳng message thật từ backend khi là ApiError, chỉ fallback
 * thongDiepLoiChung() cho lỗi không phải ApiError (mạng/không xác định). */
function thongDiepLoiDot(err: unknown): string {
  return err instanceof ApiError ? err.message : thongDiepLoiChung(err);
}

interface FormTaoDot {
  ten: string;
  loai: LoaiDotXacNhan | '';
  khoa_id: string;
  mo_luc: string;
  dong_luc: string;
}

const FORM_RONG: FormTaoDot = { ten: '', loai: '', khoa_id: '', mo_luc: '', dong_luc: '' };

/** Danh sách + tạo/gia hạn đợt xác nhận (quan_tri) — mo-rong-nls-an-giang.md mục T14. GET /dot-xac-nhan
 * trả mảng thô, không phân trang (số lượng đợt thực tế rất ít) nên hiện hết trong 1 bảng không phân trang. */
export default function AdminDotXacNhan() {
  const [khoaLoc, setKhoaLoc] = useState('');
  const [modalTaoMo, setModalTaoMo] = useState(false);
  const [form, setForm] = useState<FormTaoDot>(FORM_RONG);
  const [loiField, setLoiField] = useState<Record<string, string>>({});

  const [dotGiaHan, setDotGiaHan] = useState<DotXacNhan | null>(null);
  const [dongLucMoi, setDongLucMoi] = useState('');
  const [loiGiaHan, setLoiGiaHan] = useState('');

  const { data, isLoading, isError, error, isFetching } = useDanhSachDot(khoaLoc || undefined);
  const khoa = useDanhSachKhoa({ page_size: 200 });
  const khoaMap = new Map((khoa.data?.data ?? []).map((k) => [k.id, k.ten_khoa]));

  const tuyChonKhoaLoc = [
    { value: '', label: 'Tất cả đợt' },
    ...(khoa.data?.data.map((k) => ({ value: k.id, label: k.ten_khoa })) ?? []),
  ];
  const tuyChonKhoaForm = [
    { value: '', label: 'Không giới hạn (mọi học viên)' },
    ...(khoa.data?.data.map((k) => ({ value: k.id, label: k.ten_khoa })) ?? []),
  ];

  const taoDot = useTaoDot();
  const suaDot = useSuaDot();

  function moModalTao() {
    setForm(FORM_RONG);
    setLoiField({});
    setModalTaoMo(true);
  }

  function xuLyTao() {
    setLoiField({});
    taoDot.mutate(
      {
        ten: form.ten,
        loai: form.loai as LoaiDotXacNhan,
        khoa_id: form.khoa_id || undefined,
        mo_luc: new Date(form.mo_luc).toISOString(),
        dong_luc: new Date(form.dong_luc).toISOString(),
      },
      {
        onSuccess: (dot) => {
          notifications.show({ color: 'green', message: `Đã tạo đợt xác nhận "${dot.ten}"` });
          setModalTaoMo(false);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiField(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiDot(err) });
        },
      },
    );
  }

  function moModalGiaHan(dot: DotXacNhan) {
    setDotGiaHan(dot);
    setDongLucMoi('');
    setLoiGiaHan('');
  }

  function xuLyGiaHan() {
    if (!dotGiaHan) return;
    setLoiGiaHan('');
    suaDot.mutate(
      { id: dotGiaHan.id, dongLuc: new Date(dongLucMoi).toISOString() },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã gia hạn đợt xác nhận "${dotGiaHan.ten}"` });
          setDotGiaHan(null);
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          setLoiGiaHan(fields.dong_luc || thongDiepLoiDot(err));
        },
      },
    );
  }

  const formHopLe =
    form.ten.trim() !== '' &&
    form.loai !== '' &&
    form.mo_luc !== '' &&
    form.dong_luc !== '' &&
    new Date(form.dong_luc) > new Date(form.mo_luc);
  const giaHanHopLe = dongLucMoi !== '' && dotGiaHan !== null && new Date(dongLucMoi) > new Date(dotGiaHan.mo_luc);

  const now = new Date();

  return (
    <>
      <AdminPageHeader
        title="Đợt xác nhận"
        actions={
          <Button color="accent" onClick={moModalTao}>
            + Tạo đợt mới
          </Button>
        }
      />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <Select
              data={tuyChonKhoaLoc}
              value={khoaLoc}
              onChange={(v) => setKhoaLoc(v ?? '')}
              allowDeselect={false}
              searchable
              w={260}
            />
          </Group>

          <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
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

            {data && data.length === 0 && (
              <Text c="dimmed" ta="center" py="lg">
                Chưa có đợt xác nhận nào.
              </Text>
            )}

            {data && data.length > 0 && (
              <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tên đợt</Table.Th>
                    <Table.Th>Loại đợt</Table.Th>
                    <Table.Th>Phạm vi</Table.Th>
                    <Table.Th>Mở lúc</Table.Th>
                    <Table.Th>Đóng lúc</Table.Th>
                    <Table.Th>Trạng thái</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.map((dot) => {
                    const trangThai = tinhTrangThaiDot(dot, now);
                    return (
                      <Table.Tr key={dot.id}>
                        <Table.Td fw={600}>{dot.ten}</Table.Td>
                        <Table.Td>
                          <Badge color={MAU_LOAI[dot.loai]} radius="xl">
                            {NHAN_LOAI[dot.loai]}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{dot.khoa_id ? khoaMap.get(dot.khoa_id) ?? '—' : 'Tất cả học viên'}</Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(dot.mo_luc)}</Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(dot.dong_luc)}</Table.Td>
                        <Table.Td>
                          <Badge color={MAU_TRANG_THAI[trangThai]} radius="xl">
                            {NHAN_TRANG_THAI[trangThai]}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          {trangThai !== 'da_dong' && (
                            <Button size="xs" variant="default" onClick={() => moModalGiaHan(dot)}>
                              Gia hạn
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Paper>
        </Stack>
      </Container>

      <Modal opened={modalTaoMo} onClose={() => setModalTaoMo(false)} title="Tạo đợt xác nhận mới" centered>
        <Stack gap="sm">
          <TextInput
            label="Tên đợt"
            required
            value={form.ten}
            error={loiField.ten}
            onChange={(e) => setForm((f) => ({ ...f, ten: e.currentTarget.value }))}
          />
          <Select
            label="Loại đợt"
            placeholder="Chọn loại đợt"
            required
            data={TUY_CHON_LOAI}
            value={form.loai || null}
            error={loiField.loai}
            onChange={(v) => setForm((f) => ({ ...f, loai: (v as LoaiDotXacNhan) ?? '' }))}
          />
          <Select
            label="Khóa bồi dưỡng"
            description="Phạm vi áp dụng của đợt"
            data={tuyChonKhoaForm}
            value={form.khoa_id}
            error={loiField.khoa_id}
            searchable
            onChange={(v) => setForm((f) => ({ ...f, khoa_id: v ?? '' }))}
          />
          <Group grow>
            <TextInput
              type="datetime-local"
              label="Mở lúc"
              required
              value={form.mo_luc}
              error={loiField.mo_luc}
              onChange={(e) => setForm((f) => ({ ...f, mo_luc: e.currentTarget.value }))}
            />
            <TextInput
              type="datetime-local"
              label="Đóng lúc"
              required
              value={form.dong_luc}
              error={loiField.dong_luc}
              onChange={(e) => setForm((f) => ({ ...f, dong_luc: e.currentTarget.value }))}
            />
          </Group>
          <Text fz={12.5} c="dimmed">
            Lưu ý: không được tạo 2 đợt chồng thời gian trong cùng phạm vi (cùng khóa hoặc cùng "không
            giới hạn"), dù khác loại đợt.
          </Text>

          <Button mt="sm" loading={taoDot.isPending} disabled={!formHopLe} onClick={xuLyTao} fullWidth>
            Tạo đợt
          </Button>
        </Stack>
      </Modal>

      <Modal opened={dotGiaHan !== null} onClose={() => setDotGiaHan(null)} title="Gia hạn đợt xác nhận" centered>
        <Stack gap="sm">
          {dotGiaHan && (
            <Text fz={13.5} c="dimmed">
              Đợt "{dotGiaHan.ten}" — hiện đóng lúc {dinhDangNgayGio(dotGiaHan.dong_luc)}
            </Text>
          )}
          <TextInput
            type="datetime-local"
            label="Đóng lúc (mới)"
            required
            value={dongLucMoi}
            error={loiGiaHan}
            onChange={(e) => setDongLucMoi(e.currentTarget.value)}
          />
          <Button mt="sm" loading={suaDot.isPending} disabled={!giaHanHopLe} onClick={xuLyGiaHan} fullWidth>
            Xác nhận gia hạn
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
