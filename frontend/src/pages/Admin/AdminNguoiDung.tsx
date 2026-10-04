import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Menu,
  Modal,
  Pagination,
  Paper,
  Radio,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  useCapMatKhauTam,
  useDanhSachTaiKhoanDonVi,
  useDonViChuaCap,
  useGuiEmailKichHoat,
  useSuaTaiKhoanDonVi,
  useTaoTaiKhoanDonVi,
} from '@/api/taiKhoanDonVi';
import type { DonViChuaCap, TaiKhoanDonVi, VaiTroDonVi } from '@/api/types';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { chuanHoaNfc } from '@/lib/nfc';
import { locTiengViet } from '@/lib/timKiemTiengViet';
import { AdminPageHeader } from './AdminPageHeader';
import { ModalMatKhauTam } from './ModalMatKhauTam';

const KICH_THUOC_TRANG = 20;

const NHAN_LOAI: Record<VaiTroDonVi, string> = {
  so_gddt: 'Sở GD&ĐT',
  phong_vhxh: 'Phòng VHXH',
  truong: 'Trường',
};

const TUY_CHON_LOAI = [
  { value: '', label: 'Tất cả loại đơn vị' },
  { value: 'so_gddt', label: 'Sở GD&ĐT' },
  { value: 'phong_vhxh', label: 'Phòng VHXH' },
  { value: 'truong', label: 'Trường' },
];
const TUY_CHON_TRANG_THAI = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'ngung', label: 'Đã khóa' },
];
const TUY_CHON_DANG_NHAP = [
  { value: '', label: 'Tất cả' },
  { value: 'true', label: 'Đã đăng nhập' },
  { value: 'false', label: 'Chưa đăng nhập' },
];

interface FormTao {
  don_vi_id: string;
  ten_dang_nhap: string;
  ho_ten: string;
  email: string;
  cach_cap: 'mat_khau_tam' | 'email';
}
const FORM_TAO_RONG: FormTao = { don_vi_id: '', ten_dang_nhap: '', ho_ten: '', email: '', cach_cap: 'mat_khau_tam' };

type XacNhan = { loai: 'cap_mat_khau' | 'khoa' | 'mo_khoa'; tk: TaiKhoanDonVi } | null;

/** Trang Người dùng — tài khoản quản lý Sở/Phòng VHXH/Trường (ADR 0002). Chỉ quan_tri (route bọc
 * RequireQuanTri). Mật khẩu tạm chỉ giữ ở state `matKhau` cho tới khi đóng ModalMatKhauTam. */
