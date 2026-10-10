import { useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Paper,
  Popover,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useBangDiemDanh,
  useSuaDiemDanh,
  type BangDiemDanh,
  type LyDoKhongSuaDiemDanh,
  type ODiemDanh,
  type TrangThaiDiemDanh,
} from '@/api/diemDanh';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangGio, dinhDangNgay } from '@/lib/ngay';

const NHAN: Record<TrangThaiDiemDanh, string> = { co_mat: 'Có mặt', vang: 'Vắng', vang_co_phep: 'Vắng có phép' };
const MAU: Record<TrangThaiDiemDanh, string> = { co_mat: 'green', vang: 'red', vang_co_phep: 'orange' };
const LY_DO_KHOA: Record<LyDoKhongSuaDiemDanh, string> = {
  qua_han: 'Quá 3 ngày — liên hệ Quản trị',
  chua_dien_ra: 'Buổi học chưa diễn ra',
  khong_co_quyen: 'Chỉ xem',
};

type Buoi = BangDiemDanh['buoi'][number];
type HocVien = BangDiemDanh['hoc_vien'][number];

/** Dòng nhỏ dưới trạng thái: nguồn tự điểm danh Zoom (giờ bấm) hoặc sửa tay. */
function dauNguon(o: ODiemDanh): string | null {
  if (o.nguon === 'thu_cong') return o.nguoi_sua ? `sửa tay · ${o.nguoi_sua}` : 'sửa tay';
  if (o.tu_diem_danh_luc) return `Zoom ${dinhDangGio(o.tu_diem_danh_luc)}`;
  return null;
}

/**
 * ADR 0005 Z7 (issue #26): bảng điểm danh học viên × buổi của 1 lớp, sửa nhanh từng ô. Dùng chung cho
 * Quản trị và hỗ trợ GV — backend trả cờ sua_duoc theo người xem (ô khóa có lý do).
 */
export function BangDiemDanhLop({ lopId }: { lopId: string }) {
  const [gdId, setGdId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useBangDiemDanh(lopId, gdId);
  const sua = useSuaDiemDanh(lopId);

  if (isLoading) return <Skeleton height={160} />;
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  if (!data) return null;

  return (
    <Stack gap="sm">
      {data.giai_doan.length > 1 && (
        <Select
          label="Giai đoạn"
          maw={360}
          allowDeselect={false}
          value={data.giai_doan_id}
          onChange={setGdId}
          data={data.giai_doan.map((g) => ({ value: g.id, label: `GĐ ${g.thu_tu} — ${g.ten_giai_doan}` }))}
        />
      )}
      {data.buoi.length === 0 || data.hoc_vien.length === 0 ? (
        <Alert color="gray" variant="light">
          {data.buoi.length === 0 ? 'Lớp chưa có buổi học.' : 'Chưa có học viên được phân vào lớp ở giai đoạn này.'}
        </Alert>
      ) : (
        <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
          <Table.ScrollContainer minWidth={240 + data.buoi.length * 112}>
            <Table verticalSpacing={4} fz="sm" withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Học viên</Table.Th>
                  {data.buoi.map((b) => (
                    <Table.Th key={b.id} style={{ textAlign: 'center' }}>
                      B{b.buoi_so}
                      <Text fz={11} c="dimmed" fw={400}>
                        {dinhDangNgay(b.thoi_gian_bat_dau).slice(0, 5)} {dinhDangGio(b.thoi_gian_bat_dau)}
                      </Text>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.hoc_vien.map((h) => (
                  <Table.Tr key={h.dang_ky_hoc_id}>
                    <Table.Td>
                      <Text fz="sm" fw={600}>
                        {h.ho_ten}
                      </Text>
                      <Text fz={11} c="dimmed">
                        {h.don_vi}
                      </Text>
                    </Table.Td>
                    {data.buoi.map((b) => (
                      <Table.Td key={b.id} p={2}>
                        <OSua sua={sua} hv={h} buoi={b} />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Paper>
      )}
    </Stack>
  );
}

function NoiDungO({ o, baoVang }: { o: ODiemDanh | undefined; baoVang: string | undefined }) {
  if (!o) {
    return (
      <Text fz="xs" c={baoVang ? 'orange' : 'dimmed'}>
        {baoVang ? 'Báo vắng' : '—'}
      </Text>
    );
  }
  const dau = dauNguon(o);
  return (
    <>
      <Text fz="xs" fw={600} c={MAU[o.trang_thai]}>
        {NHAN[o.trang_thai]}
      </Text>
      {dau && (
        <Text fz={10} c="dimmed" lineClamp={1}>
          {dau}
        </Text>
      )}
    </>
  );
}

function OSua({ sua, hv, buoi }: { sua: ReturnType<typeof useSuaDiemDanh>; hv: HocVien; buoi: Buoi }) {
  const o = hv.diem_danh[buoi.id];
  const baoVang = hv.bao_vang[buoi.id];
  const [mo, setMo] = useState(false);
  const [trangThai, setTrangThai] = useState<TrangThaiDiemDanh>('co_mat');
  const [ghiChu, setGhiChu] = useState('');
  const nhan = `${hv.ho_ten} buổi ${buoi.buoi_so}`;
  const kieuO = { display: 'block', width: '100%', minHeight: 36, padding: 4, textAlign: 'center' as const };

  if (!buoi.sua_duoc) {
    const lyDo = buoi.ly_do ? LY_DO_KHOA[buoi.ly_do] : 'Chỉ xem';
    return (
      <Tooltip label={lyDo} withArrow>
        <div style={{ ...kieuO, opacity: 0.6 }} aria-label={`${nhan}: ${lyDo}`} aria-disabled="true" title={lyDo}>
          <NoiDungO o={o} baoVang={baoVang} />
        </div>
      </Tooltip>
    );
  }

  function moSua() {
    setTrangThai(o?.trang_thai ?? (baoVang ? 'vang_co_phep' : 'co_mat'));
    setGhiChu(o?.ghi_chu ?? '');
    setMo(true);
  }

  function luu() {
    sua.mutate(
      {
        dang_ky_hoc_id: hv.dang_ky_hoc_id,
        lich_hoc_id: buoi.id,
        trang_thai: trangThai,
        ghi_chu: ghiChu.normalize('NFC').trim() || undefined,
      },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã lưu điểm danh: ${nhan} — ${NHAN[trangThai]}` });
          setMo(false);
        },
        onError: (e) => notifications.show({ color: 'red', message: thongDiepLoiChung(e) }),
      },
    );
  }

  return (
    <Popover opened={mo} onChange={setMo} width={280} position="bottom" withArrow trapFocus shadow="md">
      <Popover.Target>
        <UnstyledButton style={kieuO} onClick={moSua} aria-label={`Sửa điểm danh ${nhan}`}>
          <NoiDungO o={o} baoVang={baoVang} />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text fz="sm" fw={600}>
            {nhan}
          </Text>
          {baoVang && (
            <Text fz="xs" c="orange">
              Báo vắng: {baoVang}
            </Text>
          )}
          <SegmentedControl
            fullWidth
            size="xs"
            value={trangThai}
            onChange={(v) => setTrangThai(v as TrangThaiDiemDanh)}
            data={(Object.keys(NHAN) as TrangThaiDiemDanh[]).map((k) => ({ value: k, label: NHAN[k] }))}
          />
          <Textarea
            label="Ghi chú (tùy chọn)"
            size="xs"
            autosize
            minRows={2}
            maxLength={500}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button size="xs" variant="default" onClick={() => setMo(false)}>
              Hủy
            </Button>
            <Button size="xs" onClick={luu} loading={sua.isPending}>
              Lưu
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
