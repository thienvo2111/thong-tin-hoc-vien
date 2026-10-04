import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Drawer,
  Group,
  Loader,
  Menu,
  Modal,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Timeline,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  useDanhSachTaiKhoanHocVien,
  useDatLaiMatKhauHocVien,
  useDoiTrangThaiTaiKhoanHocVien,
  useMoKhoaTamHocVien,
  useNhatKyHocVien,
} from '@/api/taiKhoanHocVien';
import type { TaiKhoanHocVien, TinhTrangTaiKhoanHocVien, TrangThaiActive } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgayGio } from '@/lib/ngay';
import { chuanHoaNfc } from '@/lib/nfc';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

const TUY_CHON_TRANG_THAI = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'active', label: 'Hoạt động' },
  { value: 'ngung', label: 'Đã khóa' },
];
const TUY_CHON_TINH_TRANG = [
  { value: '', label: 'Tất cả tình trạng' },
  { value: 'tam_khoa', label: 'Đang tạm khóa' },
  { value: 'chua_dang_nhap', label: 'Chưa đăng nhập lần nào' },
  { value: 'phai_doi_mat_khau', label: 'Chưa đổi mật khẩu mặc định' },
];

type LoaiXacNhan = 'dat_lai' | 'khoa' | 'mo_khoa';
type XacNhan = { loai: LoaiXacNhan; tk: TaiKhoanHocVien } | null;

const TIEU_DE_XAC_NHAN: Record<LoaiXacNhan, string> = {
  dat_lai: 'Cấp lại mật khẩu',
  khoa: 'Khóa tài khoản',
  mo_khoa: 'Mở khóa tài khoản',
};
const NUT_XAC_NHAN: Record<LoaiXacNhan, string> = {
  dat_lai: 'Cấp lại mật khẩu',
  khoa: 'Khóa',
  mo_khoa: 'Mở khóa',
};

function dangTamKhoa(tk: TaiKhoanHocVien): boolean {
  return tk.khoa_den !== null && new Date(tk.khoa_den).getTime() > Date.now();
}

function tenHienThi(tk: TaiKhoanHocVien): string {
  return tk.hoc_vien?.ho_ten ?? tk.ten_dang_nhap;
}

function ngaySinh(hv: TaiKhoanHocVien['hoc_vien']): string {
  if (!hv?.nam_sinh) return '—';
  const hai = (n: number | null) => (n ? String(n).padStart(2, '0') : '??');
  return `${hai(hv.ngay_sinh)}/${hai(hv.thang_sinh)}/${hv.nam_sinh}`;
}

/** Trang Tài khoản học viên — tra cứu, cấp lại mật khẩu (về ngày sinh), gỡ tạm khóa, khóa/mở khóa,
 * xem nhật ký đăng nhập. Chỉ quan_tri (route bọc RequireQuanTri). */
