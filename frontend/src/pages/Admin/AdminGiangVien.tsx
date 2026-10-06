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
import {
  useGiangVien,
  useLichDayGiangVien,
  useSuaGiangVien,
  useTaoGiangVien,
  useXacNhanGio,
  type LuuGiangVienDto,
} from '@/api/giangVien';
import type { GiangVien, LichDayGiangVien, TrangThaiActive } from '@/api/types';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { chuanHoaNfc } from '@/lib/nfc';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

interface FormGiangVien {
  ho_ten: string;
  so_dien_thoai: string;
  email: string;
  don_vi_cong_tac: string;
  ghi_chu: string;
}
const FORM_RONG: FormGiangVien = { ho_ten: '', so_dien_thoai: '', email: '', don_vi_cong_tac: '', ghi_chu: '' };

const NHAN_VAI_TRO = { giang_vien: 'Giảng viên', ho_tro: 'Hỗ trợ' } as const;

/** Danh mục giảng viên (T11, issue #3) — chỉ Quản trị. Phân công vào buổi: ở chi tiết khóa hoặc import. */
export default function AdminGiangVien() {
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [trangThai, setTrangThai] = useState<TrangThaiActive>('active');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, isFetching } = useGiangVien({
    q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
    trang_thai: trangThai,
    page,
    page_size: KICH_THUOC_TRANG,
  });
  const taoGiangVien = useTaoGiangVien();
  const suaGiangVien = useSuaGiangVien();

  const [moModal, setMoModal] = useState(false);
  const [dangSua, setDangSua] = useState<GiangVien | null>(null);
  const [form, setForm] = useState<FormGiangVien>(FORM_RONG);
  const [loi, setLoi] = useState<Record<string, string>>({});
  const [xemLichDay, setXemLichDay] = useState<GiangVien | null>(null);

  function moTao() {
    setDangSua(null);
    setForm(FORM_RONG);
    setLoi({});
    setMoModal(true);
  }

  function moSua(gv: GiangVien) {
    setDangSua(gv);
    setForm({
      ho_ten: gv.ho_ten,
      so_dien_thoai: gv.so_dien_thoai,
      email: gv.email ?? '',
      don_vi_cong_tac: gv.don_vi_cong_tac ?? '',
      ghi_chu: gv.ghi_chu ?? '',
    });
    setLoi({});
    setMoModal(true);
  }

  function xuLyLuu() {
    setLoi({});
    const dto: LuuGiangVienDto = {
      ho_ten: chuanHoaNfc(form.ho_ten.trim()),
      so_dien_thoai: form.so_dien_thoai.trim(),
      email: form.email.trim() || (dangSua ? null : undefined),
      don_vi_cong_tac: chuanHoaNfc(form.don_vi_cong_tac.trim()) || (dangSua ? null : undefined),
      ghi_chu: chuanHoaNfc(form.ghi_chu.trim()) || (dangSua ? null : undefined),
    };
    const xong = {
      onSuccess: () => {
        notifications.show({ color: 'green', message: dangSua ? 'Đã lưu giảng viên' : 'Đã thêm giảng viên' });
        setMoModal(false);
      },
      onError: (err: unknown) => {
        const fields = loiFieldsThanhMap(err);
        if (Object.keys(fields).length > 0) setLoi(fields);
        else notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
      },
    };
    if (dangSua) suaGiangVien.mutate({ id: dangSua.id, dto }, xong);
    else taoGiangVien.mutate(dto, xong);
  }

  function doiTrangThai(gv: GiangVien) {
    const moi: TrangThaiActive = gv.trang_thai === 'active' ? 'ngung' : 'active';
    suaGiangVien.mutate(
      { id: gv.id, dto: { trang_thai: moi } },
      {
        onSuccess: () =>
          notifications.show({ color: 'green', message: moi === 'ngung' ? `Đã ngưng "${gv.ho_ten}"` : `Đã mở lại "${gv.ho_ten}"` }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  const hopLe = form.ho_ten.trim() !== '' && form.so_dien_thoai.trim() !== '';
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <AdminPageHeader title="Giảng viên" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap" align="flex-end">
            <TextInput
              label="Tìm theo họ tên, SĐT, email, đơn vị"
              placeholder="Nhập từ khóa..."
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value);
                setPage(1);
              }}
              w={300}
            />
            <SegmentedControl
              value={trangThai}
              onChange={(v) => {
                setTrangThai(v as TrangThaiActive);
                setPage(1);
              }}
              data={[
                { value: 'active', label: 'Đang dạy' },
                { value: 'ngung', label: 'Đã ngưng' },
              ]}
            />
            <Button ml="auto" onClick={moTao}>
              + Thêm giảng viên
            </Button>
          </Group>
          <Text fz={12.5} c="dimmed">
            Phân công giảng viên vào buổi học ở trang chi tiết khóa (nút "Giảng viên" trên từng buổi) hoặc qua Nhập dữ liệu → "Phân công giảng viên vào buổi học".
          </Text>

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
                      <Table.Th>Họ tên</Table.Th>
                      <Table.Th>Liên hệ</Table.Th>
                      <Table.Th>Đơn vị</Table.Th>
                      <Table.Th>Số buổi</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.data.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" ta="center" py="lg">
                            Chưa có giảng viên nào khớp bộ lọc.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {data.data.map((gv) => (
                      <Table.Tr key={gv.id}>
                        <Table.Td>
                          <Group gap={6}>
                            <Text fw={600} fz={14}>
                              {gv.ho_ten}
                            </Text>
                            {gv.trang_thai === 'ngung' && (
                              <Badge size="xs" color="gray">
                                Đã ngưng
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text fz={13.5}>{gv.so_dien_thoai}</Text>
                          <Text fz={12} c="dimmed">
                            {gv.email ?? 'Chưa có email'}
                          </Text>
                        </Table.Td>
                        <Table.Td>{gv.don_vi_cong_tac ?? '—'}</Table.Td>
                        <Table.Td>{gv.so_buoi ?? 0}</Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Button size="xs" variant="light" onClick={() => setXemLichDay(gv)} mr={8}>
                            Lịch dạy
                          </Button>
                          <Button size="xs" variant="default" onClick={() => moSua(gv)} mr={8}>
                            Sửa
                          </Button>
                          <Button size="xs" variant="subtle" color={gv.trang_thai === 'active' ? 'red' : 'blue'} onClick={() => doiTrangThai(gv)}>
                            {gv.trang_thai === 'active' ? 'Ngưng' : 'Mở lại'}
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
                {data.total.toLocaleString('vi-VN')} giảng viên
              </Text>
              <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
            </Group>
          )}
        </Stack>
      </Container>

      <Modal opened={moModal} onClose={() => setMoModal(false)} title={dangSua ? `Sửa giảng viên — ${dangSua.ho_ten}` : 'Thêm giảng viên'} centered>
        <Stack gap="sm">
          <TextInput label="Họ tên" required value={form.ho_ten} error={loi.ho_ten} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, ho_ten: v })); }} />
          <Group grow align="flex-start">
            <TextInput
              label="Số điện thoại"
              required
              value={form.so_dien_thoai}
              error={loi.so_dien_thoai}
              onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, so_dien_thoai: v })); }}
            />
            <TextInput
              label="Email"
              description="Cần để cấp tài khoản giảng viên sau này"
              value={form.email}
              error={loi.email}
              onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, email: v })); }}
            />
          </Group>
          <TextInput
            label="Đơn vị công tác"
            value={form.don_vi_cong_tac}
            error={loi.don_vi_cong_tac}
            onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, don_vi_cong_tac: v })); }}
          />
          <Textarea label="Ghi chú" autosize minRows={2} value={form.ghi_chu} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, ghi_chu: v })); }} />
          <Button mt="sm" loading={taoGiangVien.isPending || suaGiangVien.isPending} disabled={!hopLe} onClick={xuLyLuu} fullWidth>
            {dangSua ? 'Lưu thay đổi' : 'Thêm giảng viên'}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={xemLichDay !== null} onClose={() => setXemLichDay(null)} title={`Lịch dạy — ${xemLichDay?.ho_ten ?? ''}`} size="xl">
        {xemLichDay && <LichDay giangVienId={xemLichDay.id} />}
      </Modal>
    </>
  );
}

