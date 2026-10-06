import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Anchor,
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
  useCapMatKhauTamHoTro,
  useDanhSachTaiKhoanHoTro,
  useGuiEmailKichHoatHoTro,
  useSuaTaiKhoanHoTro,
  useTaoTaiKhoanHoTro,
} from '@/api/taiKhoanHoTro';
import type { TaiKhoanHoTro } from '@/api/types';
import { loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { chuanHoaNfc } from '@/lib/nfc';
import { AdminPageHeader } from './AdminPageHeader';
import { ModalMatKhauTam } from './ModalMatKhauTam';

const KICH_THUOC_TRANG = 20;

const TUY_CHON_TRANG_THAI = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'ngung', label: 'Đã khóa' },
];

interface FormTao {
  ho_ten: string;
  email: string;
  ten_dang_nhap: string;
  cach_cap: 'email' | 'mat_khau_tam';
}
const FORM_TAO_RONG: FormTao = { ho_ten: '', email: '', ten_dang_nhap: '', cach_cap: 'email' };

type XacNhan = { loai: 'cap_mat_khau' | 'khoa' | 'mo_khoa'; tk: TaiKhoanHoTro } | null;

/** Trang Người hỗ trợ — tài khoản cán bộ HCMUE hỗ trợ học viên theo cụm (ADR 0003). Chỉ quan_tri (route
 * bọc RequireQuanTri). Phân công cụm làm ở chi tiết khóa → tab Cụm hỗ trợ Zalo; ở đây chỉ hiện để xem. */
