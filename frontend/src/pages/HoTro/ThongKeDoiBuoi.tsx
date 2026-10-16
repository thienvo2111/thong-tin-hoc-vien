import { useState, type MouseEvent } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  nhanDaXuLy,
  useChiTietBuoiThongKe,
  useThongKeDoiBuoi,
  xuatThongKeDoiBuoi,
  type DongThongKeDoiBuoi,
  type HocVienDongThongKe,
  type LocThongKeDoiBuoi,
  type ThongKeDoiBuoi as KetQua,
} from '@/api/doiBuoi';
import type { LoaiLop, MucNangLuc } from '@/api/types';
import { StatusBanner } from '@/components/StatusBanner';
import { dayjs, dinhDangGio, dinhDangNgayGio, dinhDangThuNgay } from '@/lib/ngay';
import { NHAN_MUC_NANG_LUC } from '@/lib/mucNangLuc';
import { thongDiepLoiXungDot } from '@/lib/loiApi';

const NHAN_LOAI_LOP: Record<LoaiLop, string> = { truc_tiep: 'Trực tiếp', zoom: 'Zoom', vle: 'VLE' };
const MUC_OPTIONS = (Object.keys(NHAN_MUC_NANG_LUC) as MucNangLuc[]).map((m) => ({
  value: m,
  label: NHAN_MUC_NANG_LUC[m],
}));
const LOAI_OPTIONS = (Object.keys(NHAN_LOAI_LOP) as LoaiLop[]).map((m) => ({ value: m, label: NHAN_LOAI_LOP[m] }));
const BO_LOC_RONG: KetQua['bo_loc'] = { khoa: [], giai_doan: [], lop: [], cum: [] };

