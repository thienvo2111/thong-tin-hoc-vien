import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Group,
  Modal,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  type BuoiDiHoc,
  type CheDoDiHoc,
  type ChiTietDiHoc,
  type LocTinhHinhDiHoc,
  type TrangThaiDiemDanh,
  useChiTietDiHoc,
  useDiemDanhBoSung,
  useKhoaDiHoc,
  useTinhHinhDiHoc,
  xuatTinhHinhDiHoc,
} from '@/api/tinhHinhDiHoc';
import { SelectDonViTimKiem } from '@/components/SelectDonViTimKiem';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { dinhDangGio, dinhDangNgayGio } from '@/lib/ngay';
import { taiFileTuBlob } from '@/lib/taiFile';
import { NHAN_LOAI_LOP } from './HoTroLop';
import { MAU_DIEM_DANH } from './HoTroLopChiTiet';

const KICH_THUOC_TRANG = 20;

const NHAN_TRANG_THAI: Record<TrangThaiDiemDanh, string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  vang_co_phep: 'Vắng có phép',
};

// Bộ lọc nằm trên URL (giữ khi tải lại / gửi link). q gõ tự do nên debounce trước khi ghi URL.
const KHOA_URL = [
  'khoa_id',
  'q',
  'don_vi_cong_tac_id',
  'cum_id',
  'lop_id',
  'co_vang',
  'chua_diem_danh',
  'page',
] as const;

/**
 * Tình hình đi học (ADR 0010): tra cứu học viên theo khóa với tổng có mặt / vắng / chưa điểm danh theo
 * buổi hiệu dụng, xem từng buổi và điểm danh bổ sung. Dùng chung cho người hỗ trợ học viên (`/ho-tro/di-hoc`)
 * và Quản trị (`/admin/di-hoc`, cheDo="admin").
 */