export default function AdminTaiKhoanHocVien() {
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [trangThai, setTrangThai] = useState('');
  const [tinhTrang, setTinhTrang] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
      trang_thai: (trangThai || undefined) as TrangThaiActive | undefined,
      tinh_trang: (tinhTrang || undefined) as TinhTrangTaiKhoanHocVien | undefined,
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, trangThai, tinhTrang, page],
  );
  const { data, isLoading, isError, error, isFetching } = useDanhSachTaiKhoanHocVien(params);

  const [xacNhan, setXacNhan] = useState<XacNhan>(null);
  const [xemNhatKy, setXemNhatKy] = useState<TaiKhoanHocVien | null>(null);
  const datLai = useDatLaiMatKhauHocVien();
  const doiTrangThai = useDoiTrangThaiTaiKhoanHocVien();
  const moKhoaTam = useMoKhoaTamHocVien();

  function datBoLoc(setter: (v: string) => void) {
    return (v: string | null) => {
      setter(v ?? '');
      setPage(1);
    };
  }

  const loiChung = (err: unknown) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) });

  function xuLyXacNhan() {
    if (!xacNhan) return;
    const { loai, tk } = xacNhan;
    const bien = { id: tk.id, hocVienId: tk.hoc_vien?.id };
    if (loai === 'dat_lai') {
      datLai.mutate(bien, {
        onSuccess: (kq) => {
          setXacNhan(null);
          notifications.show({ color: 'green', title: `Đã cấp lại mật khẩu cho ${tenHienThi(tk)}`, message: kq.luu_y });
        },
        onError: loiChung,
      });
      return;
    }
    doiTrangThai.mutate(
      { ...bien, trang_thai: loai === 'khoa' ? 'ngung' : 'active' },
      {
        onSuccess: () => {
          setXacNhan(null);
          notifications.show({ color: 'green', message: loai === 'khoa' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản' });
        },
        onError: loiChung,
      },
    );
  }

  function xuLyMoKhoaTam(tk: TaiKhoanHocVien) {
    moKhoaTam.mutate(
      { id: tk.id, hocVienId: tk.hoc_vien?.id },
      {
        onSuccess: () => notifications.show({ color: 'green', message: `Đã gỡ tạm khóa cho ${tenHienThi(tk)}` }),
        onError: loiChung,
      },
    );
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <AdminPageHeader title="Tài khoản học viên" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Tìm theo họ tên, CCCD, SĐT, tên đăng nhập..."
              aria-label="Tìm kiếm"
              value={q}
              onChange={(e) => {
                setQ(e.currentTarget.value);
                setPage(1);
              }}
              w={300}
            />
            <Select aria-label="Trạng thái" data={TUY_CHON_TRANG_THAI} value={trangThai} onChange={datBoLoc(setTrangThai)} allowDeselect={false} w={180} />
            <Select aria-label="Tình trạng" data={TUY_CHON_TINH_TRANG} value={tinhTrang} onChange={datBoLoc(setTinhTrang)} allowDeselect={false} w={240} />
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
                      <Table.Th>Học viên</Table.Th>
                      <Table.Th>Tên đăng nhập</Table.Th>
                      <Table.Th>Đơn vị công tác</Table.Th>
                      <Table.Th>Đăng nhập lần cuối</Table.Th>
                      <Table.Th>Trạng thái</Table.Th>
                      <Table.Th aria-label="Thao tác" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.data.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text c="dimmed" ta="center" py="lg">
                            Không có tài khoản học viên nào khớp bộ lọc.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {data.data.map((tk) => (
                      <DongTaiKhoan
                        key={tk.id}
                        tk={tk}
                        onXacNhan={(loai) => setXacNhan({ loai, tk })}
                        onMoKhoaTam={() => xuLyMoKhoaTam(tk)}
                        onXemNhatKy={() => setXemNhatKy(tk)}
                      />
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

      <Modal opened={xacNhan !== null} onClose={() => setXacNhan(null)} title={xacNhan ? TIEU_DE_XAC_NHAN[xacNhan.loai] : ''} centered>
        {xacNhan && (
          <Stack gap="sm">
            <NoiDungXacNhan loai={xacNhan.loai} tk={xacNhan.tk} />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setXacNhan(null)}>
                Hủy
              </Button>
              <Button
                color={xacNhan.loai === 'khoa' ? 'red' : undefined}
                loading={datLai.isPending || doiTrangThai.isPending}
                onClick={xuLyXacNhan}
              >
                {NUT_XAC_NHAN[xacNhan.loai]}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <DrawerNhatKy tk={xemNhatKy} onDong={() => setXemNhatKy(null)} />
    </>
  );
}

function DongTaiKhoan({
  tk,
  onXacNhan,
  onMoKhoaTam,
  onXemNhatKy,
}: {
  tk: TaiKhoanHocVien;
  onXacNhan: (loai: LoaiXacNhan) => void;
  onMoKhoaTam: () => void;
  onXemNhatKy: () => void;
}) {
  const hv = tk.hoc_vien;
  const tamKhoa = dangTamKhoa(tk);
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm" fw={600}>
          {hv?.ho_ten ?? '—'}
        </Text>
        <Text fz="xs" c="dimmed">
          {hv?.so_dinh_danh_ca_nhan ?? 'Chưa gắn hồ sơ'}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" ff="monospace">
          {tk.ten_dang_nhap}
        </Text>
      </Table.Td>
      <Table.Td>{hv?.don_vi_cong_tac?.ten_don_vi ?? '—'}</Table.Td>
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
        <Group gap={4}>
          <Badge color={tk.trang_thai === 'active' ? 'green' : 'gray'} variant="light">
            {tk.trang_thai === 'active' ? 'Hoạt động' : 'Đã khóa'}
          </Badge>
          {tamKhoa && (
            <Badge color="red" variant="light">
              Tạm khóa đến {dinhDangGio(tk.khoa_den!)}
            </Badge>
          )}
          {tk.phai_doi_mat_khau && (
            <Badge color="orange" variant="light">
              Chưa đổi MK
            </Badge>
          )}
          {tk.so_lan_dang_nhap_sai > 0 && (
            <Badge color="gray" variant="outline">
              Sai MK {tk.so_lan_dang_nhap_sai} lần
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td ta="right">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`Thao tác cho ${tenHienThi(tk)}`}>
              ⋯
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item disabled={!hv} onClick={() => onXacNhan('dat_lai')}>
              Cấp lại mật khẩu
            </Menu.Item>
            {tamKhoa && <Menu.Item onClick={onMoKhoaTam}>Gỡ tạm khóa</Menu.Item>}
            {tk.trang_thai === 'active' ? (
              <Menu.Item color="red" onClick={() => onXacNhan('khoa')}>
                Khóa tài khoản
              </Menu.Item>
            ) : (
              <Menu.Item onClick={() => onXacNhan('mo_khoa')}>Mở khóa tài khoản</Menu.Item>
            )}
            <Menu.Item disabled={!hv} onClick={onXemNhatKy}>
              Xem nhật ký
            </Menu.Item>
            {hv ? (
              <Menu.Item component={Link} to={`/admin/hoc-vien/${hv.id}`}>
                Xem hồ sơ
              </Menu.Item>
            ) : (
              <Menu.Item disabled>Xem hồ sơ</Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

function NoiDungXacNhan({ loai, tk }: { loai: LoaiXacNhan; tk: TaiKhoanHocVien }) {
  if (loai === 'khoa') {
    return (
      <Text fz="sm">
        Khóa tài khoản &quot;{tk.ten_dang_nhap}&quot; của {tenHienThi(tk)}? Học viên bị chặn đăng nhập ngay cho tới khi được mở khóa.
      </Text>
    );
  }
  if (loai === 'mo_khoa') {
    return (
      <Text fz="sm">
        Mở khóa tài khoản &quot;{tk.ten_dang_nhap}&quot; của {tenHienThi(tk)}? Số lần nhập sai và tạm khóa (nếu có) cũng được xóa.
      </Text>
    );
  }
  const hv = tk.hoc_vien;
  return (
    <>
      <Text fz="sm">
        Mật khẩu của &quot;{tk.ten_dang_nhap}&quot; sẽ về <b>ngày sinh dạng ddmmyyyy</b>. Học viên phải đổi mật khẩu khi đăng nhập lần tới.
      </Text>
      <Alert color="yellow" variant="light" title="Xác minh danh tính trước khi cấp lại">
        Hỏi người yêu cầu và đối chiếu họ tên, ngày sinh, đơn vị công tác, số điện thoại.
      </Alert>
      <Table withRowBorders={false} verticalSpacing={4} fz="sm">
        <Table.Tbody>
          <Table.Tr>
            <Table.Th w={130}>Họ tên</Table.Th>
            <Table.Td>{hv?.ho_ten ?? '—'}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Ngày sinh</Table.Th>
            <Table.Td>{ngaySinh(hv)}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Đơn vị</Table.Th>
            <Table.Td>{hv?.don_vi_cong_tac?.ten_don_vi ?? '—'}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Số điện thoại</Table.Th>
            <Table.Td>{hv?.so_dien_thoai_lien_he ?? '—'}</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </>
  );
}

function DrawerNhatKy({ tk, onDong }: { tk: TaiKhoanHocVien | null; onDong: () => void }) {
  const [loc, setLoc] = useState<'tai_khoan' | 'tat_ca'>('tai_khoan');
  const { data, isLoading, isError, error } = useNhatKyHocVien(tk?.hoc_vien?.id, tk !== null);
  const muc = (data?.muc ?? []).filter((m) => loc === 'tat_ca' || m.nhom === 'tai_khoan');

  return (
    <Drawer opened={tk !== null} onClose={onDong} position="right" size="md" title={tk ? `Nhật ký — ${tenHienThi(tk)}` : ''}>
      <Stack gap="md">
        <SegmentedControl
          aria-label="Lọc nhật ký"
          value={loc}
          onChange={(v) => setLoc(v as typeof loc)}
          data={[
            { value: 'tai_khoan', label: 'Tài khoản' },
            { value: 'tat_ca', label: 'Tất cả' },
          ]}
        />
        {isLoading && <Loader size="sm" aria-label="Đang tải nhật ký" />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && muc.length === 0 && (
          <Text c="dimmed" fz="sm">
            Chưa có hoạt động nào được ghi nhận.
          </Text>
        )}
        {muc.length > 0 && (
          <Timeline bulletSize={12} lineWidth={2}>
            {muc.map((m) => (
              <Timeline.Item key={m.id} title={m.tieu_de}>
                <Text fz="xs" c="dimmed">
                  {dinhDangNgayGio(m.thoi_gian)}
                  {m.nguoi_thuc_hien ? ` · ${m.nguoi_thuc_hien}` : ''}
                </Text>
                {m.noi_dung && (
                  <Text fz="sm">
                    {m.truong ? `${m.truong}: ` : ''}
                    {m.noi_dung}
                  </Text>
                )}
                {(m.ip || m.thiet_bi) && (
                  <Text fz="xs" c="dimmed" truncate="end" title={m.thiet_bi ?? undefined}>
                    {[m.ip, m.thiet_bi].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Stack>
    </Drawer>
  );
}
