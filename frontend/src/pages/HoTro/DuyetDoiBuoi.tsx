import { useState, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Paper,
  Radio,
  ScrollArea,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  nhanDaXuLy,
  useDsDoiBuoi,
  useDuyetDoiBuoi,
  useHuyDuyetDoiBuoi,
  useLuaChonDuyet,
  useTuChoiDoiBuoi,
  type BuoiTomTat,
  type DeNghiDuyet,
  type LuaChonDuyet,
} from '@/api/doiBuoi';
import { useToi } from '@/auth/AuthContext';
import { StatusBanner } from '@/components/StatusBanner';
import { ThanhSiSo } from '@/components/ThanhSiSo';
import { dinhDangGio, dinhDangNgayGio, dinhDangThuNgay } from '@/lib/ngay';
import { thongDiepLoiXungDot } from '@/lib/loiApi';
import ThongKeDoiBuoi from './ThongKeDoiBuoi';

const GHI_CHU_TOI_THIEU = 5;
const GHI_CHU_TOI_DA = 500;
const GIOI_HAN_DANH_SACH = 500; // khớp take: 500 của server
const GIOI_HAN_QUA_HAN = 100; // khớp take: 100 của server khi qua_han=true

/** Khối 1 buổi, gọn 2 dòng: [nhãn] tên lớp / Buổi n · thứ-ngày · giờ (+ dòng phụ nhỏ). */
function KhoiBuoi({
  nhan,
  b,
  mau,
  phu,
}: {
  nhan: string;
  b: BuoiTomTat | null;
  mau: string;
  phu?: ReactNode;
}) {
  return (
    <Paper
      role="group"
      aria-label={nhan}
      radius="sm"
      px="xs"
      py={6}
      bg={`${mau}.0`}
      style={{ borderLeft: `3px solid var(--mantine-color-${mau}-6)` }}
    >
      <Text fz="sm" lh={1.35}>
        <Text span fz={11} fw={700} c={`${mau}.8`} tt="uppercase" mr={6}>
          {nhan}
        </Text>
        {b ? <b>{b.lop.ten_lop}</b> : '—'}
      </Text>
      {b && (
        <Text fz="xs" lh={1.35}>
          <b>Buổi {b.buoi_so}</b> · {dinhDangThuNgay(b.thoi_gian_bat_dau)} · {dinhDangGio(b.thoi_gian_bat_dau)}
          {b.thoi_gian_ket_thuc ? `–${dinhDangGio(b.thoi_gian_ket_thuc)}` : ''}
        </Text>
      )}
      {phu && (
        <Box mt={2} fz="xs" c="dimmed" lh={1.35}>
          {phu}
        </Box>
      )}
    </Paper>
  );
}