function LichDay({ giangVienId }: { giangVienId: string }) {
  const { data, isLoading, isError, error } = useLichDayGiangVien(giangVienId);
  if (isLoading) return <Skeleton height={120} />;
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  if (!data || data.phan_cong.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        Giảng viên chưa được phân công buổi nào.
      </Text>
    );
  }
  return (
    <Table.ScrollContainer minWidth={720}>
      <Table verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Thời gian</Table.Th>
            <Table.Th>Khóa / lớp</Table.Th>
            <Table.Th>Vai trò</Table.Th>
            <Table.Th>Số giờ</Table.Th>
            <Table.Th>Xác nhận giờ</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.phan_cong.map((pc) => (
            <DongPhanCong key={pc.id} pc={pc} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function DongPhanCong({ pc }: { pc: LichDayGiangVien['phan_cong'][number] }) {
  const xacNhan = useXacNhanGio();
  const [soGio, setSoGio] = useState<string>(pc.so_gio == null ? '' : String(Number(pc.so_gio)));
  const lh = pc.lich_hoc;

  function doi(daXacNhan: boolean) {
    xacNhan.mutate(
      { phanCongId: pc.id, da_xac_nhan_gio: daXacNhan, so_gio: daXacNhan && soGio !== '' ? Number(soGio) : undefined },
      {
        onSuccess: () => notifications.show({ color: 'green', message: daXacNhan ? 'Đã xác nhận giờ dạy' : 'Đã bỏ xác nhận' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Table.Tr>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>
        {dinhDangNgayGio(lh.thoi_gian_bat_dau)} – {dinhDangNgayGio(lh.thoi_gian_ket_thuc)}
        <Text fz={12} c="dimmed">
          Buổi {lh.buoi_so} · {lh.giai_doan.ten_giai_doan}
        </Text>
      </Table.Td>
      <Table.Td>
        {lh.lop.ten_lop}
        <Text fz={12} c="dimmed">
          {lh.lop.khoa.ma_khoa}
          {lh.diem_hoc ? ` · ${lh.diem_hoc.ten}` : ''}
        </Text>
      </Table.Td>
      <Table.Td>{NHAN_VAI_TRO[pc.vai_tro]}</Table.Td>
      <Table.Td>
        <NumberInput
          size="xs"
          w={90}
          min={0.1}
          step={0.5}
          decimalScale={1}
          value={soGio}
          disabled={pc.da_xac_nhan_gio}
          aria-label="Số giờ"
          onChange={(v) => setSoGio(v === '' ? '' : String(v))}
        />
      </Table.Td>
      <Table.Td>
        {pc.da_xac_nhan_gio ? (
          <Group gap={6}>
            <Badge color="green" size="sm">
              Đã xác nhận
            </Badge>
            <Button size="compact-xs" variant="subtle" color="gray" loading={xacNhan.isPending} onClick={() => doi(false)}>
              Bỏ
            </Button>
          </Group>
        ) : (
          <Button size="xs" variant="light" disabled={soGio === ''} loading={xacNhan.isPending} onClick={() => doi(true)}>
            Xác nhận
          </Button>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
