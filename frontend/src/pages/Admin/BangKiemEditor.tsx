import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useBoBangKiem,
  useQuyTac,
  useSuaMuc,
  useThemMuc,
  useTuyChinhBangKiem,
  type LoaiMucKiemTra,
  type MucKiemTra,
} from '@/api/bangKiem';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';

interface FormMuc {
  ten: string;
  loai: LoaiMucKiemTra;
  ma_quy_tac: string | null;
  han_truoc_ngay: string;
}
const FORM_RONG: FormMuc = { ten: '', loai: 'thu_cong', ma_quy_tac: null, han_truoc_ngay: '' };

/** Trình sửa bảng kiểm chuẩn bị đợt trực tiếp (ADR 0004 G5b, issue #17) — khoaId null = bộ mặc định hệ
 * thống; khóa đang dùng bộ mặc định chỉ xem, bấm "Tùy chỉnh cho khóa" để sao chép rồi sửa. */
export function BangKiemEditor({ khoaId }: { khoaId: string | null }) {
  const { data, isLoading, isError, error } = useBoBangKiem(khoaId);
  const quyTac = useQuyTac();
  const tuyChinh = useTuyChinhBangKiem(khoaId ?? '');
  const them = useThemMuc(khoaId);
  const sua = useSuaMuc();
  const [moModal, setMoModal] = useState(false);
  const [dangSua, setDangSua] = useState<MucKiemTra | null>(null);
  const [form, setForm] = useState<FormMuc>(FORM_RONG);
  const [loi, setLoi] = useState<Record<string, string>>({});

  const tenQuyTac = (ma: string | null) => quyTac.data?.find((q) => q.ma === ma)?.ten ?? ma ?? '';
  const chiXem = !!khoaId && data?.nguon === 'mac_dinh';

  function moThem() {
    setDangSua(null);
    setForm(FORM_RONG);
    setLoi({});
    setMoModal(true);
  }

  function moSua(m: MucKiemTra) {
    setDangSua(m);
    setForm({ ten: m.ten, loai: m.loai, ma_quy_tac: m.ma_quy_tac, han_truoc_ngay: m.han_truoc_ngay == null ? '' : String(m.han_truoc_ngay) });
    setLoi({});
    setMoModal(true);
  }

  function luu() {
    const dto = {
      ten: form.ten.trim(),
      han_truoc_ngay: form.han_truoc_ngay === '' ? null : Number(form.han_truoc_ngay),
      ...(dangSua ? {} : { loai: form.loai }),
      ...(form.loai === 'tu_dong' ? { ma_quy_tac: form.ma_quy_tac } : {}),
    };
    const xong = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: dangSua ? 'Đã lưu mục' : 'Đã thêm mục' });
        setMoModal(false);
      },
      onError: (err: unknown) => {
        const f = loiFieldsThanhMap(err);
        if (Object.keys(f).length) setLoi(f);
        else notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
      },
    };
    if (dangSua) sua.mutate({ id: dangSua.id, dto }, xong);
    else them.mutate(dto, xong);
  }

  function doiTrangThai(m: MucKiemTra) {
    sua.mutate(
      { id: m.id, dto: { trang_thai: m.trang_thai === 'active' ? 'ngung' : 'active' } },
      { onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }) },
    );
  }

  if (isLoading) return <Skeleton height={160} />;
  if (isError || !data) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;

  const hopLe = form.ten.trim() !== '' && (form.loai === 'thu_cong' || !!form.ma_quy_tac);

  return (
    <Stack gap="sm">
      {khoaId && (
        <Group justify="space-between">
          <Badge variant="light" color={data.nguon === 'rieng' ? 'blue' : 'gray'}>
            {data.nguon === 'rieng' ? 'Bảng kiểm riêng của khóa' : 'Đang dùng bộ mặc định'}
          </Badge>
          {chiXem && (
            <Button
              size="xs"
              loading={tuyChinh.isPending}
              onClick={() =>
                tuyChinh.mutate(undefined, {
                  onSuccess: () => notifications.show({ color: 'green', message: 'Đã tạo bảng kiểm riêng cho khóa' }),
                  onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
                })
              }
            >
              Tùy chỉnh cho khóa
            </Button>
          )}
        </Group>
      )}
      <Text fz="sm" c="dimmed">
        Hạn của mục = buổi đầu của đợt trừ số ngày. Mục tự động do hệ thống tự kiểm; mục thủ công người hỗ trợ giảng viên đánh dấu.
        {chiXem ? ' Muốn sửa riêng cho khóa này, bấm "Tùy chỉnh cho khóa".' : ''}
      </Text>
      <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={680}>
          <Table verticalSpacing="xs" fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Mục</Table.Th>
                <Table.Th>Loại</Table.Th>
                <Table.Th>Hạn</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.muc.map((m) => (
                <Table.Tr key={m.id} style={{ opacity: m.trang_thai === 'ngung' ? 0.5 : 1 }}>
                  <Table.Td>{m.thu_tu}</Table.Td>
                  <Table.Td>
                    {m.ten}
                    {m.trang_thai === 'ngung' && (
                      <Badge ml={6} size="xs" color="gray">
                        Đã ngưng
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{m.loai === 'tu_dong' ? `Tự động · ${tenQuyTac(m.ma_quy_tac)}` : 'Thủ công'}</Table.Td>
                  <Table.Td>{m.han_truoc_ngay == null ? '—' : `${m.han_truoc_ngay} ngày trước`}</Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    {!chiXem && (
                      <>
                        <Button size="xs" variant="subtle" onClick={() => moSua(m)}>
                          Sửa
                        </Button>
                        <Button size="xs" variant="subtle" color={m.trang_thai === 'active' ? 'red' : 'blue'} onClick={() => doiTrangThai(m)}>
                          {m.trang_thai === 'active' ? 'Ngưng' : 'Mở lại'}
                        </Button>
                      </>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
      {!chiXem && (
        <Button variant="light" size="xs" w="fit-content" onClick={moThem}>
          + Thêm mục
        </Button>
      )}

      <Modal opened={moModal} onClose={() => setMoModal(false)} title={dangSua ? 'Sửa mục bảng kiểm' : 'Thêm mục bảng kiểm'} centered>
        <Stack gap="sm">
          <TextInput label="Tên mục" required value={form.ten} error={loi.ten} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, ten: v })); }} />
          {!dangSua && (
            <SegmentedControl
              value={form.loai}
              onChange={(v) => setForm((f) => ({ ...f, loai: v as LoaiMucKiemTra }))}
              data={[
                { value: 'thu_cong', label: 'Thủ công' },
                { value: 'tu_dong', label: 'Tự động' },
              ]}
            />
          )}
          {form.loai === 'tu_dong' && (
            <Select
              label="Quy tắc tự động"
              required
              data={(quyTac.data ?? []).map((q) => ({ value: q.ma, label: q.ten }))}
              value={form.ma_quy_tac}
              error={loi.ma_quy_tac}
              onChange={(v) => setForm((f) => ({ ...f, ma_quy_tac: v }))}
            />
          )}
          <NumberInput
            label="Hạn (số ngày trước buổi đầu của đợt)"
            description="Bỏ trống = không có hạn (chỉ làm vàng khi chưa đạt)"
            min={0}
            max={365}
            value={form.han_truoc_ngay}
            error={loi.han_truoc_ngay}
            onChange={(v) => setForm((f) => ({ ...f, han_truoc_ngay: v === '' ? '' : String(v) }))}
          />
          <Button mt="sm" loading={them.isPending || sua.isPending} disabled={!hopLe} onClick={luu} fullWidth>
            {dangSua ? 'Lưu' : 'Thêm mục'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
