import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import {
  useDanhSachCuaTruong,
  useDongYTatCa,
  useXacNhanDanhSach,
  useYKienDong,
  type DanhSachCuaTruong,
  type DongDanhSachTruong,
  type YKienTruong,
} from '@/api/truongDanhSach';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayLich, dinhDangTien } from '@/lib/ngayLich';
import { tokenKhac } from '@/theme';
import { NHAN_GIAI_DOAN, dinhDangSuat } from './danhSachThamGiaNhan';
import { NHAN_CHUONG_TRINH_NGAN, TRANG_THAI_DANH_SACH } from './hopDongNhan';

/** Màn "Xem danh sách tham gia" của trường (issue #60, ADR 0015 U1, X6): mỗi người một thẻ (mobile-first),
 * cuối màn tổng suất + giá trị tạm tính. Issue #61 (X1, X2): Đồng ý / Không đồng ý từng người, Đồng ý tất cả,
 * Xác nhận danh sách (chỉ bật khi mọi dòng Đồng ý). */
export default function DanhSachThamGiaTruong() {
  const { dotId = '' } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useDanhSachCuaTruong(dotId);
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="sm" py="lg" px="md">
      <Stack gap="md">
        <Anchor component={Link} to="/trang-chu" size="sm">
          ← Trang chủ
        </Anchor>

        {isLoading && (
          <Stack gap="sm" aria-label="Đang tải">
            <Skeleton height={56} radius="md" />
            <Skeleton height={96} radius="md" />
            <Skeleton height={96} radius="md" />
          </Stack>
        )}

        {isError && khongThay && (
          <Paper withBorder radius="md" p="md">
            <Text>Không tìm thấy danh sách của trường cho đợt này</Text>
          </Paper>
        )}

        {isError && !khongThay && (
          <Alert color="red" title="Không tải được danh sách">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}

        {data && <NoiDung dotId={dotId} ds={data} />}
      </Stack>
    </Container>
  );
}

const baoLoi = (err: unknown) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) });

