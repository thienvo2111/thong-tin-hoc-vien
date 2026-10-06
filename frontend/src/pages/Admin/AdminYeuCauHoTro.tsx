import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  layChiTietYeuCauHoTroQuanTri,
  traLoiYeuCauHoTro,
  useDanhSachYeuCauHoTroQuanTri,
  useSuaTraLoiYeuCauHoTro,
} from '@/api/yeuCauHoTro';
import { KhungTraLoiTicket } from '@/components/KhungTraLoiTicket';
import type { TrangThaiYeuCauHoTro, YeuCauHoTroQuanTri } from '@/api/types';
import { thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { AdminPageHeader } from './AdminPageHeader';

const PAGE_SIZE = 20;

type BoLocTrangThai = TrangThaiYeuCauHoTro | 'tat_ca';

const TUY_CHON_TRANG_THAI: { value: BoLocTrangThai; label: string }[] = [
  { value: 'cho_xu_ly', label: 'Chờ xử lý' },
  { value: 'da_phan_hoi', label: 'Đã phản hồi' },
  { value: 'da_dong', label: 'Đã đóng' },
  { value: 'tat_ca', label: 'Tất cả' },
];

const THONG_DIEP_TRONG: Record<BoLocTrangThai, string> = {
  cho_xu_ly: 'Không có yêu cầu hỗ trợ nào đang chờ xử lý.',
  da_phan_hoi: 'Chưa có yêu cầu nào đã phản hồi.',
  da_dong: 'Chưa có yêu cầu nào đã đóng.',
  tat_ca: 'Chưa có yêu cầu hỗ trợ nào.',
};

/** Trang quản trị "Yêu cầu hỗ trợ" (M8) — quan_tri xử lý ticket đang chờ (trả lời 1 lần, không ghi đè —
 * ADR 0003 H11), tra cứu lịch sử kèm đánh giá, đính chính câu trả lời (H12) và lọc ticket của học viên
 * chưa có cụm (H10 — chỉ Quản trị thấy).
 * Panel đếm tương ứng ở AdminTongQuan. */
export default function AdminYeuCauHoTroPage() {
  const [boLoc, setBoLoc] = useState<BoLocTrangThai>('cho_xu_ly');
  const [chuaCoCum, setChuaCoCum] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useDanhSachYeuCauHoTroQuanTri({
    trang_thai: boLoc === 'tat_ca' ? undefined : boLoc,
    chua_co_cum: chuaCoCum || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const [dangTraLoiId, setDangTraLoiId] = useState<string | null>(null);
  const tongSoTrang = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function doiBoLoc(v: string) {
    setBoLoc(v as BoLocTrangThai);
    setPage(1);
    setDangTraLoiId(null);
  }

  return (
    <>
      <AdminPageHeader title="Yêu cầu hỗ trợ" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="md">
          <Group gap="md" wrap="wrap">
            <SegmentedControl aria-label="Lọc theo trạng thái" value={boLoc} onChange={doiBoLoc} data={TUY_CHON_TRANG_THAI} />
            <Switch
              label="Chỉ học viên chưa có cụm"
              description="Yêu cầu của các học viên này chỉ Quản trị thấy"
              checked={chuaCoCum}
              onChange={(e) => {
                setChuaCoCum(e.currentTarget.checked);
                setPage(1);
              }}
            />
          </Group>

          <Paper withBorder radius={14} style={{ overflow: 'hidden' }}>
            {isLoading && (
              <Stack p="md" gap="sm">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={36} />
                ))}
              </Stack>
            )}

            {isError && (
              <Alert color="red" m="md">
                {thongDiepLoiChung(error)}
              </Alert>
            )}

            {data && data.data.length === 0 && (
              <Text c="dimmed" ta="center" py="lg">
                {THONG_DIEP_TRONG[boLoc]}
              </Text>
            )}

            {data && data.data.length > 0 && (
              <Table verticalSpacing="sm" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Học viên</Table.Th>
                    <Table.Th>Cụm</Table.Th>
                    <Table.Th>Vấn đề</Table.Th>
                    <Table.Th>Nội dung</Table.Th>
                    <Table.Th>Trạng thái</Table.Th>
                    <Table.Th>Đánh giá</Table.Th>
                    <Table.Th>Hỏi lại?</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.map((yc) => (
                    <DongTicket
                      key={yc.id}
                      yeuCau={yc}
                      dangTraLoi={dangTraLoiId === yc.id}
                      onBatDauTraLoi={() => setDangTraLoiId(yc.id)}
                      onHuy={() => setDangTraLoiId(null)}
                      onDaTraLoi={() => setDangTraLoiId(null)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Paper>

          {data && data.total > 0 && (
            <Group justify="space-between">
              <Text fz={12.5} c="dimmed">
                Trang {data.page} / {tongSoTrang} — {data.total.toLocaleString('vi-VN')} yêu cầu
              </Text>
              <Pagination value={page} onChange={setPage} total={tongSoTrang} size="sm" />
            </Group>
          )}
        </Stack>
      </Container>
    </>
  );
}

function TrangThaiBadge({ yeuCau }: { yeuCau: YeuCauHoTroQuanTri }) {
  if (yeuCau.trang_thai === 'cho_xu_ly') return <Badge color="yellow">Chờ xử lý</Badge>;
  if (yeuCau.da_dong_hieu_luc) return <Badge color="gray">Đã đóng</Badge>;
  return <Badge color="blue">Đã phản hồi</Badge>;
}

function DanhGiaBadge({ yeuCau }: { yeuCau: YeuCauHoTroQuanTri }) {
  if (yeuCau.danh_gia === 'hai_long') return <Badge color="green">Hài lòng</Badge>;
  if (yeuCau.danh_gia === 'chua_hai_long') return <Badge color="red">Chưa hài lòng</Badge>;
  return (
    <Text size="sm" c="dimmed">
      —
    </Text>
  );
}

function nhanTraLoi(yeuCau: YeuCauHoTroQuanTri): string {
  const chiTiet = [
    yeuCau.nguoi_tra_loi_ten,
    yeuCau.thoi_gian_phan_hoi && dinhDangNgayGio(yeuCau.thoi_gian_phan_hoi),
  ].filter(Boolean);
  return chiTiet.length ? `Trả lời (${chiTiet.join(', ')})` : 'Trả lời';
}

function DongTicket({
  yeuCau,
  dangTraLoi,
  onBatDauTraLoi,
  onHuy,
  onDaTraLoi,
}: {
  yeuCau: YeuCauHoTroQuanTri;
  dangTraLoi: boolean;
  onBatDauTraLoi: () => void;
  onHuy: () => void;
  onDaTraLoi: () => void;
}) {
  const queryClient = useQueryClient();
  const suaTraLoi = useSuaTraLoiYeuCauHoTro();
  const [dangSua, setDangSua] = useState(false);
  const [noiDungSua, setNoiDungSua] = useState('');

  function xong() {
    onDaTraLoi();
    queryClient.invalidateQueries({ queryKey: ['admin', 'yeu-cau-ho-tro'] });
  }

  function luuSua() {
    suaTraLoi.mutate(
      { id: yeuCau.id, noi_dung_tra_loi: noiDungSua.trim().normalize('NFC') },
      {
        onSuccess: () => {
          setDangSua(false);
          notifications.show({ color: 'green', message: 'Đã sửa câu trả lời, học viên sẽ nhận email cập nhật' });
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
      },
    );
  }

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={600}>
          {yeuCau.hoc_vien_ho_ten}
        </Text>
        <Text size="xs" c="dimmed">
          {dinhDangNgayGio(yeuCau.thoi_gian_tao)}
        </Text>
      </Table.Td>
      <Table.Td>
        {yeuCau.ten_cum.length > 0 ? (
          <Text size="sm">{yeuCau.ten_cum.join(', ')}</Text>
        ) : (
          <Badge color="orange" variant="light">
            Chưa có cụm
          </Badge>
        )}
      </Table.Td>
      <Table.Td>{yeuCau.chu_de}</Table.Td>
      <Table.Td>
        <Stack gap={4}>
          <Text size="sm">{yeuCau.noi_dung_hoi}</Text>
          {yeuCau.noi_dung_tra_loi && !dangSua && (
            <Text size="sm" c="dimmed">
              <Text span fw={600}>
                {nhanTraLoi(yeuCau)}:
              </Text>{' '}
              {yeuCau.noi_dung_tra_loi}
              {yeuCau.thoi_gian_sua_tra_loi && (
                <Text span size="xs" c="orange">
                  {' '}
                  (đã sửa {dinhDangNgayGio(yeuCau.thoi_gian_sua_tra_loi)})
                </Text>
              )}
            </Text>
          )}
          {dangSua && (
            <Stack gap={6}>
              <Textarea
                aria-label="Câu trả lời đã sửa"
                minRows={3}
                autosize
                value={noiDungSua}
                onChange={(e) => setNoiDungSua(e.currentTarget.value)}
              />
              <Text size="xs" c="dimmed">
                Học viên sẽ nhận email "câu trả lời đã được cập nhật" và được đánh giá lại.
              </Text>
              <Group gap="xs">
                <Button size="xs" onClick={luuSua} loading={suaTraLoi.isPending} disabled={!noiDungSua.trim()}>
                  Lưu câu trả lời
                </Button>
                <Button size="xs" variant="subtle" onClick={() => setDangSua(false)}>
                  Hủy
                </Button>
              </Group>
            </Stack>
          )}
          {dangTraLoi && (
            <KhungTraLoiTicket
              guiTraLoi={(noiDung) => traLoiYeuCauHoTro(yeuCau.id, noiDung)}
              layTraLoiHienTai={() => layChiTietYeuCauHoTroQuanTri(yeuCau.id)}
              onXong={xong}
              onHuy={onHuy}
            />
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <TrangThaiBadge yeuCau={yeuCau} />
      </Table.Td>
      <Table.Td>
        <DanhGiaBadge yeuCau={yeuCau} />
      </Table.Td>
      <Table.Td>{yeuCau.hoi_lai && <Badge color="red">Có</Badge>}</Table.Td>
      <Table.Td>
        {yeuCau.trang_thai === 'cho_xu_ly' && !dangTraLoi && (
          <Button size="xs" variant="light" onClick={onBatDauTraLoi}>
            Trả lời
          </Button>
        )}
        {yeuCau.noi_dung_tra_loi && !dangSua && (
          <Button
            size="xs"
            variant="subtle"
            onClick={() => {
              setNoiDungSua(yeuCau.noi_dung_tra_loi ?? '');
              setDangSua(true);
            }}
          >
            Sửa câu trả lời
          </Button>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
