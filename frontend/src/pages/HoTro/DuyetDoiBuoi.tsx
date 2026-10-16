import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  Radio,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useDsDoiBuoi,
  useDuyetDoiBuoi,
  useHuyDuyetDoiBuoi,
  useLuaChonDuyet,
  useTuChoiDoiBuoi,
  type BuoiTomTat,
  type DeNghiDuyet,
  type LuaChonDuyet,
  type TrangThaiDeNghi,
} from '@/api/doiBuoi';
import { useToi } from '@/auth/AuthContext';
import { StatusBanner } from '@/components/StatusBanner';
import { dinhDangGio, dinhDangNgayGio } from '@/lib/ngay';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

const GHI_CHU_TOI_THIEU = 5;
const GHI_CHU_TOI_DA = 500;
const GIOI_HAN_DANH_SACH = 500; // khớp take: 500 của server

const NHAN_TRANG_THAI: Record<TrangThaiDeNghi, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_huy: 'Đã hủy',
};

function nhanBuoi(b: BuoiTomTat | null): string {
  if (!b) return '—';
  const gio = b.thoi_gian_ket_thuc
    ? `${dinhDangNgayGio(b.thoi_gian_bat_dau)}–${dinhDangGio(b.thoi_gian_ket_thuc)}`
    : dinhDangNgayGio(b.thoi_gian_bat_dau);
  return `${b.lop.ten_lop} · Buổi ${b.buoi_so} · ${gio}`;
}

function chuanHoa(s: string): string {
  return s.normalize('NFC').trim();
}

function ghiChuHopLe(s: string): boolean {
  const n = chuanHoa(s).length;
  return n >= GHI_CHU_TOI_THIEU && n <= GHI_CHU_TOI_DA;
}

interface HanhDong {
  onDuyet: (d: DeNghiDuyet) => void;
  onTuChoi: (d: DeNghiDuyet) => void;
  onHuyDuyet: (d: DeNghiDuyet) => void;
}

/** Màn duyệt đề nghị đổi buổi — dùng chung cho /ho-tro/doi-buoi (hỗ trợ cụm) và /admin/doi-buoi (Quản trị). */
export default function DuyetDoiBuoi() {
  const [tab, setTab] = useState<string | null>('cho_duyet');
  const [duyet, setDuyet] = useState<DeNghiDuyet | null>(null);
  const [tuChoi, setTuChoi] = useState<DeNghiDuyet | null>(null);
  const [huyDuyet, setHuyDuyet] = useState<DeNghiDuyet | null>(null);
  const hanhDong: HanhDong = {
    onDuyet: setDuyet,
    onTuChoi: setTuChoi,
    onHuyDuyet: setHuyDuyet,
  };

  return (
    <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Title order={1} size="h2">
          Đổi buổi học
        </Title>
        <Tabs value={tab} onChange={setTab} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="cho_duyet">Chờ duyệt</Tabs.Tab>
            <Tabs.Tab value="da_xu_ly">Đã xử lý</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="cho_duyet" pt="md">
            <DanhSach chiChoDuyet hanhDong={hanhDong} />
          </Tabs.Panel>
          <Tabs.Panel value="da_xu_ly" pt="md">
            <DanhSach chiChoDuyet={false} hanhDong={hanhDong} />
          </Tabs.Panel>
        </Tabs>
      </Stack>
      {duyet && <ModalDuyet key={duyet.id} deNghi={duyet} onDong={() => setDuyet(null)} />}
      {tuChoi && <ModalGhiChu key={tuChoi.id} kieu="tu_choi" deNghi={tuChoi} onDong={() => setTuChoi(null)} />}
      {huyDuyet && (
        <ModalGhiChu key={huyDuyet.id} kieu="huy_duyet" deNghi={huyDuyet} onDong={() => setHuyDuyet(null)} />
      )}
    </Container>
  );
}

