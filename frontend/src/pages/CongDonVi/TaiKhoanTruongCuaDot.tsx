import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  List,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  blobTuBase64Xlsx,
  useCapTaiKhoanTruong,
  useTaiKhoanTruongCuaDot,
  type KetQuaCapTaiKhoanTruong,
  type TaiKhoanTruong,
  type TaiKhoanTruongCuaDot as DuLieuTaiKhoan,
} from '@/api/taiKhoanTruongDot';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { ngayVietNam } from '@/lib/hanNop';
import { dinhDangNgayLich } from '@/lib/ngayLich';
import { taiFileTuBlob } from '@/lib/taiFile';

type DongTruong = DuLieuTaiKhoan['truong'][number];

function TrangThaiTaiKhoan({ tk }: { tk: TaiKhoanTruong | null }) {
  if (!tk) return <Badge color="gray">Chưa có tài khoản</Badge>;
  if (tk.trang_thai === 'ngung') return <Badge color="red">Đã khóa</Badge>;
  if (!tk.lan_dang_nhap_cuoi) return <Badge color="yellow">Chưa đăng nhập</Badge>;
  return (
    <Badge color="green" variant="light">
      Đã đăng nhập {dinhDangNgayLich(ngayVietNam(new Date(tk.lan_dang_nhap_cuoi)))}
    </Badge>
  );
}