export default function AdminNguoiDung() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [vaiTro, setVaiTro] = useState('');
  const [trangThai, setTrangThai] = useState('');
  const [daDangNhap, setDaDangNhap] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
      vai_tro: (vaiTro || undefined) as VaiTroDonVi | undefined,
      trang_thai: (trangThai || undefined) as 'active' | 'ngung' | undefined,
      da_dang_nhap: daDangNhap === '' ? undefined : daDangNhap === 'true',
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, vaiTro, trangThai, daDangNhap, page],
  );
  const { data, isLoading, isError, error, isFetching } = useDanhSachTaiKhoanDonVi(params);

  const [moTao, setMoTao] = useState(false);
  const [formTao, setFormTao] = useState<FormTao>(FORM_TAO_RONG);
  const [loiTao, setLoiTao] = useState<Record<string, string>>({});
  // Danh mục có hàng nghìn trường, API chua-cap trả tối đa 50 dòng -> tìm kiếm phải gửi lên server
  // (không lọc trong 50 dòng đã tải). Giữ đơn vị đã chọn trong danh sách khi kết quả tìm đổi.
  const [timDonVi, setTimDonVi] = useState('');
  const [timDonViDebounced] = useDebouncedValue(timDonVi, 300);
  const [donViDaChon, setDonViDaChon] = useState<DonViChuaCap | null>(null);
  const donViChuaCap = useDonViChuaCap(
    { q: timDonViDebounced.trim() ? chuanHoaNfc(timDonViDebounced.trim()) : undefined },
    moTao,
  );
  const taoTk = useTaoTaiKhoanDonVi();

  const [dangSua, setDangSua] = useState<TaiKhoanDonVi | null>(null);
  const [formSua, setFormSua] = useState({ ten_dang_nhap: '', ho_ten: '', email: '' });
  const [loiSua, setLoiSua] = useState<Record<string, string>>({});
  const suaTk = useSuaTaiKhoanDonVi();

  const [xacNhan, setXacNhan] = useState<XacNhan>(null);
  const capMatKhau = useCapMatKhauTam();
  const guiEmail = useGuiEmailKichHoat();
  const [matKhau, setMatKhau] = useState<{ ten_dang_nhap: string; mat_khau_tam: string } | null>(null);

  function datBoLoc(setter: (v: string) => void) {
    return (v: string | null) => {
      setter(v ?? '');
      setPage(1);
    };
  }

  const dsDonVi = useMemo(() => {
    const ds = donViChuaCap.data ?? [];
    return donViDaChon && !ds.some((d) => d.id === donViDaChon.id) ? [donViDaChon, ...ds] : ds;
  }, [donViChuaCap.data, donViDaChon]);

  const nhomDonVi = useMemo(() => {
    const ds = dsDonVi;
    return (['so_gddt', 'phong_vhxh', 'truong'] as VaiTroDonVi[])
      .map((loai) => ({
        group: NHAN_LOAI[loai],
        items: ds
          .filter((d) => d.loai_don_vi === loai)
          .map((d) => ({ value: d.id, label: `${d.ten_don_vi} (${d.ma_don_vi})` })),
      }))
      .filter((g) => g.items.length > 0);
  }, [dsDonVi]);

  function chonDonVi(id: string | null) {
    const dv = dsDonVi.find((d) => d.id === id) ?? null;
    setDonViDaChon(dv);
    setFormTao((f) => ({
      ...f,
      don_vi_id: id ?? '',
      ten_dang_nhap: dv ? dv.ma_don_vi.toLowerCase() : '',
      ho_ten: dv ? dv.ten_don_vi : '',
    }));
  }

  function xuLyTao() {
    setLoiTao({});
    taoTk.mutate(
      {
        don_vi_id: formTao.don_vi_id,
        ten_dang_nhap: formTao.ten_dang_nhap.trim() || undefined,
        ho_ten: formTao.ho_ten.trim() ? chuanHoaNfc(formTao.ho_ten.trim()) : undefined,
        email: formTao.email.trim() || undefined,
        cach_cap: formTao.email.trim() ? formTao.cach_cap : 'mat_khau_tam',
      },
      {
        onSuccess: (kq) => {
          setMoTao(false);
          setFormTao(FORM_TAO_RONG);
          if (kq.mat_khau_tam) {
            setMatKhau({ ten_dang_nhap: kq.tai_khoan.ten_dang_nhap, mat_khau_tam: kq.mat_khau_tam });
          } else {
            notifications.show({ color: 'green', message: `Đã gửi email kích hoạt tới ${kq.tai_khoan.email}` });
          }
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiTao(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
        },
      },
    );
  }

  function moSua(tk: TaiKhoanDonVi) {
    setDangSua(tk);
    setFormSua({ ten_dang_nhap: tk.ten_dang_nhap, ho_ten: tk.ho_ten, email: tk.email ?? '' });
    setLoiSua({});
  }

  function xuLySua() {
    if (!dangSua) return;
    setLoiSua({});
    suaTk.mutate(
      {
        id: dangSua.id,
        dto: {
          ten_dang_nhap: formSua.ten_dang_nhap.trim(),
          ho_ten: chuanHoaNfc(formSua.ho_ten.trim()),
          email: formSua.email.trim(),
        },
      },
      {
        onSuccess: () => {
          setDangSua(null);
          notifications.show({ color: 'green', message: 'Đã cập nhật tài khoản' });
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSua(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
        },
      },
    );
  }

  function xuLyXacNhan() {
    if (!xacNhan) return;
    const { loai, tk } = xacNhan;
    const loiChung = (err: unknown) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    if (loai === 'cap_mat_khau') {
      capMatKhau.mutate(tk.id, {
        onSuccess: (kq) => {
          setXacNhan(null);
          setMatKhau(kq);
        },
        onError: loiChung,
      });
      return;
    }
    suaTk.mutate(
      { id: tk.id, dto: { trang_thai: loai === 'khoa' ? 'ngung' : 'active' } },
      {
        onSuccess: () => {
          setXacNhan(null);
          notifications.show({ color: 'green', message: loai === 'khoa' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản' });
        },
        onError: loiChung,
      },
    );
  }

  function xuLyGuiEmail(tk: TaiKhoanDonVi) {
    guiEmail.mutate(tk.id, {
      onSuccess: () => notifications.show({ color: 'green', message: `Đã gửi email kích hoạt tới ${tk.email}` }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
    });
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const coEmail = formTao.email.trim() !== '';

  return (
    <>
      <AdminPageHeader
        title="Tài khoản đơn vị"
        actions={
          <Group gap="sm">
            <Button variant="default" onClick={() => navigate('/admin/nhap-du-lieu?loai=tai_khoan_don_vi')}>
              Nhập từ Excel
            </Button>
            <Button
              color="accent"
              onClick={() => {
                setFormTao(FORM_TAO_RONG);
                setLoiTao({});
                setTimDonVi('');
                setDonViDaChon(null);
                setMoTao(true);
              }}
            >
              + Tạo tài khoản
            </Button>
          </Group>
        }
      />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Tìm theo đơn vị, mã, tên đăng nhập, email..."
              aria-label="Tìm kiếm"
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value);
                setPage(1);
              }}
              w={300}
            />
            <Select aria-label="Loại đơn vị" data={TUY_CHON_LOAI} value={vaiTro} onChange={datBoLoc(setVaiTro)} allowDeselect={false} w={190} />
            <Select aria-label="Trạng thái" data={TUY_CHON_TRANG_THAI} value={trangThai} onChange={datBoLoc(setTrangThai)} allowDeselect={false} w={170} />
            <Select aria-label="Đăng nhập" data={TUY_CHON_DANG_NHAP} value={daDangNhap} onChange={datBoLoc(setDaDangNhap)} allowDeselect={false} w={170} />
            <Text fz={12.5} c="dimmed" ml="auto">
              {data ? `${data.total.toLocaleString('vi-VN')} tài khoản` : ''}
            </Text>
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
              <Table.ScrollContainer minWidth={900}>
                <Table verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Đơn vị</Table.Th>
                      <Table.Th>Loại</Table.Th>
                      <Table.Th>Tên đăng nhập</Table.Th>
                      <Table.Th>Người phụ trách</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Lần đăng nhập cuối</Table.Th>
                      <Table.Th>Trạng thái</Table.Th>
                      <Table.Th aria-label="Thao tác" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.data.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={8}>
                          <Text c="dimmed" ta="center" py="lg">
                            Chưa có tài khoản đơn vị nào khớp bộ lọc.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {data.data.map((tk) => (
                      <Table.Tr key={tk.id}>
                        <Table.Td>
                          <Text fz="sm" fw={600}>
                            {tk.don_vi?.ten_don_vi ?? '—'}
                          </Text>
                          <Text fz="xs" c="dimmed">
                            {tk.don_vi?.ma_don_vi}
                            {tk.don_vi?.trang_thai === 'ngung' ? ' · đơn vị ngừng hoạt động' : ''}
                          </Text>
                        </Table.Td>
                        <Table.Td>{NHAN_LOAI[tk.vai_tro]}</Table.Td>
                        <Table.Td>
                          <Text fz="sm" ff="monospace">
                            {tk.ten_dang_nhap}
                          </Text>
                        </Table.Td>
                        <Table.Td>{tk.ho_ten}</Table.Td>
                        <Table.Td>{tk.email ?? '—'}</Table.Td>
                        <Table.Td>
                          {tk.dang_nhap_lan_cuoi ? (
                            dinhDangNgayGio(tk.dang_nhap_lan_cuoi)
                          ) : (
                            <Badge color="yellow" variant="light">
                              Chưa đăng nhập
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={tk.trang_thai === 'active' ? 'green' : 'gray'} variant="light">
                            {tk.trang_thai === 'active' ? 'Hoạt động' : 'Đã khóa'}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon variant="subtle" color="gray" aria-label="Thao tác">
                                ⋯
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item onClick={() => moSua(tk)}>Sửa</Menu.Item>
                              <Menu.Item onClick={() => setXacNhan({ loai: 'cap_mat_khau', tk })}>Cấp mật khẩu tạm</Menu.Item>
                              {tk.email && <Menu.Item onClick={() => xuLyGuiEmail(tk)}>Gửi email kích hoạt</Menu.Item>}
                              {tk.trang_thai === 'active' ? (
                                <Menu.Item color="red" onClick={() => setXacNhan({ loai: 'khoa', tk })}>
                                  Khóa
                                </Menu.Item>
                              ) : (
                                <Menu.Item onClick={() => setXacNhan({ loai: 'mo_khoa', tk })}>Mở khóa</Menu.Item>
                              )}
                            </Menu.Dropdown>
                          </Menu>
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
                Trang {data.page} / {tongSoTrang}
              </Text>
              <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
            </Group>
          )}
        </Stack>
      </Container>

      <Modal opened={moTao} onClose={() => setMoTao(false)} title="Tạo tài khoản" centered>
        <Stack gap="sm">
          <Select
            label="Đơn vị"
            required
            searchable
            searchValue={timDonVi}
            onSearchChange={setTimDonVi}
            filter={locTiengViet}
            placeholder={donViChuaCap.isLoading ? 'Đang tải...' : 'Gõ tên hoặc mã đơn vị để tìm'}
            nothingFoundMessage={donViChuaCap.isFetching ? 'Đang tìm...' : 'Không tìm thấy đơn vị chưa có tài khoản'}
            data={nhomDonVi}
            value={formTao.don_vi_id || null}
            error={loiTao.don_vi_id}
            onChange={chonDonVi}
          />
          <TextInput
            label="Tên đăng nhập"
            description="Chữ thường không dấu, số, dấu . _ - (3–50 ký tự). Mặc định là mã đơn vị."
            value={formTao.ten_dang_nhap}
            error={loiTao.ten_dang_nhap}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFormTao((f) => ({ ...f, ten_dang_nhap: v }));
            }}
          />
          <TextInput
            label="Người phụ trách"
            value={formTao.ho_ten}
            error={loiTao.ho_ten}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFormTao((f) => ({ ...f, ho_ten: v }));
            }}
          />
          <TextInput
            label="Email"
            description="Không bắt buộc. Có email thì có thể gửi link kích hoạt thay cho mật khẩu tạm."
            value={formTao.email}
            error={loiTao.email}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFormTao((f) => ({ ...f, email: v, cach_cap: v.trim() ? f.cach_cap : 'mat_khau_tam' }));
            }}
          />
          <Radio.Group
            label="Cách cấp mật khẩu"
            value={formTao.cach_cap}
            onChange={(v) => setFormTao((f) => ({ ...f, cach_cap: v as FormTao['cach_cap'] }))}
          >
            <Stack gap={6} mt={4}>
              <Radio value="mat_khau_tam" label="Sinh mật khẩu tạm" />
              <Radio value="email" label="Gửi email kích hoạt" disabled={!coEmail} />
            </Stack>
          </Radio.Group>
          <Button mt="sm" loading={taoTk.isPending} disabled={!formTao.don_vi_id} onClick={xuLyTao} fullWidth>
            Tạo tài khoản
          </Button>
        </Stack>
      </Modal>

      <Modal opened={dangSua !== null} onClose={() => setDangSua(null)} title="Sửa tài khoản" centered>
        {dangSua && (
          <Stack gap="sm">
            <Text fz="sm" c="dimmed">
              {dangSua.don_vi?.ten_don_vi}
            </Text>
            <TextInput
              label="Tên đăng nhập"
              value={formSua.ten_dang_nhap}
              error={loiSua.ten_dang_nhap}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setFormSua((f) => ({ ...f, ten_dang_nhap: v }));
              }}
            />
            {formSua.ten_dang_nhap.trim().toLowerCase() !== dangSua.ten_dang_nhap && (
              <Alert color="yellow" variant="light">
                Người dùng sẽ phải đăng nhập bằng tên mới
              </Alert>
            )}
            <TextInput
              label="Người phụ trách"
              value={formSua.ho_ten}
              error={loiSua.ho_ten}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setFormSua((f) => ({ ...f, ho_ten: v }));
              }}
            />
            <TextInput
              label="Email"
              description="Để trống để xóa email."
              value={formSua.email}
              error={loiSua.email}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setFormSua((f) => ({ ...f, email: v }));
              }}
            />
            <Button mt="sm" loading={suaTk.isPending} onClick={xuLySua} fullWidth>
              Lưu
            </Button>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={xacNhan !== null}
        onClose={() => setXacNhan(null)}
        title={
          xacNhan?.loai === 'cap_mat_khau' ? 'Cấp mật khẩu tạm' : xacNhan?.loai === 'khoa' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'
        }
        centered
      >
        {xacNhan && (
          <Stack gap="sm">
            <Text fz="sm">
              {xacNhan.loai === 'cap_mat_khau'
                ? `Cấp mật khẩu tạm mới cho "${xacNhan.tk.ten_dang_nhap}"? Mật khẩu và link kích hoạt cũ sẽ mất hiệu lực.`
                : xacNhan.loai === 'khoa'
                  ? `Khóa tài khoản "${xacNhan.tk.ten_dang_nhap}"? Người dùng bị đăng xuất ngay và không đăng nhập được nữa.`
                  : `Mở khóa tài khoản "${xacNhan.tk.ten_dang_nhap}"?`}
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setXacNhan(null)}>
                Hủy
              </Button>
              <Button
                color={xacNhan.loai === 'khoa' ? 'red' : undefined}
                loading={capMatKhau.isPending || suaTk.isPending}
                onClick={xuLyXacNhan}
              >
                {xacNhan.loai === 'cap_mat_khau' ? 'Cấp mật khẩu' : xacNhan.loai === 'khoa' ? 'Khóa' : 'Mở khóa'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <ModalMatKhauTam thongTin={matKhau} onDong={() => setMatKhau(null)} />
    </>
  );
}
