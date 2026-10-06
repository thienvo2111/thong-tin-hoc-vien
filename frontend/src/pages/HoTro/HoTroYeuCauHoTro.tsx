import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  layChiTietYeuCauHoTroCuaCum,
  traLoiYeuCauHoTroCuaCum,
  useChiTietYeuCauHoTroCuaCum,
  useCumCuaToi,
  useLamMoiYeuCauHoTroCuaCum,
  useYeuCauHoTroCuaCum,
} from '@/api/hoTro';
import type { TrangThaiYeuCauHoTro, YeuCauHoTroQuanTri } from '@/api/types';
import { KhungTraLoiTicket } from '@/components/KhungTraLoiTicket';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgay, dinhDangNgayGio } from '@/lib/ngay';

const PAGE_SIZE = 20;
type BoLoc = TrangThaiYeuCauHoTro | 'tat_ca';

const TUY_CHON: { value: BoLoc; label: string }[] = [
  { value: 'cho_xu_ly', label: 'Chờ xử lý' },
  { value: 'da_phan_hoi', label: 'Đã phản hồi' },
  { value: 'da_dong', label: 'Đã đóng' },
  { value: 'tat_ca', label: 'Tất cả' },
];
const NHAN_TRANG_THAI: Record<TrangThaiYeuCauHoTro, string> = {
  cho_xu_ly: 'Chờ xử lý',
  da_phan_hoi: 'Đã phản hồi',
  da_dong: 'Đã đóng',
};

function TicketTruoc({ id }: { id: string }) {
  const { data, isLoading } = useChiTietYeuCauHoTroCuaCum(id);
  if (isLoading) return <Skeleton height={24} />;
  if (!data || data.ticket_truoc.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Học viên chưa gửi yêu cầu nào khác.
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} c="dimmed">
        Các yêu cầu trước của học viên
      </Text>
      {data.ticket_truoc.map((t) => (
        <Text key={t.id} size="xs" c="dimmed">
          {dinhDangNgay(t.thoi_gian_tao)} · [{t.chu_de}] {t.noi_dung_hoi}
          {t.noi_dung_tra_loi ? ` → ${t.noi_dung_tra_loi}` : ' (chưa trả lời)'}
        </Text>
      ))}
    </Stack>
  );
}

function TheTicket({ yc, dangMo, onMo, onDong }: { yc: YeuCauHoTroQuanTri; dangMo: boolean; onMo: () => void; onDong: () => void }) {
  const lamMoi = useLamMoiYeuCauHoTroCuaCum();
  return (
    <Paper withBorder radius={12} p="sm">
      <Stack gap={6}>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <Anchor component={Link} to={`/ho-tro/hoc-vien/${yc.hoc_vien_id}`} fw={600} fz="sm">
              {yc.hoc_vien_ho_ten}
            </Anchor>
            <Text size="xs" c="dimmed">
              {yc.ten_cum.join(', ')} · {dinhDangNgayGio(yc.thoi_gian_tao)}
            </Text>
          </Group>
          <Group gap={4}>
            {yc.hoi_lai && <Badge color="red">Hỏi lại</Badge>}
            {yc.da_sua_boi_quan_tri && (
              <Badge color="orange" variant="light">
                Quản trị đã sửa
              </Badge>
            )}
            <Badge color={yc.trang_thai === 'cho_xu_ly' ? 'yellow' : 'gray'} variant="light">
              {NHAN_TRANG_THAI[yc.trang_thai]}
            </Badge>
          </Group>
        </Group>
        <Text size="sm">
          <b>[{yc.chu_de}]</b> {yc.noi_dung_hoi}
        </Text>
        {yc.noi_dung_tra_loi && (
          <Text size="sm" c="dimmed">
            <b>Trả lời{yc.nguoi_tra_loi_ten ? ` (${yc.nguoi_tra_loi_ten})` : ''}:</b> {yc.noi_dung_tra_loi}
          </Text>
        )}
        {yc.danh_gia && (
          <Text size="xs" c={yc.danh_gia === 'hai_long' ? 'green' : 'red'}>
            Học viên đánh giá: {yc.danh_gia === 'hai_long' ? 'Hài lòng' : 'Chưa hài lòng'}
          </Text>
        )}
        {dangMo ? (
          <Stack gap="xs">
            <TicketTruoc id={yc.id} />
            {yc.trang_thai === 'cho_xu_ly' && (
              <KhungTraLoiTicket
                guiTraLoi={(noiDung) => traLoiYeuCauHoTroCuaCum(yc.id, noiDung)}
                layTraLoiHienTai={() => layChiTietYeuCauHoTroCuaCum(yc.id)}
                onXong={() => {
                  onDong();
                  lamMoi();
                }}
                onHuy={onDong}
              />
            )}
            {yc.trang_thai !== 'cho_xu_ly' && (
              <Button size="xs" variant="subtle" onClick={onDong} style={{ alignSelf: 'flex-start' }}>
                Thu gọn
              </Button>
            )}
          </Stack>
        ) : (
          <Button size="xs" variant="light" onClick={onMo} style={{ alignSelf: 'flex-start' }}>
            {yc.trang_thai === 'cho_xu_ly' ? 'Trả lời' : 'Xem các yêu cầu trước'}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

/** Yêu cầu hỗ trợ của học viên trong cụm (ADR 0003 H10–H13). Hàng chờ "Chờ xử lý" xếp cũ nhất trước. */
export default function HoTroYeuCauHoTro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cumId = searchParams.get('cum_id') ?? '';
  const [boLoc, setBoLoc] = useState<BoLoc>('cho_xu_ly');
  const [page, setPage] = useState(1);
  const [dangMoId, setDangMoId] = useState<string | null>(null);
  const cums = useCumCuaToi();
  const { data, isLoading, isError, error } = useYeuCauHoTroCuaCum({
    trang_thai: boLoc === 'tat_ca' ? undefined : boLoc,
    cum_id: cumId || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function doiCum(v: string | null) {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('cum_id', v);
    else next.delete('cum_id');
    setSearchParams(next, { replace: true });
    setPage(1);
  }

  return (
    <Container size="lg" py="lg" px={{ base: 'md', md: 28 }}>
      <Stack gap="md">
        <Title order={3}>Yêu cầu hỗ trợ</Title>
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            aria-label="Lọc theo trạng thái"
            value={boLoc}
            onChange={(v) => {
              setBoLoc(v as BoLoc);
              setPage(1);
              setDangMoId(null);
            }}
            data={TUY_CHON}
          />
          <Select
            aria-label="Cụm"
            data={[
              { value: '', label: 'Tất cả cụm của tôi' },
              ...(cums.data ?? []).map((c) => ({ value: c.cum_id, label: `${c.ten_cum} · ${c.ma_khoa}` })),
            ]}
            value={cumId}
            onChange={doiCum}
            allowDeselect={false}
            w={{ base: '100%', sm: 240 }}
          />
        </Group>
        {isLoading && <Skeleton height={120} />}
        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}
        {data && data.data.length === 0 && (
          <Text c="dimmed" ta="center" py="lg">
            {boLoc === 'cho_xu_ly' ? 'Không có yêu cầu nào đang chờ xử lý.' : 'Không có yêu cầu nào.'}
          </Text>
        )}
        {data?.data.map((yc) => (
          <TheTicket
            key={yc.id}
            yc={yc}
            dangMo={dangMoId === yc.id}
            onMo={() => setDangMoId(yc.id)}
            onDong={() => setDangMoId(null)}
          />
        ))}
        {data && data.total > PAGE_SIZE && (
          <Group justify="flex-end">
            <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