function BangTaiKhoan({ truong }: { truong: DongTruong[] }) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped aria-label="Tài khoản trường của đợt">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Trường</Table.Th>
            <Table.Th>Mã</Table.Th>
            <Table.Th>Tên đăng nhập</Table.Th>
            <Table.Th>Trạng thái</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {truong.map(({ don_vi, tai_khoan }) => (
            <Table.Tr key={don_vi.id}>
              <Table.Td>{don_vi.ten}</Table.Td>
              <Table.Td>{don_vi.ma ?? '—'}</Table.Td>
              <Table.Td>{tai_khoan?.ten_dang_nhap ?? '—'}</Table.Td>
              <Table.Td>
                <TrangThaiTaiKhoan tk={tai_khoan} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function TheTaiKhoan({ truong }: { truong: DongTruong[] }) {
  return (
    <Stack gap="sm" aria-label="Tài khoản trường của đợt">
      {truong.map(({ don_vi, tai_khoan }) => (
        <Paper key={don_vi.id} component="article" aria-label={don_vi.ten} withBorder radius="md" p="sm">
          <Stack gap={4}>
            <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>
              {don_vi.ten}
            </Text>
            <Text size="xs" c="dimmed">
              Mã: {don_vi.ma ?? '—'} · Tên đăng nhập: {tai_khoan?.ten_dang_nhap ?? '—'}
            </Text>
            <div>
              <TrangThaiTaiKhoan tk={tai_khoan} />
            </div>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

/** Quản trị (ADR 0015 T4): xem / cấp tài khoản cho các trường trong danh sách của đợt. Mật khẩu tạm chỉ nằm
 * trong file trả về 1 lần — giữ Blob ở state cục bộ để "Tải lại file" tới khi đóng hộp kết quả. */
export function TaiKhoanTruongCuaDot({ dotId }: { dotId: string }) {
  const ds = useTaiKhoanTruongCuaDot(dotId);
  const cap = useCapTaiKhoanTruong(dotId);
  const nhoMan = useMediaQuery('(max-width: 48em)');
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [ketQua, setKetQua] = useState<Omit<KetQuaCapTaiKhoanTruong, 'file_mat_khau'> | null>(null);
  const [fileMatKhau, setFileMatKhau] = useState<Blob | null>(null);
  const tenFile = `mat-khau-tam-truong-${dotId}.xlsx`;
  const soChuaCo = ds.data?.tong.so_chua_co ?? 0;

  function xacNhanCap() {
    cap.mutate(undefined, {
      onSuccess: ({ file_mat_khau, ...kq }) => {
        setMoXacNhan(false);
        if (file_mat_khau) {
          const blob = blobTuBase64Xlsx(file_mat_khau);
          setFileMatKhau(blob);
          taiFileTuBlob(blob, tenFile);
        }
        setKetQua(kq);
      },
    });
  }

  function dongKetQua() {
    setKetQua(null);
    setFileMatKhau(null);
    cap.reset();
  }

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Title order={2} size="h4">
          Tài khoản trường của đợt
        </Title>
        {ds.isLoading && <Skeleton height={80} radius="md" aria-label="Đang tải tài khoản trường" />}
        {ds.isError && <Alert color="red">{thongDiepLoiChung(ds.error)}</Alert>}
        {ds.data && (
          <>
            <Text fz="sm">
              {ds.data.tong.so_truong} trường · {ds.data.tong.so_co_tai_khoan} đã có tài khoản ·{' '}
              {ds.data.tong.so_chua_co} chưa có · {ds.data.tong.so_chua_dang_nhap} chưa đăng nhập
            </Text>
            <Group gap="sm" justify="space-between" wrap="wrap">
              <Button onClick={() => setMoXacNhan(true)} disabled={soChuaCo === 0}>
                Cấp tài khoản cho {soChuaCo} trường chưa có
              </Button>
              <Anchor component={Link} to="/quan-tri/don-vi-tai-khoan" fz="sm">
                Quản lý tài khoản (cấp lại mật khẩu, khóa…)
              </Anchor>
            </Group>
            {ds.data.truong.length === 0 ? (
              <Text c="dimmed" fz="sm">
                Đợt chưa có trường nào trong danh sách.
              </Text>
            ) : nhoMan ? (
              <TheTaiKhoan truong={ds.data.truong} />
            ) : (
              <BangTaiKhoan truong={ds.data.truong} />
            )}
          </>
        )}
      </Stack>

      <Modal opened={moXacNhan} onClose={() => setMoXacNhan(false)} title="Cấp tài khoản cho trường">
        <Stack gap="sm">
          <Text fz="sm">
            Tạo tài khoản cho {soChuaCo} trường. Mật khẩu tạm chỉ tải về một lần — gửi riêng từng trường (Zalo đầu
            mối/công văn), không gửi vào nhóm chung. Trường đổi mật khẩu ở lần đăng nhập đầu tiên.
          </Text>
          {cap.isError && <Alert color="red">{thongDiepLoiChung(cap.error)}</Alert>}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setMoXacNhan(false)}>
              Hủy
            </Button>
            <Button onClick={xacNhanCap} loading={cap.isPending}>
              Cấp tài khoản
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={ketQua !== null}
        onClose={dongKetQua}
        title="Kết quả cấp tài khoản"
        closeOnClickOutside={false}
        closeOnEscape={false}
        withCloseButton={false}
      >
        {ketQua && (
          <Stack gap="sm">
            <Alert color="green" variant="light">
              Đã tạo {ketQua.so_tao} tài khoản.
            </Alert>
            {ketQua.bo_qua.length > 0 && (
              <Stack gap={4}>
                <Text fz="sm" fw={600}>
                  Bỏ qua {ketQua.bo_qua.length} trường:
                </Text>
                <List size="sm" spacing={4} aria-label="Trường bỏ qua">
                  {ketQua.bo_qua.map((b) => (
                    <List.Item key={b.don_vi.id}>
                      {b.don_vi.ten}: {b.ly_do}
                    </List.Item>
                  ))}
                </List>
              </Stack>
            )}
            {fileMatKhau && (
              <Alert color="red" variant="light">
                File mật khẩu tạm chỉ tải được lúc này. Đóng hộp này sẽ không lấy lại được — cấp lại mật khẩu ở Quản lý
                tài khoản.
              </Alert>
            )}
            <Group justify="flex-end" gap="sm">
              {fileMatKhau && (
                <Button variant="default" onClick={() => taiFileTuBlob(fileMatKhau, tenFile)}>
                  Tải lại file
                </Button>
              )}
              <Button onClick={dongKetQua}>Đã lưu, đóng</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}
