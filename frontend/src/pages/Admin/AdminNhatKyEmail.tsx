import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  useChiTietHangDoiEmail,
  useDanhSachHangDoiEmail,
  useLichSuEmail,
  useTrangThaiHangDoi,
  type LoaiSuKienThongBao,
  type LocEmailParams,
  type TrangThaiHangDoiEmail,
} from '@/api/thongBao';
import type { PaginatedResult } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { chuanHoaNfc } from '@/lib/nfc';
import { AdminPageHeader } from './AdminPageHeader';

const KICH_THUOC_TRANG = 20;

const NHAN_LOAI_EMAIL: Record<LoaiSuKienThongBao, string> = {
  hoc_vien_xac_nhan: 'Xác nhận hồ sơ',
  hoc_vien_duyet: 'Duyệt hồ sơ',
  khoa_boi_duong_duyet: 'Duyệt khóa bồi dưỡng',
  dang_ky_hoc_phan_lop: 'Phân lớp – lịch học',
  dang_ky_hoc_ket_qua: 'Kết quả học tập',
  yeu_cau_ho_tro_tra_loi: 'Trả lời yêu cầu hỗ trợ',
  yeu_cau_ho_tro_cap_nhat_tra_loi: 'Cập nhật trả lời hỗ trợ',
  email_xac_minh: 'Xác minh email',
  kich_hoat_tai_khoan: 'Kích hoạt tài khoản',
  dat_lai_mat_khau: 'Đặt lại mật khẩu',
  nhac_lich_giang_vien: 'Lịch giảng dạy (giảng viên)',
};

const NHAN_TRANG_THAI: Record<TrangThaiHangDoiEmail, { nhan: string; mau: string }> = {
  cho_gui: { nhan: 'Chờ gửi', mau: 'yellow' },
  thanh_cong: { nhan: 'Đã gửi', mau: 'green' },
  that_bai: { nhan: 'Thất bại', mau: 'red' },
};

const TUY_CHON_LOAI = [
  { value: '', label: 'Tất cả loại email' },
  ...Object.entries(NHAN_LOAI_EMAIL).map(([value, label]) => ({ value, label })),
];

const TUY_CHON_TRANG_THAI_NHAT_KY = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'thanh_cong', label: 'Đã gửi' },
  { value: 'that_bai', label: 'Thất bại' },
];

const TUY_CHON_TRANG_THAI_HANG_DOI = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'cho_gui', label: 'Chờ gửi' },
  { value: 'thanh_cong', label: 'Đã gửi' },
  { value: 'that_bai', label: 'Thất bại' },
];

function TrangThaiEmail({ tt }: { tt: TrangThaiHangDoiEmail }) {
  const { nhan, mau } = NHAN_TRANG_THAI[tt];
  return (
    <Badge color={mau} variant="light">
      {nhan}
    </Badge>
  );
}

function OLoi({ loi }: { loi: string | null }) {
  if (!loi) return <Text fz="sm">—</Text>;
  return (
    <Text fz="xs" c="red" lineClamp={2} maw={260} title={loi}>
      {loi}
    </Text>
  );
}

/** Bộ lọc chung 2 tab: loại, trạng thái, tìm theo email/tiêu đề. Đổi bộ lọc -> về trang 1. */
function useBoLoc() {
  const [q, setQ] = useState('');
  const [qDebounced] = useDebouncedValue(q, 300);
  const [loai, setLoai] = useState('');
  const [trangThai, setTrangThai] = useState('');
  const [page, setPage] = useState(1);
  const params = useMemo<LocEmailParams>(
    () => ({
      q: qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : undefined,
      loai_su_kien: (loai || undefined) as LoaiSuKienThongBao | undefined,
      trang_thai: trangThai || undefined,
      page,
      page_size: KICH_THUOC_TRANG,
    }),
    [qDebounced, loai, trangThai, page],
  );
  const dat = (set: (v: string) => void) => (v: string | null) => {
    set(v ?? '');
    setPage(1);
  };
  return {
    params,
    page,
    setPage,
    q,
    setQ: dat(setQ),
    loai,
    setLoai: dat(setLoai),
    trangThai,
    setTrangThai: dat(setTrangThai),
  };
}

function ThanhLoc({
  boLoc,
  tuyChonTrangThai,
  tong,
}: {
  boLoc: ReturnType<typeof useBoLoc>;
  tuyChonTrangThai: { value: string; label: string }[];
  tong?: number;
}) {
  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder="Tìm theo email hoặc tiêu đề..."
        aria-label="Tìm theo email hoặc tiêu đề"
        value={boLoc.q}
        onChange={(e) => boLoc.setQ(e.currentTarget.value)}
        w={280}
      />
      <Select aria-label="Loại email" data={TUY_CHON_LOAI} value={boLoc.loai} onChange={boLoc.setLoai} allowDeselect={false} w={240} />
      <Select
        aria-label="Trạng thái"
        data={tuyChonTrangThai}
        value={boLoc.trangThai}
        onChange={boLoc.setTrangThai}
        allowDeselect={false}
        w={180}
      />
      <Text fz={12.5} c="dimmed" ml="auto">
        {tong !== undefined ? `${tong.toLocaleString('vi-VN')} email` : ''}
      </Text>
    </Group>
  );
}