function DanhSach({ chiChoDuyet, hanhDong }: { chiChoDuyet: boolean; hanhDong: HanhDong }) {
  const { data, isLoading, isError, error } = useDsDoiBuoi(
    chiChoDuyet ? { trang_thai: 'cho_duyet' } : { da_xu_ly: true },
  );
  if (isLoading) return <Loader size="sm" />;
  if (isError) return <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>;
  const ds = data ?? [];
  if (ds.length === 0)
    return (
      <Text fz="sm" c="dimmed">
        {chiChoDuyet ? 'Không có đề nghị nào đang chờ duyệt.' : 'Chưa có đề nghị nào đã xử lý.'}
      </Text>
    );
  return (
    <Stack gap="sm">
      {!chiChoDuyet && ds.length >= GIOI_HAN_DANH_SACH && (
        <StatusBanner loai="info">Chỉ hiển thị {GIOI_HAN_DANH_SACH} đề nghị xử lý gần nhất</StatusBanner>
      )}
      {ds.map((d) =>
        chiChoDuyet ? (
          <DongChoDuyet key={d.id} d={d} hanhDong={hanhDong} />
        ) : (
          <DongDaXuLy key={d.id} d={d} hanhDong={hanhDong} />
        ),
      )}
    </Stack>
  );
}

function ThongTinHocVien({ d }: { d: DeNghiDuyet }) {
  return (
    <Stack gap={0}>
      <Text fw={700} fz="sm">
        {d.hoc_vien.ho_ten}
      </Text>
      <Text fz="xs" c="dimmed">
        {d.hoc_vien.don_vi}
        {d.hoc_vien.cum ? ` · ${d.hoc_vien.cum}` : ''}
      </Text>
    </Stack>
  );
}