export default function HoTroTinhHinhDiHoc({ cheDo = 'ho_tro' }: { cheDo?: CheDoDiHoc }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const lay = (k: (typeof KHOA_URL)[number]) => searchParams.get(k) ?? '';
  const khoaId = lay('khoa_id');
  const page = Number(lay('page')) || 1;
  const [q, setQ] = useState(lay('q'));
  const [qDebounced] = useDebouncedValue(q, 400);
  const [dangXem, setDangXem] = useState<string | null>(null);
  const [dangXuat, setDangXuat] = useState(false);
  const nhoMan = useMediaQuery('(max-width: 48em)');

  const khoa = useKhoaDiHoc(cheDo);
  const khoaChon = khoa.data?.find((k) => k.khoa_id === khoaId);

  function datLoc(thayDoi: Partial<Record<(typeof KHOA_URL)[number], string>>, giuTrang = false) {
    setSearchParams(
      (cu) => {
        const next = new URLSearchParams(cu);
        for (const [k, v] of Object.entries(thayDoi)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!giuTrang) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  // Chưa chọn khóa: mặc định khóa đầu tiên trong danh sách.
  const khoaDau = khoa.data?.[0]?.khoa_id;
  useEffect(() => {
    if (!khoaId && khoaDau) datLoc({ khoa_id: khoaDau });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoaId, khoaDau]);

  useEffect(() => {
    const moi = qDebounced.trim() ? chuanHoaNfc(qDebounced.trim()) : '';
    if (moi !== (searchParams.get('q') ?? '')) datLoc({ q: moi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced]);

  const params: LocTinhHinhDiHoc | null = useMemo(
    () =>
      khoaId
        ? {
            khoa_id: khoaId,
            q: searchParams.get('q') || undefined,
            don_vi_cong_tac_id: searchParams.get('don_vi_cong_tac_id') || undefined,
            cum_id: searchParams.get('cum_id') || undefined,
            lop_id: searchParams.get('lop_id') || undefined,
            co_vang: searchParams.get('co_vang') === 'true' || undefined,
            chua_diem_danh: searchParams.get('chua_diem_danh') === 'true' || undefined,
            page,
            page_size: KICH_THUOC_TRANG,
          }
        : null,
    [khoaId, searchParams, page],
  );
  const { data, isLoading, isError, error, isFetching } = useTinhHinhDiHoc(cheDo, params);

  async function xuat() {
    if (!params) return;
    setDangXuat(true);
    try {
      const blob = await xuatTinhHinhDiHoc(cheDo, params);
      const ngay = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      taiFileTuBlob(blob, `tinh-hinh-di-hoc-${ngay}.xlsx`);
    } catch (err) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
    } finally {
      setDangXuat(false);
    }
  }

  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Tình hình đi học</Title>
          <Button variant="default" onClick={xuat} loading={dangXuat} disabled={!data || data.total === 0}>
            Xuất Excel
          </Button>
        </Group>

        {khoa.isError && <Alert color="red">{thongDiepLoiChung(khoa.error)}</Alert>}
        {khoa.data && khoa.data.length === 0 && (
          <Alert color="yellow" variant="light">
            {cheDo === 'ho_tro'
              ? 'Thầy/Cô chưa được gắn cụm hoặc lớp nào có học viên. Liên hệ Quản trị để được phân công.'
              : 'Chưa có khóa nào có học viên ghi danh.'}
          </Alert>
        )}

        <Group gap="sm" wrap="wrap" align="flex-end">
          <Select
            aria-label="Khóa"
            placeholder="Chọn khóa"
            data={(khoa.data ?? []).map((k) => ({ value: k.khoa_id, label: `${k.ma_khoa} · ${k.ten_khoa}` }))}
            value={khoaId || null}
            onChange={(v) => datLoc({ khoa_id: v ?? '', cum_id: '', lop_id: '' })}
            allowDeselect={false}
            w={{ base: '100%', sm: 280 }}
          />
          <TextInput
            aria-label="Tìm kiếm"
            placeholder="Họ tên hoặc mã MOET"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            w={{ base: '100%', sm: 240 }}
          />
          <SelectDonViTimKiem
            aria-label="Trường"
            placeholder="Trường (gõ để tìm)"
            value={lay('don_vi_cong_tac_id') || null}
            onChange={(id) => datLoc({ don_vi_cong_tac_id: id ?? '' })}
            w={nhoMan ? '100%' : 260}
          />
          <Select
            aria-label="Cụm"
            placeholder={cheDo === 'ho_tro' ? 'Mọi cụm/lớp của tôi' : 'Tất cả cụm'}
            data={(khoaChon?.cum ?? []).map((c) => ({ value: c.id, label: c.ten_cum }))}
            value={lay('cum_id') || null}
            onChange={(v) => datLoc({ cum_id: v ?? '' })}
            clearable
            w={{ base: '100%', sm: 200 }}
          />
          <Select
            aria-label="Lớp"
            placeholder="Tất cả lớp"
            data={(khoaChon?.lop ?? []).map((l) => ({
              value: l.id,
              label: `${NHAN_LOAI_LOP[l.loai_lop]} · ${l.ten_lop}`,
            }))}
            value={lay('lop_id') || null}
            onChange={(v) => datLoc({ lop_id: v ?? '' })}
            clearable
            searchable
            w={{ base: '100%', sm: 220 }}
          />
        </Group>
        <Group gap="lg" wrap="wrap">
          <Checkbox
            label="Có buổi vắng"
            checked={lay('co_vang') === 'true'}
            onChange={(e) => datLoc({ co_vang: e.currentTarget.checked ? 'true' : '' })}
          />
          <Checkbox
            label="Có buổi chưa điểm danh"
            checked={lay('chua_diem_danh') === 'true'}
            onChange={(e) => datLoc({ chua_diem_danh: e.currentTarget.checked ? 'true' : '' })}
          />
          <Text fz={12.5} c="dimmed" ml="auto">
            {data ? `${data.total.toLocaleString('vi-VN')} học viên` : ''}
          </Text>
        </Group>

        <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
          {(isLoading || khoa.isLoading) && (
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
            <Table.ScrollContainer minWidth={980}>
              <Table
                verticalSpacing="sm"
                horizontalSpacing="md"
                highlightOnHover
                style={{ opacity: isFetching ? 0.6 : 1 }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Họ tên</Table.Th>
                    <Table.Th>Mã MOET</Table.Th>
                    <Table.Th>Trường</Table.Th>
                    <Table.Th>Cụm</Table.Th>
                    <Table.Th>Lớp</Table.Th>
                    <Table.Th>Có mặt/đã diễn ra</Table.Th>
                    <Table.Th>Vắng</Table.Th>
                    <Table.Th>Có phép</Table.Th>
                    <Table.Th>Báo vắng</Table.Th>
                    <Table.Th>Chưa điểm danh</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={10}>
                        <Text c="dimmed" ta="center" py="lg">
                          Không có học viên nào khớp bộ lọc.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {data.data.map((h) => (
                    <Table.Tr
                      key={h.dang_ky_hoc_id}
                      onClick={() => setDangXem(h.dang_ky_hoc_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <Anchor component="button" type="button" fw={600} fz="sm" ta="left">
                          {h.ho_ten}
                        </Anchor>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" ff="monospace">
                          {h.ma_dinh_danh_moet ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>{h.don_vi_cong_tac_ten}</Table.Td>
                      <Table.Td>{h.cum ?? '—'}</Table.Td>
                      <Table.Td>
                        <Text fz="xs">
                          {h.lop_theo_giai_doan.map((l) => `GĐ${l.thu_tu}: ${l.ten_lop}`).join(' · ') || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {h.tong.co_mat}/{h.tong.da_dien_ra}
                      </Table.Td>
                      <Table.Td c={h.tong.vang > 0 ? 'red' : undefined}>{h.tong.vang}</Table.Td>
                      <Table.Td>{h.tong.vang_co_phep}</Table.Td>
                      <Table.Td>{h.tong.da_bao_vang}</Table.Td>
                      <Table.Td c={h.tong.chua_diem_danh > 0 ? 'orange' : undefined}>{h.tong.chua_diem_danh}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
        {data && tongSoTrang > 1 && (
          <Group justify="center">
            <Pagination
              total={tongSoTrang}
              value={page}
              onChange={(p) => datLoc({ page: p > 1 ? String(p) : '' }, true)}
              size="sm"
            />
          </Group>
        )}
      </Stack>
      <DrawerChiTiet cheDo={cheDo} dangKyHocId={dangXem} onClose={() => setDangXem(null)} />
    </Container>
  );
}

/** Admin: cùng trang, phạm vi toàn hệ thống, được ghi "Vắng" (ADR 0010 T5). */
export function TinhHinhDiHocQuanTri() {
  return <HoTroTinhHinhDiHoc cheDo="admin" />;
}

function DrawerChiTiet({
  cheDo,
  dangKyHocId,
  onClose,
}: {
  cheDo: CheDoDiHoc;
  dangKyHocId: string | null;
  onClose: () => void;
}) {
  const nhoMan = useMediaQuery('(max-width: 48em)');
  const { data, isLoading, isError, error } = useChiTietDiHoc(cheDo, dangKyHocId);
  const [boSung, setBoSung] = useState<BuoiDiHoc | null>(null);

  return (
    <Drawer
      opened={!!dangKyHocId}
      onClose={onClose}
      position="right"
      size={nhoMan ? '100%' : 'lg'}
      title={data ? data.ho_ten : 'Tình hình đi học'}
    >
      {isLoading && <Skeleton height={200} />}
      {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
      {data && (
        <Stack gap="sm">
          <Text fz="sm" c="dimmed">
            {[data.ma_dinh_danh_moet, data.don_vi_cong_tac_ten, data.cum].filter(Boolean).join(' · ')}
          </Text>
          <Text fz="sm" c="dimmed">
            Khóa {data.khoa.ma_khoa} – {data.khoa.ten_khoa}
          </Text>
          <Text fz="sm" fw={600}>
            Có mặt {data.tong.co_mat}/{data.tong.da_dien_ra} · Vắng {data.tong.vang} · Có phép {data.tong.vang_co_phep}{' '}
            · Báo vắng {data.tong.da_bao_vang} · Chưa điểm danh {data.tong.chua_diem_danh}
          </Text>
          {data.buoi.length === 0 && (
            <Text c="dimmed" fz="sm">
              Học viên chưa được phân lớp hoặc lớp chưa có buổi học.
            </Text>
          )}
          {data.buoi.map((b) => (
            <TheBuoi key={b.lich_hoc_id} buoi={b} onBoSung={() => setBoSung(b)} />
          ))}
          {boSung && <ModalBoSung cheDo={cheDo} chiTiet={data} buoi={boSung} onClose={() => setBoSung(null)} />}
        </Stack>
      )}
    </Drawer>
  );
}

function TheBuoi({ buoi: b, onBoSung }: { buoi: BuoiDiHoc; onBoSung: () => void }) {
  const dd = b.diem_danh;
  return (
    <Paper withBorder radius={10} p="sm" data-testid={`buoi-${b.lich_hoc_id}`}>
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={2}>
            <Text fz="sm" fw={600}>
              GĐ{b.giai_doan.thu_tu} · Buổi {b.buoi_so} · {b.lop.ten_lop}
            </Text>
            <Text fz="xs" c="dimmed">
              {dinhDangNgayGio(b.thoi_gian_bat_dau)}–{dinhDangGio(b.thoi_gian_ket_thuc)}
            </Text>
          </Stack>
          <Badge
            color={MAU_DIEM_DANH[dd.ma]}
            variant="light"
            size="sm"
            tt="none"
            style={{ whiteSpace: 'normal', height: 'auto' }}
          >
            {dd.nhan}
          </Badge>
        </Group>
        {b.doi_buoi && (
          <Group gap={6}>
            <Badge color="teal" variant="light" size="sm" tt="none">
              Đổi buổi
            </Badge>
            <Text fz="xs">
              Từ lớp {b.doi_buoi.tu_lop.ten_lop} sang lớp {b.doi_buoi.sang_lop.ten_lop}
            </Text>
          </Group>
        )}
        {dd.nguoi_sua && (
          <Text fz="xs" c="dimmed">
            Sửa bởi {dd.nguoi_sua}
            {dd.cap_nhat_luc ? ` lúc ${dinhDangNgayGio(dd.cap_nhat_luc)}` : ''}
            {dd.ghi_chu ? ` · Lý do: ${dd.ghi_chu}` : ''}
          </Text>
        )}
        {b.bo_sung_duoc && (
          <Group justify="flex-end">
            <Button size="xs" variant="light" onClick={onBoSung}>
              Điểm danh bổ sung
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

function ModalBoSung({
  cheDo,
  chiTiet,
  buoi,
  onClose,
}: {
  cheDo: CheDoDiHoc;
  chiTiet: ChiTietDiHoc;
  buoi: BuoiDiHoc;
  onClose: () => void;
}) {
  const tuyChon = chiTiet.trang_thai_duoc;
  const [trangThai, setTrangThai] = useState<TrangThaiDiemDanh>(tuyChon[0] ?? 'co_mat');
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  const batBuocLyDo = cheDo === 'ho_tro';
  const ghi = useDiemDanhBoSung(cheDo, chiTiet.dang_ky_hoc_id);

  async function xacNhan() {
    const lyDoGui = chuanHoaNfc(lyDo.trim());
    if (batBuocLyDo && !lyDoGui) {
      setLoi('Bắt buộc nhập lý do');
      return;
    }
    try {
      await ghi.mutateAsync({ lich_hoc_id: buoi.lich_hoc_id, trang_thai: trangThai, ly_do: lyDoGui || undefined });
      notifications.show({ color: 'green', message: `Đã ghi "${NHAN_TRANG_THAI[trangThai]}" cho ${chiTiet.ho_ten}` });
      onClose();
    } catch (err) {
      setLoi(thongDiepLoiChung(err));
    }
  }

  return (
    <Modal opened onClose={onClose} title="Điểm danh bổ sung" centered>
      <Stack gap="sm">
        <Text fz="sm">
          {chiTiet.ho_ten} · GĐ{buoi.giai_doan.thu_tu} · Buổi {buoi.buoi_so} · {buoi.lop.ten_lop} (
          {dinhDangNgayGio(buoi.thoi_gian_bat_dau)})
        </Text>
        <SegmentedControl
          aria-label="Trạng thái điểm danh"
          fullWidth
          data={tuyChon.map((t) => ({ value: t, label: NHAN_TRANG_THAI[t] }))}
          value={trangThai}
          onChange={(v) => setTrangThai(v as TrangThaiDiemDanh)}
        />
        <Textarea
          label="Lý do"
          required={batBuocLyDo}
          placeholder="Vd: có ảnh chụp màn hình Zoom, học viên gửi minh chứng…"
          value={lyDo}
          onChange={(e) => {
            setLyDo(e.currentTarget.value);
            setLoi(null);
          }}
          maxLength={500}
          autosize
          minRows={2}
        />
        <Alert color="yellow" variant="light" p="xs">
          Nếu Quản trị nạp lại file điểm danh của buổi này, kết quả bổ sung sẽ bị ghi đè.
        </Alert>
        {loi && (
          <Text c="red" fz="sm" role="alert">
            {loi}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={xacNhan} loading={ghi.isPending}>
            Xác nhận
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
