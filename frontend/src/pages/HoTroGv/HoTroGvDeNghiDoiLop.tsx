import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  MAU_TRANG_THAI_DE_NGHI,
  NHAN_TRANG_THAI_DE_NGHI,
  useDeNghiDoiLopGv,
  useDuyetDeNghi,
  useTuChoiDeNghi,
  type DeNghiDoiLopGv,
  type TrangThaiDeNghi,
} from '@/api/doiLop';
import { thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

/** Đề nghị đổi lớp (ADR 0004 G14, issue #18) — nhóm hỗ trợ GV duyệt/từ chối; vượt sĩ số chỉ cảnh báo. */
export default function HoTroGvDeNghiDoiLop() {
  const [loc, setLoc] = useState<'cho_duyet' | 'tat_ca'>('cho_duyet');
  const { data, isLoading, isError, error } = useDeNghiDoiLopGv(loc === 'cho_duyet' ? 'cho_duyet' : null);
  const [xuLy, setXuLy] = useState<{ dn: DeNghiDoiLopGv; loai: 'duyet' | 'tu_choi' } | null>(null);

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Title order={3}>Đề nghị đổi lớp</Title>
          <SegmentedControl
            value={loc}
            onChange={(v) => setLoc(v as typeof loc)}
            data={[
              { value: 'cho_duyet', label: 'Chờ duyệt' },
              { value: 'tat_ca', label: 'Tất cả' },
            ]}
          />
        </Group>
        <Text fz="sm" c="dimmed">
          Người hỗ trợ học viên gửi đề nghị chuyển học viên sang lớp khác cùng giai đoạn. Duyệt = cập nhật phân lớp ngay.
        </Text>
        {isLoading && <Skeleton height={160} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            {loc === 'cho_duyet' ? 'Không có đề nghị nào đang chờ duyệt.' : 'Chưa có đề nghị nào.'}
          </Text>
        )}
        {data && data.length > 0 && (
          <Paper withBorder radius={12} style={{ overflow: 'hidden' }}>
            <Table.ScrollContainer minWidth={880}>
              <Table verticalSpacing="sm" fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Học viên</Table.Th>
                    <Table.Th>Giai đoạn</Table.Th>
                    <Table.Th>Đổi lớp</Table.Th>
                    <Table.Th>Lý do</Table.Th>
                    <Table.Th>Trạng thái</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.map((d) => (
                    <DongDeNghi key={d.id} d={d} onXuLy={(loai) => setXuLy({ dn: d, loai })} />
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>
      <ModalXuLy xuLy={xuLy} onClose={() => setXuLy(null)} />
    </Container>
  );
}

function DongDeNghi({ d, onXuLy }: { d: DeNghiDoiLopGv; onXuLy: (loai: 'duyet' | 'tu_choi') => void }) {
  const toiDa = d.lop_de_nghi.si_so_toi_da;
  const sauKhiDuyet = d.si_so_lop_de_nghi + 1;
  const vuot = d.trang_thai === 'cho_duyet' && !!toiDa && sauKhiDuyet > toiDa;
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm" fw={600}>
          {d.hoc_vien.ho_ten}
        </Text>
        <Text fz="xs" c="dimmed">
          {d.hoc_vien.don_vi}
          {d.hoc_vien.cum ? ` · ${d.hoc_vien.cum}` : ''}
        </Text>
      </Table.Td>
      <Table.Td>
        {d.lop_de_nghi.khoa.ma_khoa} · GĐ{d.giai_doan.thu_tu}
      </Table.Td>
      <Table.Td>
        <Text fz="sm">
          {d.lop_hien_tai?.ten_lop ?? 'Chưa phân lớp'} → <b>{d.lop_de_nghi.ten_lop}</b>
        </Text>
        <Text fz="xs" c={vuot ? 'red' : 'dimmed'}>
          Sĩ số lớp mới {d.si_so_lop_de_nghi}
          {toiDa ? `/${toiDa}` : ''}
          {vuot ? ' — duyệt sẽ vượt sĩ số tối đa' : ''}
        </Text>
      </Table.Td>
      <Table.Td maw={260}>
        <Text fz="sm">{d.ly_do}</Text>
        <Text fz="xs" c="dimmed">
          {d.nguoi_tao ?? '—'} · {dinhDangNgayGio(d.tao_luc)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge color={MAU_TRANG_THAI_DE_NGHI[d.trang_thai]} variant="light">
          {NHAN_TRANG_THAI_DE_NGHI[d.trang_thai as TrangThaiDeNghi]}
        </Badge>
        {d.nguoi_xu_ly && (
          <Text fz="xs" c="dimmed">
            {d.nguoi_xu_ly}
            {d.ghi_chu_xu_ly ? `: ${d.ghi_chu_xu_ly}` : ''}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {d.trang_thai === 'cho_duyet' && (
          <Group gap={6} wrap="nowrap">
            <Button size="compact-sm" onClick={() => onXuLy('duyet')}>
              Duyệt
            </Button>
            <Button size="compact-sm" variant="light" color="red" onClick={() => onXuLy('tu_choi')}>
              Từ chối
            </Button>
          </Group>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function ModalXuLy({
  xuLy,
  onClose,
}: {
  xuLy: { dn: DeNghiDoiLopGv; loai: 'duyet' | 'tu_choi' } | null;
  onClose: () => void;
}) {
  const duyet = useDuyetDeNghi();
  const tuChoi = useTuChoiDeNghi();
  const [ghiChu, setGhiChu] = useState('');
  const laDuyet = xuLy?.loai === 'duyet';

  function dong() {
    setGhiChu('');
    onClose();
  }

  function onError(err: unknown) {
    notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
  }

  function luu() {
    if (!xuLy) return;
    const id = xuLy.dn.id;
    if (laDuyet) {
      duyet.mutate(
        { id, ghi_chu: ghiChu.trim() || undefined },
        {
          onSuccess: (kq) => {
            notifications.show({ color: 'green', message: 'Đã duyệt — phân lớp đã cập nhật' });
            for (const cb of kq.canh_bao) notifications.show({ color: 'yellow', message: cb, autoClose: 8000 });
            dong();
          },
          onError,
        },
      );
    } else {
      tuChoi.mutate(
        { id, ghi_chu: ghiChu.trim() },
        {
          onSuccess: () => {
            notifications.show({ color: 'green', message: 'Đã từ chối đề nghị' });
            dong();
          },
          onError,
        },
      );
    }
  }

  return (
    <Modal opened={!!xuLy} onClose={dong} title={laDuyet ? 'Duyệt đề nghị đổi lớp' : 'Từ chối đề nghị đổi lớp'} centered>
      {xuLy && (
        <Stack gap="sm">
          <Text fz="sm">
            {xuLy.dn.hoc_vien.ho_ten}: {xuLy.dn.lop_hien_tai?.ten_lop ?? 'Chưa phân lớp'} → <b>{xuLy.dn.lop_de_nghi.ten_lop}</b>
          </Text>
          <Textarea
            label={laDuyet ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối'}
            required={!laDuyet}
            autosize
            minRows={2}
            maxLength={500}
            value={ghiChu}
            onChange={(e) => setGhiChu(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={dong}>
              Đóng
            </Button>
            <Button
              color={laDuyet ? undefined : 'red'}
              onClick={luu}
              loading={duyet.isPending || tuChoi.isPending}
              disabled={!laDuyet && ghiChu.trim().length < 3}
            >
              {laDuyet ? 'Duyệt' : 'Từ chối'}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
