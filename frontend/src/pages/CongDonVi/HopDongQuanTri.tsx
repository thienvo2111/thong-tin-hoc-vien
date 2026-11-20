import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import { useHopDongQuanTri, useMoLaiHopDong, type HopDongQuanTri as HopDong } from '@/api/hopDong';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';
import { TRANG_THAI_DANH_SACH, TRANG_THAI_HOP_DONG } from './hopDongNhan';
import { DanhSachLyDoChan, SoLieuHopDong, ThongTinPhan34 } from './HopDongChung';
import { NhomHoSoChiDoc } from './HoSoDonViQuanTri';

const TOI_DA_LY_DO = 500;

/** Quản trị xem hợp đồng của 1 trường (issue #64, ADR 0015 O3, O4, X5): trạng thái, Phần 3–4, số liệu,
 * bản chụp hồ sơ lúc nộp (hoặc hồ sơ hiện tại khi chưa nộp) — STK cá nhân che + "Hiện"; Mở lại khi đã nộp. */
export default function HopDongQuanTri() {
  const { dotId = '', donViId = '' } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useHopDongQuanTri(dotId, donViId);
  const khongThay = error instanceof ApiError && error.status === 404;

  return (
    <Container size="md" py="lg" px="md">
      <Stack gap="md">
        <div>
          <Button component={Link} to="/quan-tri/danh-sach-tham-gia" variant="subtle" size="compact-sm" px={0}>
            ← Danh sách tham gia
          </Button>
          <Title order={1} size="h3" style={{ overflowWrap: 'anywhere' }}>
            Hợp đồng{data ? ` — ${data.don_vi.ten}` : ''}
          </Title>
          {data && (
            <Text size="sm" c="dimmed">
              {data.dot.ten}
            </Text>
          )}
        </div>

        {isLoading && <Skeleton height={240} radius="md" aria-label="Đang tải" />}
        {isError && khongThay && <Alert color="yellow">Trường không có hợp đồng trong đợt này</Alert>}
        {isError && !khongThay && (
          <Alert color="red" title="Không tải được hợp đồng">
            <Stack gap="sm" align="flex-start">
              <Text size="sm">{thongDiepLoiChung(error)}</Text>
              <Button size="sm" variant="light" color="red" onClick={() => refetch()} loading={isFetching}>
                Thử lại
              </Button>
            </Stack>
          </Alert>
        )}
        {data && <NoiDung dotId={dotId} donViId={donViId} data={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ dotId, donViId, data }: { dotId: string; donViId: string; data: HopDong }) {
  const [moLai, setMoLai] = useState(false);
  const daNop = data.trang_thai_hop_dong === 'da_nop';
  const hd = TRANG_THAI_HOP_DONG[data.trang_thai_hop_dong];
  const ds = TRANG_THAI_DANH_SACH[data.trang_thai_danh_sach];
  const hoSo = daNop ? data.ban_chup_ho_so : data.ho_so_hien_tai;

  return (
    <>
      <Paper withBorder radius="md" p="md" role="status" aria-label="Trạng thái hợp đồng">
        <Stack gap="xs">
          <Group gap="xs">
            <Badge color={hd.mau} variant="light">
              Hợp đồng: {hd.nhan}
            </Badge>
            <Badge color={ds.mau} variant="light">
              Danh sách: {ds.nhan}
            </Badge>
          </Group>
          {daNop && data.nop_luc && (
            <Text size="sm">
              Nộp lúc {dinhDangNgayGio(data.nop_luc)}
              {data.nop_boi ? ` bởi ${data.nop_boi.ho_ten} (${data.nop_boi.ten_dang_nhap})` : ''}
            </Text>
          )}
          {!daNop && data.ly_do_chan.length > 0 && <DanhSachLyDoChan lyDo={data.ly_do_chan} />}
          {daNop && (
            <Group>
              <Button color="orange" variant="light" onClick={() => setMoLai(true)}>
                Mở lại hợp đồng
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      <SoLieuHopDong data={data} />
      <ThongTinPhan34 data={data} />

      <Title order={2} size="h4">
        {daNop ? 'Hồ sơ đơn vị (bản chụp lúc nộp)' : 'Hồ sơ đơn vị hiện tại'}
      </Title>
      {hoSo ? (
        <NhomHoSoChiDoc hoSo={hoSo} idTien="hd" capTieuDe={3} />
      ) : (
        <Text c="dimmed">Trường chưa khai hồ sơ đơn vị.</Text>
      )}

      <ModalMoLai
        opened={moLai}
        onClose={() => setMoLai(false)}
        dotId={dotId}
        donViId={donViId}
        tenTruong={data.don_vi.ten}
      />
    </>
  );
}

function ModalMoLai({
  opened,
  onClose,
  dotId,
  donViId,
  tenTruong,
}: {
  opened: boolean;
  onClose: () => void;
  dotId: string;
  donViId: string;
  tenTruong: string;
}) {
  const moLai = useMoLaiHopDong(dotId, donViId);
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState<string | null>(null);

  function dong() {
    setLyDo('');
    setLoi(null);
    moLai.reset();
    onClose();
  }

  function gui() {
    const v = lyDo.normalize('NFC').trim();
    const loiNhap = !v ? 'Nhập lý do mở lại' : v.length > TOI_DA_LY_DO ? `Lý do tối đa ${TOI_DA_LY_DO} ký tự` : null;
    setLoi(loiNhap);
    if (loiNhap) return;
    moLai.mutate(v, {
      onSuccess: () => {
        notifications.show({ color: 'green', message: `Đã mở lại hợp đồng của ${tenTruong}` });
        dong();
      },
      onError: (err) => setLoi(loiFieldsThanhMap(err).ly_do ?? null),
    });
  }

  const loiChung = moLai.isError && !loi ? thongDiepLoiXungDot(moLai.error) : null;
  return (
    <Modal opened={opened} onClose={dong} title="Mở lại hợp đồng" centered>
      <Stack gap="sm">
        <Text size="sm">
          Hợp đồng về Chưa nộp: trường và Quản trị sửa được danh sách, trường nộp lại. Bản chụp cũ được lưu vào nhật ký.
        </Text>
        {loiChung && (
          <Alert color="red" role="alert">
            {loiChung}
          </Alert>
        )}
        <Textarea
          label="Lý do mở lại"
          withAsterisk
          autosize
          minRows={2}
          value={lyDo}
          onChange={(e) => setLyDo(e.currentTarget.value)}
          error={loi}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={dong}>
            Hủy
          </Button>
          <Button color="orange" loading={moLai.isPending} onClick={gui}>
            Mở lại
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