/** "Thứ sáu, 20/11" theo giờ Việt Nam (gọn hơn dinhDangThuNgay — bảng nhiều dòng). */
function thuNgayGon(iso: string): string {
  const s = dayjs.utc(iso).tz('Asia/Ho_Chi_Minh').format('dddd, DD/MM');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function gioBuoi(bd: string, kt: string | null): string {
  return `${dinhDangGio(bd)}${kt ? `–${dinhDangGio(kt)}` : ''}`;
}

/** Tab Thống kê của màn Đổi buổi — mỗi dòng 1 buổi học có đề nghị đổi ra/vào. */
export default function ThongKeDoiBuoi() {
  const [loc, setLoc] = useState<LocThongKeDoiBuoi>({});
  const [chon, setChon] = useState<DongThongKeDoiBuoi | null>(null);
  const { data, isLoading, isError, error } = useThongKeDoiBuoi(loc);
  const doi = (p: Partial<LocThongKeDoiBuoi>) => setLoc((l) => ({ ...l, ...p }));

  return (
    <Stack gap="sm">
      <BoLoc loc={loc} bo={data?.bo_loc ?? BO_LOC_RONG} doi={doi} />
      {isError && <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>}
      {isLoading && <Loader size="sm" />}
      {data && (
        <>
          {data.gioi_han && (
            <StatusBanner loai="info">
              Dữ liệu vượt giới hạn (1.000 buổi / 20.000 đề nghị) — số liệu đã bị cắt bớt, hãy thu hẹp bộ lọc.
            </StatusBanner>
          )}
          <OTong tong={data.tong} />
          {data.dong.length === 0 ? (
            <Text fz="sm" c="dimmed">
              Không có buổi nào có đề nghị đổi theo bộ lọc.
            </Text>
          ) : (
            <BangBuoi dong={data.dong} onChon={setChon} />
          )}
        </>
      )}
      {chon && <ModalChiTiet key={chon.lich.id} dong={chon} loc={loc} onDong={() => setChon(null)} />}
    </Stack>
  );
}

function BoLoc({
  loc,
  bo,
  doi,
}: {
  loc: LocThongKeDoiBuoi;
  bo: KetQua['bo_loc'];
  doi: (p: Partial<LocThongKeDoiBuoi>) => void;
}) {
  const [dangXuat, setDangXuat] = useState(false);
  const cuaKhoa = <T extends { khoa_id: string }>(ds: T[]) =>
    loc.khoa_id ? ds.filter((x) => x.khoa_id === loc.khoa_id) : ds;
  const w = { base: '100%', xs: 180 };
  const maKhoa = new Map(bo.khoa.map((k) => [k.id, k.ma_khoa]));
  const mang = (v: string[]) => (v.length ? v : undefined);

  async function xuat() {
    setDangXuat(true);
    try {
      await xuatThongKeDoiBuoi(loc);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiXungDot(e) });
    } finally {
      setDangXuat(false);
    }
  }

  return (
    <Group gap="xs" align="flex-end" wrap="wrap">
      <Select
        label="Khóa"
        size="xs"
        w={w}
        clearable
        data={bo.khoa.map((k) => ({ value: k.id, label: k.ten_khoa }))}
        value={loc.khoa_id ?? null}
        onChange={(v) => doi({ khoa_id: v ?? undefined, giai_doan_id: undefined, lop_id: undefined })}
      />
      <Select
        label="Giai đoạn"
        size="xs"
        w={w}
        clearable
        data={cuaKhoa(bo.giai_doan).map((g) => ({
          value: g.id,
          // Chưa chọn khóa: nhiều khóa cùng "GĐ1" → thêm mã khóa để phân biệt.
          label: `${loc.khoa_id ? '' : `${maKhoa.get(g.khoa_id) ?? ''} · `}GĐ${g.thu_tu} – ${g.ten_giai_doan}`,
        }))}
        value={loc.giai_doan_id ?? null}
        onChange={(v) => doi({ giai_doan_id: v ?? undefined })}
      />
      <MultiSelect
        label="Lớp"
        size="xs"
        w={w}
        clearable
        searchable
        data={cuaKhoa(bo.lop).map((l) => ({ value: l.id, label: l.ten_lop }))}
        value={loc.lop_id ?? []}
        onChange={(v) => doi({ lop_id: mang(v) })}
      />
      <MultiSelect
        label="Trình độ"
        size="xs"
        w={w}
        clearable
        data={MUC_OPTIONS}
        value={loc.muc_nang_luc ?? []}
        onChange={(v) => doi({ muc_nang_luc: mang(v) as MucNangLuc[] | undefined })}
      />
      <MultiSelect
        label="Hình thức"
        size="xs"
        w={w}
        clearable
        data={LOAI_OPTIONS}
        value={loc.loai_lop ?? []}
        onChange={(v) => doi({ loai_lop: mang(v) as LoaiLop[] | undefined })}
      />
      {bo.cum.length > 1 && (
        <MultiSelect
          label="Cụm"
          size="xs"
          w={w}
          clearable
          searchable
          data={bo.cum.map((c) => ({ value: c.id, label: c.ten_cum }))}
          value={loc.cum_id ?? []}
          onChange={(v) => doi({ cum_id: mang(v) })}
        />
      )}
      <TextInput
        type="date"
        label="Từ ngày"
        size="xs"
        w={{ base: '48%', xs: 140 }}
        value={loc.tu_ngay ?? ''}
        onChange={(e) => doi({ tu_ngay: e.currentTarget.value || undefined })}
      />
      <TextInput
        type="date"
        label="Đến ngày"
        size="xs"
        w={{ base: '48%', xs: 140 }}
        value={loc.den_ngay ?? ''}
        onChange={(e) => doi({ den_ngay: e.currentTarget.value || undefined })}
      />
      <Switch
        size="xs"
        label="Chỉ buổi có đề nghị chờ"
        checked={!!loc.chi_co_cho}
        onChange={(e) => doi({ chi_co_cho: e.currentTarget.checked || undefined })}
        pb={6}
      />
      <Button size="xs" variant="light" onClick={xuat} loading={dangXuat}>
        Xuất Excel
      </Button>
    </Group>
  );
}

