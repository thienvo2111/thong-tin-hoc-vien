import { useState } from 'react';
import { Alert, Badge, Button, Group, Modal, Paper, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import {
  useDongDotNhuCauMuc,
  useDotNhuCauMuc,
  useSuaDotNhuCauMuc,
  useTaoDotNhuCauMuc,
  useXoaDotNhuCauMuc,
} from '@/api/nhuCauMuc';
import type { DotNhuCauMuc, TrangThaiDotNhuCau } from '@/api/types';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

const NHAN_TRANG_THAI: Record<TrangThaiDotNhuCau, string> = {
  chua_mo: 'Chưa mở',
  dang_mo: 'Đang mở',
  da_dong: 'Đã đóng',
};
const MAU_TRANG_THAI: Record<TrangThaiDotNhuCau, string> = {
  chua_mo: 'gray',
  dang_mo: 'success',
  da_dong: 'danger',
};

interface FormDot {
  ten_dot: string;
  mo_luc: string;
  dong_luc: string;
}
const FORM_RONG: FormDot = { ten_dot: '', mo_luc: '', dong_luc: '' };

/** ISO → giá trị cho <input type="datetime-local"> theo giờ máy. */
const sangInputGio = (iso: string) => dayjs(iso).format('YYYY-MM-DDTHH:mm');

/** Quản lý đợt nhu cầu mức học của 1 khóa (quan_tri) — ADR 0013 D7/D9. */
export function KhoiDotNhuCauMuc({ khoaId }: { khoaId: string }) {
  const { data, isLoading, isError, error } = useDotNhuCauMuc(khoaId);
  const tao = useTaoDotNhuCauMuc(khoaId);
  const sua = useSuaDotNhuCauMuc(khoaId);
  const dong = useDongDotNhuCauMuc(khoaId);
  const xoa = useXoaDotNhuCauMuc(khoaId);

  // Modal tạo/sửa: dangSua=null là tạo mới.
  const [moForm, setMoForm] = useState(false);
  const [dangSua, setDangSua] = useState<DotNhuCauMuc | null>(null);
  const [form, setForm] = useState<FormDot>(FORM_RONG);
  const [loiField, setLoiField] = useState<Record<string, string>>({});
  const [canDong, setCanDong] = useState<DotNhuCauMuc | null>(null);
  const [canXoa, setCanXoa] = useState<DotNhuCauMuc | null>(null);

  function moTao() {
    setDangSua(null);
    setForm(FORM_RONG);
    setLoiField({});
    setMoForm(true);
  }
  function moSua(d: DotNhuCauMuc) {
    setDangSua(d);
    setForm({ ten_dot: d.ten_dot, mo_luc: sangInputGio(d.mo_luc), dong_luc: sangInputGio(d.dong_luc) });
    setLoiField({});
    setMoForm(true);
  }

  function capNhat(truong: keyof FormDot, giaTri: string) {
    setForm((f) => ({ ...f, [truong]: giaTri }));
  }

  function luu() {
    setLoiField({});
    const dto = {
      ten_dot: form.ten_dot.trim().normalize('NFC'),
      mo_luc: new Date(form.mo_luc).toISOString(),
      dong_luc: new Date(form.dong_luc).toISOString(),
    };
    const opts = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: dangSua ? 'Đã cập nhật đợt' : 'Đã tạo đợt' });
        setMoForm(false);
      },
      onError: (err: unknown) => {
        const fields = loiFieldsThanhMap(err);
        if (Object.keys(fields).length > 0) setLoiField(fields);
        else notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
      },
    };
    if (dangSua) sua.mutate({ id: dangSua.id, ...dto }, opts);
    else tao.mutate(dto, opts);
  }

  function xacNhanDong() {
    if (!canDong) return;
    dong.mutate(canDong.id, {
      onSuccess: () => notifications.show({ color: 'green', message: 'Đã đóng đợt' }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
      onSettled: () => setCanDong(null),
    });
  }

  function xacNhanXoa() {
    if (!canXoa) return;
    xoa.mutate(canXoa.id, {
      onSuccess: () => notifications.show({ color: 'green', message: 'Đã xóa đợt' }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
      onSettled: () => setCanXoa(null),
    });
  }

  const formHopLe =
    form.ten_dot.trim() !== '' &&
    form.mo_luc !== '' &&
    form.dong_luc !== '' &&
    new Date(form.dong_luc) > new Date(form.mo_luc);

  return (
    <Paper withBorder radius={14} p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={600}>Đợt nhu cầu mức học</Text>
            <Text fz={13} c="dimmed">
              Học viên chọn mức muốn học trong khung giờ của đợt; kết quả chỉ dùng để thống kê, không đổi lớp.
            </Text>
          </div>
          <Button size="xs" color="accent" onClick={moTao}>
            + Tạo đợt
          </Button>
        </Group>

        {isLoading && <Skeleton height={36} />}
        {isError && <Alert color="red">{thongDiepLoiXungDot(error)}</Alert>}
        {data && data.length === 0 && (
          <Text c="dimmed" fz={13.5}>
            Chưa có đợt nào.
          </Text>
        )}
        {data && data.length > 0 && (
          <Table.ScrollContainer minWidth={820}>
            <Table verticalSpacing="xs" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tên đợt</Table.Th>
                  <Table.Th>Mở lúc</Table.Th>
                  <Table.Th>Đóng lúc</Table.Th>
                  <Table.Th>Trạng thái</Table.Th>
                  <Table.Th>Số lượt chọn</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.map((d) => (
                  <Table.Tr key={d.id}>
                    <Table.Td fw={600} miw={180}>
                      {d.ten_dot}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(d.mo_luc)}</Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(d.dong_luc)}</Table.Td>
                    <Table.Td>
                      {/* minWidth max-content: ô hẹp không được cắt nhãn thành "ĐA…". */}
                      <Badge color={MAU_TRANG_THAI[d.trang_thai]} radius="xl" style={{ minWidth: 'max-content' }}>
                        {NHAN_TRANG_THAI[d.trang_thai]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{d.so_ban_ghi}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        <Button size="xs" variant="default" aria-label={`Sửa đợt ${d.ten_dot}`} onClick={() => moSua(d)}>
                          Sửa
                        </Button>
                        {d.trang_thai === 'dang_mo' && (
                          <Button
                            size="xs"
                            variant="default"
                            aria-label={`Đóng ngay đợt ${d.ten_dot}`}
                            onClick={() => setCanDong(d)}
                          >
                            Đóng ngay
                          </Button>
                        )}
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          aria-label={`Xóa đợt ${d.ten_dot}`}
                          disabled={d.so_ban_ghi > 0}
                          onClick={() => setCanXoa(d)}
                        >
                          Xóa
                        </Button>
                        {d.so_ban_ghi > 0 && (
                          <Text fz={12} c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                            Đã có dữ liệu
                          </Text>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>

      <Modal opened={moForm} onClose={() => setMoForm(false)} title={dangSua ? 'Sửa đợt' : 'Tạo đợt mới'} centered>
        <Stack gap="sm">
          <TextInput
            label="Tên đợt"
            required
            value={form.ten_dot}
            error={loiField.ten_dot}
            onChange={(e) => capNhat('ten_dot', e.currentTarget.value)}
          />
          <TextInput
            type="datetime-local"
            label="Mở lúc"
            required
            value={form.mo_luc}
            error={loiField.mo_luc}
            onChange={(e) => capNhat('mo_luc', e.currentTarget.value)}
          />
          <TextInput
            type="datetime-local"
            label="Đóng lúc"
            required
            value={form.dong_luc}
            error={loiField.dong_luc}
            onChange={(e) => capNhat('dong_luc', e.currentTarget.value)}
          />
          <Text fz={12.5} c="dimmed">
            Các đợt trong cùng khóa không được chồng thời gian.
          </Text>
          <Button loading={tao.isPending || sua.isPending} disabled={!formHopLe} onClick={luu} fullWidth>
            {dangSua ? 'Lưu thay đổi' : 'Tạo đợt'}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={canDong !== null} onClose={() => setCanDong(null)} title="Đóng đợt ngay?" centered>
        <Stack gap="sm">
          <Text fz={14}>
            Đợt "{canDong?.ten_dot}" sẽ đóng ngay bây giờ; học viên không thể chọn hoặc đổi lựa chọn nữa.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCanDong(null)}>
              Hủy
            </Button>
            <Button color="red" loading={dong.isPending} onClick={xacNhanDong}>
              Xác nhận đóng
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={canXoa !== null} onClose={() => setCanXoa(null)} title="Xóa đợt?" centered>
        <Stack gap="sm">
          <Text fz={14}>Xóa đợt "{canXoa?.ten_dot}"? Chỉ xóa được đợt chưa có dữ liệu.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCanXoa(null)}>
              Hủy
            </Button>
            <Button color="red" loading={xoa.isPending} onClick={xacNhanXoa}>
              Xác nhận xóa
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

export default KhoiDotNhuCauMuc;