function DongChoDuyet({ d, hanhDong }: { d: DeNghiDuyet; hanhDong: HanhDong }) {
  return (
    <Paper withBorder radius="md" p="md" data-testid="de-nghi-cho-duyet">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <ThongTinHocVien d={d} />
          <Group gap="xs">
            {d.qua_han && (
              <Badge color="red" variant="light">
                Quá hạn
              </Badge>
            )}
            {d.thu_tu_hang && (
              <Badge variant="light" aria-label="Thứ tự gửi">
                {d.thu_tu_hang.k}/{d.thu_tu_hang.n}
              </Badge>
            )}
          </Group>
        </Group>
        <Text fz="sm">
          {nhanBuoi(d.buoi_nguon)} → {nhanBuoi(d.buoi_de_nghi)}
        </Text>
        <Text fz="sm" c="dimmed">
          Sĩ số buổi đề nghị: {d.si_so}/{d.si_so_toi_da ?? '—'}
          {d.so_cho_duyet > 0 ? ` +${d.so_cho_duyet} đang chờ` : ''}
        </Text>
        <Text fz="sm">Lý do: {d.ly_do}</Text>
        <Text fz="xs" c="dimmed">
          Gửi lúc {dinhDangNgayGio(d.tao_luc)}
        </Text>
        <Group gap="xs">
          {!d.qua_han && (
            <Button size="xs" onClick={() => hanhDong.onDuyet(d)}>
              Duyệt
            </Button>
          )}
          <Button size="xs" variant="default" color="red" onClick={() => hanhDong.onTuChoi(d)}>
            Từ chối
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

/** Hủy duyệt chỉ khi cả buổi chốt lẫn buổi nguồn chưa bắt đầu (server vẫn kiểm lại). */
function huyDuyetDuoc(d: DeNghiDuyet): boolean {
  if (d.trang_thai !== 'da_duyet' || !d.buoi_chot || !d.buoi_nguon) return false;
  const now = Date.now();
  return Date.parse(d.buoi_chot.thoi_gian_bat_dau) > now && Date.parse(d.buoi_nguon.thoi_gian_bat_dau) > now;
}

function DongDaXuLy({ d, hanhDong }: { d: DeNghiDuyet; hanhDong: HanhDong }) {
  return (
    <Paper withBorder radius="md" p="md" data-testid="de-nghi-da-xu-ly">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <ThongTinHocVien d={d} />
          <Badge variant="light" color={d.trang_thai === 'da_duyet' ? 'green' : 'gray'}>
            {NHAN_TRANG_THAI[d.trang_thai]}
          </Badge>
        </Group>
        <Text fz="sm">
          {nhanBuoi(d.buoi_nguon)}
          {d.buoi_chot ? ` → ${nhanBuoi(d.buoi_chot)}` : ''}
        </Text>
        <Text fz="xs" c="dimmed">
          {d.nguoi_xu_ly ? `Xử lý bởi ${d.nguoi_xu_ly}` : ''}
          {d.ghi_chu_xu_ly ? ` · Ghi chú: ${d.ghi_chu_xu_ly}` : ''}
        </Text>
        {huyDuyetDuoc(d) && (
          <Group>
            <Button size="xs" variant="subtle" color="red" onClick={() => hanhDong.onHuyDuyet(d)}>
              Hủy duyệt
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

function ModalDuyet({ deNghi, onDong }: { deNghi: DeNghiDuyet; onDong: () => void }) {
  const { nguoiDung } = useToi();
  const laQuanTri = nguoiDung?.vai_tro === 'quan_tri';
  const { data, isLoading, isError, error } = useLuaChonDuyet(deNghi.id);
  const [chon, setChon] = useState<string>(deNghi.lich_de_nghi_id);
  const deNghiKhongDuyetDuoc =
    !laQuanTri && data?.find((c) => c.lich.id === deNghi.lich_de_nghi_id)?.duyet_duoc === false;
  const chonHieuLuc = deNghiKhongDuyetDuoc && chon === deNghi.lich_de_nghi_id ? '' : chon;
  const [ghiChu, setGhiChu] = useState('');
  const duyet = useDuyetDoiBuoi();

  const chonMuc = data?.find((c) => c.lich.id === chonHieuLuc);
  const chonDuoc = !!chonMuc && (chonMuc.duyet_duoc || laQuanTri);
  const ghiChuCat = chuanHoa(ghiChu);
  const ghiChuSai = ghiChuCat.length > 0 && !ghiChuHopLe(ghiChu);

  function gui() {
    duyet.mutate(
      {
        id: deNghi.id,
        lich_chot_id: chonHieuLuc,
        ...(ghiChuCat ? { ghi_chu: ghiChuCat } : {}),
      },
      {
        onSuccess: (res) => {
          notifications.show({ color: 'green', message: 'Đã duyệt đề nghị' });
          if (res.canh_bao.length > 0)
            notifications.show({
              color: 'yellow',
              autoClose: false,
              title: 'Lưu ý',
              message: res.canh_bao.join('; '),
            });
          onDong();
        },
        onError: (e) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(e) }),
      },
    );
  }

  return (
    <Modal opened onClose={onDong} size="lg" title={`Duyệt đề nghị của ${deNghi.hoc_vien.ho_ten}`}>
      <Stack gap="md">
        <Text fz="sm">Buổi cần đổi: {nhanBuoi(deNghi.buoi_nguon)}</Text>
        {isLoading && <Loader size="sm" />}
        {isError && <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>}
        {data && (
          <Radio.Group
            label="Chọn buổi chốt"
            value={chonHieuLuc}
            onChange={setChon}
            description={deNghiKhongDuyetDuoc ? 'Buổi đề nghị không duyệt được — chọn buổi khác' : undefined}
          >
            <Stack gap="xs" mt="xs">
              {data.map((c) => (
                <LuaChonDong key={c.lich.id} c={c} laQuanTri={laQuanTri} />
              ))}
            </Stack>
          </Radio.Group>
        )}
        <Textarea
          label="Ghi chú (không bắt buộc)"
          value={ghiChu}
          onChange={(e) => setGhiChu(e.currentTarget.value)}
          autosize
          minRows={2}
          maxLength={GHI_CHU_TOI_DA}
          error={ghiChuSai ? `Ghi chú từ ${GHI_CHU_TOI_THIEU} đến ${GHI_CHU_TOI_DA} ký tự` : undefined}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDong}>
            Đóng
          </Button>
          <Button onClick={gui} loading={duyet.isPending} disabled={!chonDuoc || ghiChuSai}>
            Xác nhận duyệt
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function LuaChonDong({ c, laQuanTri }: { c: LuaChonDuyet; laQuanTri: boolean }) {
  const khoa = !c.duyet_duoc && !laQuanTri;
  const vuot = !c.duyet_duoc && laQuanTri;
  const diaDiem = c.diem_hoc ? `${c.diem_hoc.ten}${c.phong ? ` · ${c.phong}` : ''}` : (c.dia_diem_hoac_link ?? c.phong);
  return (
    <Paper withBorder radius="md" p="xs">
      <Radio
        value={c.lich.id}
        disabled={khoa}
        aria-disabled={khoa}
        label={
          <Stack gap={2}>
            <Text fz="sm" fw={600}>
              {c.lich.lop.ten_lop} · Buổi {c.lich.buoi_so}
            </Text>
            <Text fz="xs">
              {dinhDangNgayGio(c.lich.thoi_gian_bat_dau)}–{dinhDangGio(c.thoi_gian_ket_thuc)}
              {diaDiem ? ` · ${diaDiem}` : ''}
            </Text>
            <Text fz="xs" c="dimmed">
              Sĩ số {c.si_so}/{c.si_so_toi_da ?? '—'}
              {c.so_cho_duyet > 0 ? ` +${c.so_cho_duyet} đang chờ` : ''}
              {c.so_truoc > 0 ? ` · ${c.so_truoc} gửi trước` : ''}
            </Text>
            {khoa && (
              <Text fz="xs" c="red">
                {c.da_du ? 'Đã đủ' : 'Giữ chỗ cho đề nghị gửi trước'}
              </Text>
            )}
            {vuot && (
              <Alert color="yellow" p={4} fz="xs">
                Vượt sĩ số / thứ tự — chỉ Quản trị
              </Alert>
            )}
          </Stack>
        }
      />
    </Paper>
  );
}

function ModalGhiChu({
  kieu,
  deNghi,
  onDong,
}: {
  kieu: 'tu_choi' | 'huy_duyet';
  deNghi: DeNghiDuyet;
  onDong: () => void;
}) {
  const [ghiChu, setGhiChu] = useState('');
  const tuChoi = useTuChoiDoiBuoi();
  const huyDuyet = useHuyDuyetDoiBuoi();
  const mut = kieu === 'tu_choi' ? tuChoi : huyDuyet;
  const laTuChoi = kieu === 'tu_choi';

  function gui() {
    mut.mutate(
      { id: deNghi.id, ghi_chu: chuanHoa(ghiChu) },
      {
        onSuccess: () => {
          notifications.show({
            color: 'green',
            message: laTuChoi ? 'Đã từ chối đề nghị' : 'Đã hủy duyệt đề nghị',
          });
          onDong();
        },
        onError: (e) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(e) }),
      },
    );
  }

  return (
    <Modal
      opened
      onClose={onDong}
      title={`${laTuChoi ? 'Từ chối đề nghị' : 'Hủy duyệt đề nghị'} — ${deNghi.hoc_vien.ho_ten}`}
    >
      <Stack gap="md">
        <Textarea
          label="Ghi chú (bắt buộc)"
          description={`Từ ${GHI_CHU_TOI_THIEU} đến ${GHI_CHU_TOI_DA} ký tự; học viên sẽ thấy ghi chú này.`}
          value={ghiChu}
          onChange={(e) => setGhiChu(e.currentTarget.value)}
          autosize
          minRows={3}
          maxLength={GHI_CHU_TOI_DA}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDong}>
            Đóng
          </Button>
          <Button color="red" onClick={gui} loading={mut.isPending} disabled={!ghiChuHopLe(ghiChu)}>
            {laTuChoi ? 'Gửi từ chối' : 'Xác nhận hủy duyệt'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