function OTong({ tong }: { tong: KetQua['tong'] }) {
  const o: [string, number, string?][] = [
    ['Tổng đề nghị', tong.de_nghi],
    ['Chờ duyệt', tong.cho_duyet, 'blue'],
    ['Quá hạn', tong.qua_han, 'orange'],
    ['Đã duyệt', tong.da_duyet, 'green'],
    ['Từ chối', tong.tu_choi, 'red'],
    ['Đã hủy', tong.da_huy, 'gray'],
    ['Buổi đã đầy', tong.so_buoi_day, 'red'],
  ];
  return (
    <SimpleGrid cols={{ base: 2, xs: 4, md: 7 }} spacing="xs" verticalSpacing="xs">
      {o.map(([nhan, so, mau]) => (
        <Paper key={nhan} withBorder radius="sm" px="xs" py={4} role="group" aria-label={nhan}>
          <Text fz={11} c="dimmed" lh={1.3}>
            {nhan}
          </Text>
          <Text fz="md" fw={700} lh={1.3} c={mau ? `${mau}.7` : undefined}>
            {so}
          </Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

const MAU_SO = ['green.7', 'blue.7', 'orange.7', 'red.7', 'gray.7'];

/** 5 số gọn: đã duyệt · chờ · quá hạn · từ chối · hủy (số 0 mờ). */
function NamSo({ nhan, so }: { nhan: string; so: number[] }) {
  return (
    <Text fz="sm" aria-label={nhan} style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {so.map((n, i) => (
        <Text key={i} span fw={n ? 600 : 400} c={n ? MAU_SO[i] : 'dimmed'}>
          {i > 0 ? ' · ' : ''}
          {n}
        </Text>
      ))}
    </Text>
  );
}

function BangBuoi({ dong, onChon }: { dong: DongThongKeDoiBuoi[]; onChon: (d: DongThongKeDoiBuoi) => void }) {
  return (
    <ScrollArea.Autosize mah="calc(100dvh - 260px)" type="auto" offsetScrollbars>
      <Table miw={560} stickyHeader highlightOnHover verticalSpacing={4} horizontalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Buổi</Table.Th>
            <Table.Th>
              Sĩ số
              <Text fz={10} c="dimmed" fw={400}>
                phân lớp → sau đổi / tối đa
              </Text>
            </Table.Th>
            <Table.Th>
              Đổi ra
              <Text fz={10} c="dimmed" fw={400}>
                duyệt · chờ · quá hạn · từ chối · hủy
              </Text>
            </Table.Th>
            <Table.Th>
              Đổi vào
              <Text fz={10} c="dimmed" fw={400}>
                duyệt · chờ · quá hạn · từ chối · hủy
              </Text>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dong.map((d) => {
            const l = d.lich;
            return (
              // Bấm cả dòng cho tiện; nút ở ô đầu là đường bàn phím / trình đọc màn hình.
              <Table.Tr key={l.id} onClick={() => onChon(d)} style={{ cursor: 'pointer' }}>
                <Table.Td>
                  <Anchor
                    component="button"
                    type="button"
                    fz="sm"
                    fw={700}
                    lh={1.3}
                    ta="left"
                    aria-label={`Xem chi tiết ${l.lop.ten_lop} buổi ${l.buoi_so}`}
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      onChon(d);
                    }}
                  >
                    {l.lop.ten_lop}
                  </Anchor>
                  <Text fz="xs" c="dimmed" lh={1.3}>
                    Buổi {l.buoi_so} · {thuNgayGon(l.thoi_gian_bat_dau)} · {gioBuoi(l.thoi_gian_bat_dau, l.thoi_gian_ket_thuc)}
                  </Text>
                  <Group gap={4} mt={2}>
                    {l.lop.muc_nang_luc && (
                      <Badge size="xs" variant="light" tt="none">
                        {NHAN_MUC_NANG_LUC[l.lop.muc_nang_luc]}
                      </Badge>
                    )}
                    <Badge size="xs" variant="light" color="gray" tt="none">
                      {NHAN_LOAI_LOP[l.lop.loai_lop]}
                    </Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text
                    fz="sm"
                    c={d.day ? 'red.7' : undefined}
                    fw={d.day ? 700 : undefined}
                    aria-label={d.day ? 'Sĩ số (đã đầy)' : 'Sĩ số'}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {d.si_so_phan_lop} → {d.si_so} / {d.si_so_toi_da ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NamSo nhan="Đổi ra" so={[d.ra_da_duyet, d.ra_cho, d.ra_qua_han, d.ra_tu_choi, d.ra_huy]} />
                </Table.Td>
                <Table.Td>
                  <NamSo nhan="Đổi vào" so={[d.vao_da_duyet, d.vao_cho, d.vao_qua_han, d.vao_tu_choi, d.vao_huy]} />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </ScrollArea.Autosize>
  );
}

function ModalChiTiet({ dong, loc, onDong }: { dong: DongThongKeDoiBuoi; loc: LocThongKeDoiBuoi; onDong: () => void }) {
  const l = dong.lich;
  const { data, isLoading, isError, error } = useChiTietBuoiThongKe(l.id, loc);
  return (
    <Modal
      opened
      onClose={onDong}
      size="lg"
      title={`Buổi ${l.buoi_so} · ${l.lop.ten_lop}`}
    >
      <Text fz="xs" c="dimmed" mb="xs">
        {dinhDangThuNgay(l.thoi_gian_bat_dau)} · {gioBuoi(l.thoi_gian_bat_dau, l.thoi_gian_ket_thuc)}
      </Text>
      {/* Tiêu đề 1 dòng + dòng ngày: chừa 220px để cả cửa sổ không vượt màn hình điện thoại (không 2 thanh cuộn). */}
      <ScrollArea.Autosize mah="calc(100dvh - 220px)" type="auto" offsetScrollbars>
        {isLoading && <Loader size="sm" />}
        {isError && <StatusBanner loai="error">{thongDiepLoiXungDot(error)}</StatusBanner>}
        {data && (
          <Stack gap="md">
            <DanhSachHocVien tieuDe="Đổi ra" nhanBuoi="Sang" ds={data.ra} />
            <DanhSachHocVien tieuDe="Đổi vào" nhanBuoi="Từ" ds={data.vao} />
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Modal>
  );
}

function DanhSachHocVien({ tieuDe, nhanBuoi, ds }: { tieuDe: string; nhanBuoi: string; ds: HocVienDongThongKe[] }) {
  const nhan = `${tieuDe} (${ds.length})`;
  return (
    <Box component="section" aria-label={nhan}>
      <Text fw={700} fz="sm" mb={4}>
        {nhan}
      </Text>
      {ds.length === 0 ? (
        <Text fz="xs" c="dimmed">
          Không có.
        </Text>
      ) : (
        <Stack gap={4}>
          {ds.map((h) => (
            <Paper key={h.de_nghi_id} withBorder radius="sm" px="xs" py={4}>
              <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                <Text fz="sm" fw={600} lh={1.3}>
                  {h.ho_ten}
                </Text>
                <Badge
                  size="xs"
                  variant="light"
                  tt="none"
                  color={h.trang_thai === 'da_duyet' ? 'green' : h.trang_thai === 'cho_duyet' ? 'blue' : 'gray'}
                  styles={{ root: { height: 'auto', whiteSpace: 'normal', textAlign: 'right' } }}
                >
                  {h.qua_han ? 'Chờ duyệt (quá hạn)' : nhanDaXuLy(h)}
                </Badge>
              </Group>
              <Text fz="xs" c="dimmed" lh={1.3}>
                {h.don_vi}
                {h.cum ? ` · ${h.cum}` : ''}
              </Text>
              {h.buoi_kia && (
                <Text fz="xs" lh={1.3}>
                  {nhanBuoi}: {h.buoi_kia.lop.ten_lop} · Buổi {h.buoi_kia.buoi_so} ·{' '}
                  {dinhDangThuNgay(h.buoi_kia.thoi_gian_bat_dau)} ·{' '}
                  {gioBuoi(h.buoi_kia.thoi_gian_bat_dau, h.buoi_kia.thoi_gian_ket_thuc)}
                </Text>
              )}
              <Text fz={11} c="dimmed" lh={1.3}>
                Gửi {dinhDangNgayGio(h.tao_luc)}
                {h.xu_ly_luc ? ` · Xử lý ${dinhDangNgayGio(h.xu_ly_luc)}` : ''}
              </Text>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