function NoiDung({ dotId, ds }: { dotId: string; ds: DanhSachCuaTruong }) {
  const yKien = useYKienDong(dotId);
  const dongYTatCa = useDongYTatCa(dotId);
  const xacNhan = useXacNhanDanhSach(dotId);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const dangGui = yKien.isPending || dongYTatCa.isPending || xacNhan.isPending;
  const tt = TRANG_THAI_DANH_SACH[ds.trang_thai_danh_sach];
  const soChuaCoYKien = ds.dong.filter((d) => d.y_kien_truong === null).length;
  const daXacNhan = ds.trang_thai_danh_sach === 'da_xac_nhan';

  const datYKien = (d: DongDanhSachTruong, y: YKienTruong) =>
    // Bấm lại ý kiến đang chọn → bỏ ý kiến (null).
    yKien.mutate({ dongId: d.id, y_kien: d.y_kien_truong === y ? null : y }, { onError: baoLoi });

  return (
    <>
      <Stack gap={4}>
        <Group gap="xs">
          <Badge variant="filled">{NHAN_CHUONG_TRINH_NGAN[ds.dot.chuong_trinh]}</Badge>
          <Badge color={tt.mau} variant="light" aria-label={`Trạng thái danh sách: ${tt.nhan}`}>
            {tt.nhan}
          </Badge>
        </Group>
        <Title order={1} size="h3" style={{ overflowWrap: 'anywhere' }}>
          Danh sách tham gia — {ds.dot.ten}
        </Title>
        <Text size="sm" c="dimmed">
          Hạn nộp: {dinhDangNgayLich(ds.dot.han_nop_ngay)} · {ds.dong.length} người
        </Text>
      </Stack>

      {ds.dong.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text c="dimmed">Danh sách của trường cho đợt này chưa có người nào.</Text>
        </Paper>
      ) : (
        <>
          <Button
            variant="light"
            color="green"
            fullWidth
            disabled={soChuaCoYKien === 0 || dangGui}
            loading={dongYTatCa.isPending}
            onClick={() => dongYTatCa.mutate(undefined, { onError: baoLoi })}
          >
            Đồng ý tất cả dòng chưa có ý kiến
          </Button>
          <Stack component="ol" gap="sm" m={0} p={0} style={{ listStyle: 'none' }} aria-label="Người tham gia">
            {ds.dong.map((d) => (
              <TheNguoi key={d.id} d={d} khoa={dangGui} onYKien={(y) => datYKien(d, y)} />
            ))}
          </Stack>
        </>
      )}

      <Box
        component="section"
        aria-label="Tổng cộng"
        pos="sticky"
        bottom={0}
        py="sm"
        style={{ background: tokenKhac.bg, borderTop: `1px solid ${tokenKhac.border}` }}
      >
        <Stack gap="xs">
          <div>
            <Text fw={600}>Tổng suất: {dinhDangSuat(ds.tong_suat)}</Text>
            <Text fw={600}>
              Giá trị tạm tính: {ds.gia_tri_tam_tinh === null ? 'chưa có đơn giá' : dinhDangTien(ds.gia_tri_tam_tinh)}
            </Text>
          </div>
          {daXacNhan ? (
            <Text c="green.8" fw={600}>
              Trường đã xác nhận danh sách này.
            </Text>
          ) : (
            <>
              <Button
                fullWidth
                disabled={!ds.co_the_xac_nhan || dangGui}
                aria-describedby={ds.ly_do_khong_xac_nhan ? 'ly-do-khong-xac-nhan' : undefined}
                onClick={() => {
                  xacNhan.reset();
                  setMoXacNhan(true);
                }}
              >
                Xác nhận danh sách
              </Button>
              {ds.ly_do_khong_xac_nhan && (
                <Text id="ly-do-khong-xac-nhan" size="sm" c="dimmed">
                  {ds.ly_do_khong_xac_nhan} — chưa xác nhận được.
                </Text>
              )}
            </>
          )}
        </Stack>
      </Box>

      <Modal opened={moXacNhan} onClose={() => setMoXacNhan(false)} title="Xác nhận danh sách" centered>
        <Stack gap="sm">
          {xacNhan.isError && (
            <Alert color="red" role="alert">
              {thongDiepLoiChung(xacNhan.error)}
            </Alert>
          )}
          <Text size="sm">Sau khi xác nhận, HCMUE dùng danh sách này để làm hợp đồng.</Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMoXacNhan(false)}>
              Hủy
            </Button>
            <Button
              loading={xacNhan.isPending}
              onClick={() =>
                xacNhan.mutate(undefined, {
                  onSuccess: () => {
                    setMoXacNhan(false);
                    notifications.show({ color: 'green', message: 'Đã xác nhận danh sách' });
                  },
                })
              }
            >
              Xác nhận
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function TheNguoi({ d, khoa, onYKien }: { d: DongDanhSachTruong; khoa: boolean; onYKien: (y: YKienTruong) => void }) {
  const dongY = d.y_kien_truong === 'dong_y';
  const khongDongY = d.y_kien_truong === 'khong_dong_y';
  return (
    <Paper component="li" withBorder radius="md" p="sm">
      <Stack gap="xs">
        <div>
          <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {d.ho_ten}
            </Text>
            <Badge variant="light" style={{ flexShrink: 0 }}>
              {dinhDangSuat(d.ty_le_suat)} suất
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            Ngày sinh: {d.ngay_sinh ? dinhDangNgayLich(d.ngay_sinh) : '—'} · Lớp/môn: {d.lop || '—'} · Giai đoạn:{' '}
            {NHAN_GIAI_DOAN[d.giai_doan]}
          </Text>
          {d.ghi_chu && (
            <Text size="sm" c="orange.8" style={{ overflowWrap: 'anywhere' }}>
              Ghi chú: {d.ghi_chu}
            </Text>
          )}
        </div>
        <Group grow gap="xs" role="group" aria-label={`Ý kiến về ${d.ho_ten}`}>
          <Button
            size="sm"
            color="green"
            variant={dongY ? 'filled' : 'default'}
            aria-pressed={dongY}
            disabled={khoa}
            onClick={() => onYKien('dong_y')}
          >
            Đồng ý
          </Button>
          <Button
            size="sm"
            color="red"
            variant={khongDongY ? 'filled' : 'default'}
            aria-pressed={khongDongY}
            disabled={khoa}
            onClick={() => onYKien('khong_dong_y')}
          >
            Không đồng ý
          </Button>
        </Group>
        {khongDongY && (
          <Text size="sm" c="red.8">
            Đề nghị sửa sẽ mở ở bước sau — liên hệ HCMUE nếu cần sửa gấp.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