export default function AdminNguoiHoTro() {
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [trangThai, setTrangThai] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
      trang_thai: (trangThai || undefined) as 'active' | 'ngung' | undefined,
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, trangThai, page],
  );
  const { data, isLoading, isError, error, isFetching } = useDanhSachTaiKhoanHoTro(params);

  const [moTao, setMoTao] = useState(false);
  const [formTao, setFormTao] = useState<FormTao>(FORM_TAO_RONG);
  const [loiTao, setLoiTao] = useState<Record<string, string>>({});
  const taoTk = useTaoTaiKhoanHoTro();

  const [dangSua, setDangSua] = useState<TaiKhoanHoTro | null>(null);
  const [formSua, setFormSua] = useState({ ho_ten: '', email: '' });
  const [loiSua, setLoiSua] = useState<Record<string, string>>({});
  const suaTk = useSuaTaiKhoanHoTro();

  const [xacNhan, setXacNhan] = useState<XacNhan>(null);
  const capMatKhau = useCapMatKhauTamHoTro();
  const guiEmail = useGuiEmailKichHoatHoTro();
  const [matKhau, setMatKhau] = useState<{ ten_dang_nhap: string; mat_khau_tam: string } | null>(null);

  const loiChung = (err: unknown) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) });

  function xuLyTao() {
    setLoiTao({});
    taoTk.mutate(
      {
        ho_ten: chuanHoaNfc(formTao.ho_ten.trim()),
        email: formTao.email.trim(),
        ten_dang_nhap: formTao.ten_dang_nhap.trim() || undefined,
        cach_cap: formTao.cach_cap,
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
          else loiChung(err);
        },
      },
    );
  }

  function xuLySua() {
    if (!dangSua) return;
    setLoiSua({});
    suaTk.mutate(
      { id: dangSua.id, dto: { ho_ten: chuanHoaNfc(formSua.ho_ten.trim()), email: formSua.email.trim() } },
      {
        onSuccess: () => {
          setDangSua(null);
          notifications.show({ color: 'green', message: 'Đã cập nhật tài khoản' });
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoiSua(fields);
          else loiChung(err);
        },
      },
    );
  }

  function xuLyXacNhan() {
    if (!xacNhan) return;
    const { loai, tk } = xacNhan;
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

  function xuLyGuiEmail(tk: TaiKhoanHoTro) {
    guiEmail.mutate(tk.id, {
      onSuccess: () => notifications.show({ color: 'green', message: `Đã gửi email kích hoạt tới ${tk.email}` }),
      onError: loiChung,
    });
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const tenGoiY = formTao.email.trim().split('@')[0].toLowerCase();

  return (
    <>
      <AdminPageHeader
        title="Người hỗ trợ học viên"
        actions={
          <Button
            color="accent"
            onClick={() => {
              setFormTao(FORM_TAO_RONG);
              setLoiTao({});
              setMoTao(true);
            }}
          >
            + Tạo tài khoản
          </Button>
        }
      />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Text fz="sm" c="dimmed">
            Phân công người hỗ trợ cho từng cụm ở Khóa bồi dưỡng → chi tiết khóa → tab "Cụm hỗ trợ Zalo".
          </Text>
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Tìm theo họ tên, tên đăng nhập, email..."
              aria-label="Tìm kiếm"
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value);
                setPage(1);
              }}
              w={300}
            />
            <Select
              aria-label="Trạng thái"
              data={TUY_CHON_TRANG_THAI}
              value={trangThai}
              onChange={(v) => {
                setTrangThai(v ?? '');
                setPage(1);
              }}
              allowDeselect={false}
              w={170}
            />
            <Text fz={12.5} c="dimmed" ml="auto">
              {data ? `${data.total.toLocaleString('vi-VN')} tài khoản` : ''}
            </Text>
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
            {data && (
              <Table.ScrollContainer minWidth={900}>
                <Table verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Họ tên</Table.Th>
                      <Table.Th>Tên đăng nhập</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Cụm phụ trách</Table.Th>
                      <Table.Th>Lần đăng nhập cuối</Table.Th>
                      <Table.Th>Trạng thái</Table.Th>
                      <Table.Th aria-label="Thao tác" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.data.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text c="dimmed" ta="center" py="lg">
                            Chưa có người hỗ trợ nào khớp bộ lọc.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {data.data.map((tk) => (
                      <Table.Tr key={tk.id}>
                        <Table.Td fw={600}>{tk.ho_ten}</Table.Td>
                        <Table.Td>
                          <Text fz="sm" ff="monospace">
                            {tk.ten_dang_nhap}
                          </Text>
                        </Table.Td>
                        <Table.Td>{tk.email}</Table.Td>
                        <Table.Td>
                          {tk.cum.length === 0 ? (
                            <Badge color="yellow" variant="light">
                              Chưa phân công
                            </Badge>
                          ) : (
                            <Stack gap={2}>
                              {tk.cum.map((c) => (
                                <Anchor key={c.cum_id} component={Link} to={`/admin/khoa-boi-duong/${c.khoa_id}`} fz="sm">
                                  {c.ten_cum} · {c.ma_khoa}
                                </Anchor>
                              ))}
                            </Stack>
                          )}
                        </Table.Td>
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
                              <ActionIcon variant="subtle" color="gray" aria-label={`Thao tác ${tk.ten_dang_nhap}`}>
                                ⋯
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                onClick={() => {
                                  setDangSua(tk);
                                  setFormSua({ ho_ten: tk.ho_ten, email: tk.email });
                                  setLoiSua({});
                                }}
                              >
                                Sửa
                              </Menu.Item>
                              <Menu.Item onClick={() => xuLyGuiEmail(tk)}>Gửi email kích hoạt</Menu.Item>
                              <Menu.Item onClick={() => setXacNhan({ loai: 'cap_mat_khau', tk })}>Cấp mật khẩu tạm</Menu.Item>
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

      <Modal opened={moTao} onClose={() => setMoTao(false)} title="Tạo tài khoản người hỗ trợ" centered>
        <Stack gap="sm">
          <TextInput
            label="Họ tên"
            required
            value={formTao.ho_ten}
            error={loiTao.ho_ten}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFormTao((f) => ({ ...f, ho_ten: v }));
            }}
          />
          <TextInput
            label="Email"
            required
            description="Email công vụ HCMUE — dùng để kích hoạt và tự lấy lại mật khẩu."
            value={formTao.email}
            error={loiTao.email}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFormTao((f) => ({ ...f, email: v }));
            }}
          />
          <TextInput
            label="Tên đăng nhập"
            description="Chữ thường không dấu, số, dấu . _ - (3–50 ký tự). Bỏ trống = phần trước @ của email."
            placeholder={tenGoiY || undefined}
            value={formTao.ten_dang_nhap}
            error={loiTao.ten_dang_nhap}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFormTao((f) => ({ ...f, ten_dang_nhap: v }));
            }}
          />
          <Radio.Group
            label="Cách cấp mật khẩu"
            value={formTao.cach_cap}
            onChange={(v) => setFormTao((f) => ({ ...f, cach_cap: v as FormTao['cach_cap'] }))}
          >
            <Stack gap={6} mt={4}>
              <Radio value="email" label="Gửi email kích hoạt" />
              <Radio value="mat_khau_tam" label="Sinh mật khẩu tạm" />
            </Stack>
          </Radio.Group>
          <Button
            mt="sm"
            loading={taoTk.isPending}
            disabled={!formTao.ho_ten.trim() || !formTao.email.trim()}
            onClick={xuLyTao}
            fullWidth
          >
            Tạo tài khoản
          </Button>
        </Stack>
      </Modal>

      <Modal opened={dangSua !== null} onClose={() => setDangSua(null)} title="Sửa tài khoản" centered>
        {dangSua && (
          <Stack gap="sm">
            <Text fz="sm" c="dimmed" ff="monospace">
              {dangSua.ten_dang_nhap}
            </Text>
            <TextInput
              label="Họ tên"
              value={formSua.ho_ten}
              error={loiSua.ho_ten}
              onChange={(e) => {
                const v = e.currentTarget.value;
                setFormSua((f) => ({ ...f, ho_ten: v }));
              }}
            />
            <TextInput
              label="Email"
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