/** Khung bảng: tải / lỗi / rỗng / phân trang — dùng chung 2 tab. */
function KhungBang<T>({
  ketQua,
  soCot,
  tieuDe,
  dong,
  page,
  setPage,
}: {
  ketQua: { data?: PaginatedResult<T>; isLoading: boolean; isError: boolean; error: unknown; isFetching: boolean };
  soCot: number;
  tieuDe: ReactNode;
  dong: (r: T) => ReactNode;
  page: number;
  setPage: (p: number) => void;
}) {
  const { data, isLoading, isError, error, isFetching } = ketQua;
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  return (
    <>
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
          <Table.ScrollContainer minWidth={960}>
            <Table verticalSpacing="sm" horizontalSpacing="md" style={{ opacity: isFetching ? 0.6 : 1 }}>
              <Table.Thead>{tieuDe}</Table.Thead>
              <Table.Tbody>
                {data.data.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={soCot}>
                      <Text c="dimmed" ta="center" py="lg">
                        Không có email nào khớp bộ lọc.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {data.data.map(dong)}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
      {data && data.total > data.page_size && (
        <Group justify="space-between">
          <Text fz={12.5} c="dimmed">
            Trang {data.page} / {tongSoTrang}
          </Text>
          <Pagination total={tongSoTrang} value={page} onChange={setPage} size="sm" />
        </Group>
      )}
    </>
  );
}

function TabNhatKyGui() {
  const boLoc = useBoLoc();
  const ketQua = useLichSuEmail(boLoc.params);
  return (
    <Stack gap="md">
      <Text fz="sm" c="dimmed">
        Kết quả gửi cuối cùng của mọi email, kể cả email ưu tiên gửi ngay (xác minh email, đặt lại mật khẩu).
      </Text>
      <ThanhLoc boLoc={boLoc} tuyChonTrangThai={TUY_CHON_TRANG_THAI_NHAT_KY} tong={ketQua.data?.total} />
      <KhungBang
        ketQua={ketQua}
        soCot={6}
        page={boLoc.page}
        setPage={boLoc.setPage}
        tieuDe={
          <Table.Tr>
            <Table.Th>Thời gian</Table.Th>
            <Table.Th>Loại</Table.Th>
            <Table.Th>Người nhận</Table.Th>
            <Table.Th>Tiêu đề</Table.Th>
            <Table.Th>Trạng thái</Table.Th>
            <Table.Th>Lỗi</Table.Th>
          </Table.Tr>
        }
        dong={(r) => (
          <Table.Tr key={r.id}>
            <Table.Td style={{ whiteSpace: 'nowrap' }}>{dinhDangNgayGio(r.gui_luc)}</Table.Td>
            <Table.Td>{NHAN_LOAI_EMAIL[r.loai_su_kien] ?? r.loai_su_kien}</Table.Td>
            <Table.Td>{r.email_nguoi_nhan}</Table.Td>
            <Table.Td>{r.tieu_de}</Table.Td>
            <Table.Td>
              <TrangThaiEmail tt={r.trang_thai} />
            </Table.Td>
            <Table.Td>
              <OLoi loi={r.loi} />
            </Table.Td>
          </Table.Tr>
        )}
      />
    </Stack>
  );
}

function ModalNoiDungEmail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useChiTietHangDoiEmail(id);
  return (
    <Modal opened={!!id} onClose={onClose} title="Nội dung email" size="xl">
      {isLoading && <Skeleton height={300} />}
      {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
      {data && (
        <Stack gap="sm">
          <Group gap="xs" wrap="wrap">
            <TrangThaiEmail tt={data.trang_thai} />
            <Text fz="sm">
              Gửi tới <b>{data.email_nguoi_nhan}</b>
            </Text>
          </Group>
          <Text fw={600}>{data.tieu_de}</Text>
          {/* sandbox rỗng: chặn script/form/điều hướng trong nội dung email. */}
          <iframe
            title="Nội dung email"
            sandbox=""
            srcDoc={data.noi_dung_html}
            style={{ width: '100%', height: 480, border: '1px solid #DEE2E6', borderRadius: 8, background: '#fff' }}
          />
        </Stack>
      )}
    </Modal>
  );
}

function TabHangDoi() {
  const boLoc = useBoLoc();
  const ketQua = useDanhSachHangDoiEmail(boLoc.params);
  const [dangXem, setDangXem] = useState<string | null>(null);
  return (
    <Stack gap="md">
      <Text fz="sm" c="dimmed">
        Email hàng loạt (xác nhận hồ sơ, lịch học, lịch giảng dạy, kích hoạt tài khoản...) — gửi dần mỗi phút theo hạn
        mức ngày, thử lại tối đa 3 lần. Bấm “Xem” để xem nội dung đã gửi.
      </Text>
      <ThanhLoc boLoc={boLoc} tuyChonTrangThai={TUY_CHON_TRANG_THAI_HANG_DOI} tong={ketQua.data?.total} />
      <KhungBang
        ketQua={ketQua}
        soCot={8}
        page={boLoc.page}
        setPage={boLoc.setPage}
        tieuDe={
          <Table.Tr>
            <Table.Th>Tạo lúc / Gửi lúc</Table.Th>
            <Table.Th>Loại</Table.Th>
            <Table.Th>Người nhận</Table.Th>
            <Table.Th>Tiêu đề</Table.Th>
            <Table.Th>Trạng thái</Table.Th>
            <Table.Th>Số lần thử</Table.Th>
            <Table.Th>Lỗi</Table.Th>
            <Table.Th aria-label="Thao tác" />
          </Table.Tr>
        }
        dong={(r) => (
          <Table.Tr key={r.id}>
            <Table.Td style={{ whiteSpace: 'nowrap' }}>
              <Text fz="sm">{dinhDangNgayGio(r.created_at)}</Text>
              <Text fz="xs" c="dimmed">
                {r.gui_luc ? `Gửi ${dinhDangNgayGio(r.gui_luc)}` : 'Chưa gửi'}
              </Text>
            </Table.Td>
            <Table.Td>{NHAN_LOAI_EMAIL[r.loai_su_kien] ?? r.loai_su_kien}</Table.Td>
            <Table.Td>{r.email_nguoi_nhan}</Table.Td>
            <Table.Td>{r.tieu_de}</Table.Td>
            <Table.Td>
              <TrangThaiEmail tt={r.trang_thai} />
            </Table.Td>
            <Table.Td ta="center">{r.so_lan_thu}</Table.Td>
            <Table.Td>
              <OLoi loi={r.loi} />
            </Table.Td>
            <Table.Td>
              <Button size="xs" variant="light" onClick={() => setDangXem(r.id)} aria-label={`Xem email gửi ${r.email_nguoi_nhan}`}>
                Xem
              </Button>
            </Table.Td>
          </Table.Tr>
        )}
      />
      <ModalNoiDungEmail id={dangXem} onClose={() => setDangXem(null)} />
    </Stack>
  );
}

function TheSo({ nhan, so, mau }: { nhan: string; so: number | undefined; mau?: string }) {
  return (
    <Paper withBorder radius={12} p="md">
      <Text fz={12} c="dimmed">
        {nhan}
      </Text>
      <Text fz={22} fw={700} c={mau} aria-label={`${nhan}: ${so ?? ''}`}>
        {so === undefined ? '—' : so.toLocaleString('vi-VN')}
      </Text>
    </Paper>
  );
}

/** Nhật ký email — Quản trị tra soát email đã gửi/đang chờ/thất bại (route bọc RequireQuanTri). */
export default function AdminNhatKyEmail() {
  const [tab, setTab] = useState<string | null>('nhat-ky');
  const tinhTrang = useTrangThaiHangDoi();
  const t = tinhTrang.data;
  return (
    <>
      <AdminPageHeader title="Nhật ký email" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          {tinhTrang.isError && <Alert color="red">{thongDiepLoiChung(tinhTrang.error)}</Alert>}
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="sm">
            <TheSo nhan="Chờ gửi" so={t?.theo_trang_thai.cho_gui} mau="yellow.8" />
            <TheSo nhan="Đã gửi (hàng đợi)" so={t?.theo_trang_thai.thanh_cong} mau="green.8" />
            <TheSo nhan="Thất bại (hàng đợi)" so={t?.theo_trang_thai.that_bai} mau="red.7" />
            <TheSo nhan="Đã gửi hôm nay" so={t?.da_gui_hom_nay} />
            <TheSo nhan="Hạn mức còn lại hôm nay" so={t?.han_muc_con_lai} />
          </SimpleGrid>
          <Tabs value={tab} onChange={setTab} keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="nhat-ky">Nhật ký gửi</Tabs.Tab>
              <Tabs.Tab value="hang-doi">Hàng đợi email</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="nhat-ky">
              <TabNhatKyGui />
            </Tabs.Panel>
            <Tabs.Panel value="hang-doi">
              <TabHangDoi />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </>
  );
}