/** Buổi gốc → buổi đích, 2 cột trên màn rộng, xếp dọc trên điện thoại. */
function HaiBuoi({
  goc,
  dich,
  nhanDich,
  phuDich,
}: {
  goc: BuoiTomTat | null;
  dich: BuoiTomTat | null;
  nhanDich: string;
  phuDich?: ReactNode;
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" verticalSpacing={6}>
      <KhoiBuoi nhan="Buổi gốc" b={goc} mau="gray" />
      <KhoiBuoi nhan={nhanDich} b={dich} mau="blue" phu={phuDich} />
    </SimpleGrid>
  );
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
            <Tabs.Tab value="thong_ke">Thống kê</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="cho_duyet" pt="md">
            <Stack gap="lg">
              <DanhSach chiChoDuyet hanhDong={hanhDong} />
              <DanhSachQuaHan hanhDong={hanhDong} />
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="da_xu_ly" pt="md">
            <DanhSach chiChoDuyet={false} hanhDong={hanhDong} />
          </Tabs.Panel>
          <Tabs.Panel value="thong_ke" pt="md">
            <ThongKeDoiBuoi />
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
      {ds.length >= GIOI_HAN_DANH_SACH && (
        <StatusBanner loai="info">
          {chiChoDuyet
            ? `Chỉ hiển thị ${GIOI_HAN_DANH_SACH} đề nghị chờ duyệt gửi sớm nhất — xử lý bớt để thấy các đề nghị sau`
            : `Chỉ hiển thị ${GIOI_HAN_DANH_SACH} đề nghị xử lý gần nhất`}
        </StatusBanner>
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

/** Đề nghị chờ duyệt đã quá hạn (buổi nguồn hoặc buổi đề nghị đã bắt đầu) — tách riêng, chỉ còn Từ chối. */
function DanhSachQuaHan({ hanhDong }: { hanhDong: HanhDong }) {
  const { data } = useDsDoiBuoi({ trang_thai: 'cho_duyet', qua_han: true });
  const ds = data ?? [];
  if (ds.length === 0) return null;
  return (
    <Stack gap="sm" data-testid="khoi-qua-han">
      <Text fw={700} fz="sm">
        Quá hạn ({ds.length}
        {ds.length >= GIOI_HAN_QUA_HAN ? '+' : ''}) — buổi đã bắt đầu, chỉ còn từ chối
      </Text>
      {ds.length >= GIOI_HAN_QUA_HAN && (
        <StatusBanner loai="info">Chỉ hiển thị {GIOI_HAN_QUA_HAN} đề nghị quá hạn gửi gần nhất</StatusBanner>
      )}
      {ds.map((d) => (
        <DongChoDuyet key={d.id} d={d} hanhDong={hanhDong} />
      ))}
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
            {d.doi_lai_tu && (
              <Badge color="violet" variant="light">
                Đổi lại
              </Badge>
            )}
            {d.thu_tu_hang && (
              <Badge variant="light" aria-label="Thứ tự gửi">
                {d.thu_tu_hang.k}/{d.thu_tu_hang.n}
              </Badge>
            )}
          </Group>
        </Group>
        {d.doi_lai_tu && <KhoiBuoi nhan="Đang học" b={d.doi_lai_tu} mau="green" />}
        <HaiBuoi
          goc={d.buoi_nguon}
          dich={d.buoi_de_nghi}
          nhanDich="Xin đổi sang"
          phuDich={
            <Group gap={6} wrap="nowrap">
              <span>Sĩ số buổi:</span>
              <ThanhSiSo siSo={d.si_so} toiDa={d.si_so_toi_da} cho={d.so_cho_duyet} w={110} />
            </Group>
          }
        />
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
  // Hủy do học viên / bị thay bởi đổi lại: ghi chú là chữ hệ thống tự đặt, đã thể hiện ở nhãn — không lặp lại.
  const hocVienHuy = d.ly_do_huy === 'hoc_vien_sua' || d.ly_do_huy === 'hoc_vien_huy' || d.ly_do_huy === 'thay_the';
  return (
    <Paper withBorder radius="md" p="md" data-testid="de-nghi-da-xu-ly">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <ThongTinHocVien d={d} />
          <Badge
            variant="light"
            color={d.trang_thai === 'da_duyet' ? 'green' : 'gray'}
            tt="none"
            styles={{ root: { height: 'auto', whiteSpace: 'normal', textAlign: 'right' } }}
          >
            {nhanDaXuLy(d)}
          </Badge>
        </Group>
        <HaiBuoi
          goc={d.buoi_nguon}
          dich={d.buoi_chot ?? d.buoi_de_nghi}
          nhanDich={d.buoi_chot ? 'Buổi đã chốt' : 'Đã xin đổi sang'}
        />
        <Text fz="xs" c="dimmed">
          {d.nguoi_xu_ly && d.ly_do_huy !== 'huy_duyet' ? `Xử lý bởi ${d.nguoi_xu_ly}` : ''}
          {d.ghi_chu_xu_ly && !hocVienHuy
            ? `${d.nguoi_xu_ly && d.ly_do_huy !== 'huy_duyet' ? ' · ' : ''}Ghi chú: ${d.ghi_chu_xu_ly}`
            : ''}
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
      <Stack gap="sm">
        <KhoiBuoi nhan="Buổi gốc" b={deNghi.buoi_nguon} mau="gray" />
        {deNghi.doi_lai_tu && (
          <Text fz="xs" c="dimmed">
            Duyệt sẽ thay buổi đang học
          </Text>
        )}
        {isLoading && <Loader size="sm" />}
        {isError && <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>}
        {data && (
          <Radio.Group
            label="Chọn buổi chốt"
            value={chonHieuLuc}
            onChange={setChon}
            description={deNghiKhongDuyetDuoc ? 'Buổi đề nghị không duyệt được — chọn buổi khác' : undefined}
          >
            {/* Nhiều buổi lựa chọn: cuộn trong khung, không đẩy cả cửa sổ vượt màn hình. */}
            <ScrollArea.Autosize mah="calc(100dvh - 380px)" mt={6} type="auto" offsetScrollbars>
              <Stack gap={6}>
                {data.map((c) => (
                  <LuaChonDong key={c.lich.id} c={c} laQuanTri={laQuanTri} />
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Radio.Group>
        )}
        <Textarea
          label="Ghi chú (không bắt buộc)"
          value={ghiChu}
          onChange={(e) => setGhiChu(e.currentTarget.value)}
          autosize
          minRows={1}
          maxRows={3}
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
    <Paper withBorder radius="sm" px="xs" py={6}>
      <Radio
        size="xs"
        value={c.lich.id}
        disabled={khoa}
        aria-disabled={khoa}
        label={
          <Stack gap={0}>
            <Text fz="sm" lh={1.35}>
              <b>{c.lich.lop.ten_lop}</b> · Buổi {c.lich.buoi_so} · {dinhDangThuNgay(c.lich.thoi_gian_bat_dau)}{' '}
              {dinhDangGio(c.lich.thoi_gian_bat_dau)}–{dinhDangGio(c.thoi_gian_ket_thuc)}
            </Text>
            <Group gap={6} wrap="wrap" mt={2}>
              <ThanhSiSo siSo={c.si_so} toiDa={c.si_so_toi_da} cho={c.so_cho_duyet} w={90} />
            </Group>
            <Text fz="xs" c="dimmed" lh={1.35}>
              {diaDiem ?? ''}
              {c.so_truoc > 0 ? `${diaDiem ? ' · ' : ''}${c.so_truoc} gửi trước` : ''}
              {khoa && (
                <>
                  {' · '}
                  <Text span fz="xs" c="red" fw={600}>
                    {c.da_du ? 'Đã đủ' : 'Giữ chỗ cho đề nghị gửi trước'}
                  </Text>
                </>
              )}
              {vuot && (
                <>
                  {' · '}
                  <Text span fz="xs" c="yellow.8" fw={600}>
                    Vượt sĩ số / thứ tự — chỉ Quản trị
                  </Text>
                </>
              )}
            </Text>
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
        onSuccess: (res) => {
          notifications.show({
            color: 'green',
            message: laTuChoi ? 'Đã từ chối đề nghị' : 'Đã hủy duyệt đề nghị',
          });
          if ('canh_bao' in res && res.canh_bao.length > 0)
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
          minRows={2}
          maxRows={5}
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
