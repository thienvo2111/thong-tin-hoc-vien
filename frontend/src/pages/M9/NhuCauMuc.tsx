import { useState } from 'react';
import { Box, Button, Center, Container, Group, Loader, Modal, Radio, Stack, Text, Title } from '@mantine/core';
import { Link, useSearchParams } from 'react-router-dom';
import { useHoSoToi } from '@/api/hocVien';
import { useChonNhuCauMuc, useNhuCauMucDot } from '@/api/nhuCauMuc';
import type { LyDoKhongDuNhuCau, MucNangLuc, NhuCauMucCuaToi } from '@/api/types';
import { ApiError } from '@/api/client';
import { StatusBanner } from '@/components/StatusBanner';
import { laLoiDotNhuCauDong, loiFieldsThanhMap, thongDiepLoiChung } from '@/lib/loiApi';
import { nhanMucNangLuc } from '@/lib/mucNangLuc';
import { dinhDangNgayGio } from '@/lib/ngay';

const THONG_DIEP_KHONG_DU: Record<LyDoKhongDuNhuCau, string> = {
  chua_co_moc: 'Chưa có mức/lớp, chưa thể đăng ký nhu cầu.',
  nhan_vien: 'Nhân viên không tham gia chọn nhu cầu mức học.',
  trang_thai_dang_ky: 'Đăng ký học chưa được duyệt nên chưa thể chọn nhu cầu mức học.',
};

/** M10 — chọn nhu cầu mức học theo đợt (ADR 0013, D8): thông tin → mức/lớp được phân công → nhu cầu. */
export default function NhuCauMuc() {
  const [params] = useSearchParams();
  const dotId = params.get('dot');
  const { data, isLoading, isError, error, refetch } = useNhuCauMucDot(dotId);
  const khongTimThay = !dotId || (error instanceof ApiError && error.status === 404);

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Nhu cầu mức học
        </Title>
        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}
        {khongTimThay && <StatusBanner loai="error">Không tìm thấy đợt.</StatusBanner>}
        {isError && !khongTimThay && (
          <Stack gap="xs">
            <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>
            <Button variant="default" onClick={() => void refetch()} style={{ minHeight: 44 }}>
              Thử lại
            </Button>
          </Stack>
        )}
        {data && (
          <>
            <ThongTin nc={data} />
            <MucLop nc={data} />
            <NhuCau nc={data} />
          </>
        )}
        <Button component={Link} to="/toi" variant="default" style={{ minHeight: 44 }}>
          Về trang chính
        </Button>
      </Stack>
    </Container>
  );
}

function ThongTin({ nc }: { nc: NhuCauMucCuaToi }) {
  const { data: hoSo } = useHoSoToi();
  return (
    <Box component="section">
      <Title order={2} size="h4" mb="xs">
        Thông tin của Thầy/Cô
      </Title>
      <Stack gap={4}>
        <Text size="sm">Họ tên: {hoSo?.ho_ten ?? '—'}</Text>
        <Text size="sm">Đơn vị: {hoSo?.don_vi_cong_tac_ten ?? '—'}</Text>
        <Text size="sm">Khóa: {nc.khoa.ten_khoa}</Text>
        <Text size="sm">Đợt: {nc.dot.ten_dot}</Text>
      </Stack>
    </Box>
  );
}

function MucLop({ nc }: { nc: NhuCauMucCuaToi }) {
  const { moc } = nc;
  return (
    <Box component="section">
      <Title order={2} size="h4" mb="xs">
        Mức – lớp đang được phân công
      </Title>
      {!moc ? (
        <Text size="sm">Chưa có mức/lớp.</Text>
      ) : (
        <Stack gap={4}>
          <Text size="sm">
            Mức hiện tại: <b>{nhanMucNangLuc(moc.muc)}</b>{' '}
            <Text span size="xs" c="dimmed">
              ({moc.nguon === 'lop' ? 'theo lớp đang học' : 'theo mức chính thức (chốt)'})
            </Text>
          </Text>
          {moc.lop && <Text size="sm">Lớp: {moc.lop.ten_lop}</Text>}
          {moc.giai_doan && <Text size="sm">Giai đoạn: {moc.giai_doan.ten_giai_doan}</Text>}
        </Stack>
      )}
    </Box>
  );
}

function NhuCau({ nc }: { nc: NhuCauMucCuaToi }) {
  const { dot, lua_chon } = nc;
  const chon = useChonNhuCauMuc(dot.id);
  const [dongSauKhiLuu, setDongSauKhiLuu] = useState(false);
  const daDong = dot.trang_thai === 'da_dong' || dongSauKhiLuu;

  let noiDung;
  if (!nc.du_dieu_kien) {
    noiDung = <StatusBanner loai="info">{THONG_DIEP_KHONG_DU[nc.ly_do_khong_du ?? 'chua_co_moc']}</StatusBanner>;
  } else if (daDong) {
    noiDung = (
      <Stack gap="xs">
        <StatusBanner loai="warning">Đợt đã đóng lúc {dinhDangNgayGio(dot.dong_luc)}.</StatusBanner>
        <Text size="sm">
          {lua_chon
            ? `Lựa chọn cuối: ${nhanMucNangLuc(lua_chon.muc_chon)}`
            : 'Thầy/Cô chưa chọn nhu cầu trong đợt này.'}
        </Text>
      </Stack>
    );
  } else if (dot.trang_thai === 'chua_mo') {
    noiDung = <StatusBanner loai="info">Đợt chưa mở, bắt đầu lúc {dinhDangNgayGio(dot.mo_luc)}.</StatusBanner>;
  } else {
    noiDung = <FormChon nc={nc} chon={chon} onDong={() => setDongSauKhiLuu(true)} />;
  }

  return (
    <Box component="section">
      <Title order={2} size="h4" mb="xs">
        Nhu cầu bồi dưỡng
      </Title>
      {noiDung}
    </Box>
  );
}

function FormChon({
  nc,
  chon,
  onDong,
}: {
  nc: NhuCauMucCuaToi;
  chon: ReturnType<typeof useChonNhuCauMuc>;
  onDong: () => void;
}) {
  const { dot, lua_chon, cac_muc_duoc_chon } = nc;
  const daChon = lua_chon?.muc_chon ?? null;
  const [giaTri, setGiaTri] = useState<MucNangLuc | null>(
    daChon && cac_muc_duoc_chon.includes(daChon) ? daChon : null,
  );
  const [xacNhan, setXacNhan] = useState(false);
  const [daLuu, setDaLuu] = useState(false);

  const xacNhanLuu = () => {
    if (!giaTri) return;
    chon.mutate(giaTri, {
      onSuccess: () => {
        setXacNhan(false);
        setDaLuu(true);
      },
      onError: (err) => {
        // Đợt đóng giữa chừng -> chuyển sang chỉ xem (cùng cách xử lý DOT_XAC_NHAN_DONG ở M5).
        if (laLoiDotNhuCauDong(err)) {
          setXacNhan(false);
          onDong();
        }
      },
    });
  };
  const loiMuc = chon.isError ? (loiFieldsThanhMap(chon.error).muc ?? thongDiepLoiChung(chon.error)) : null;

  return (
    <Stack gap="sm">
      <Text size="sm">Hạn chót: {dinhDangNgayGio(dot.dong_luc)}</Text>
      <Text size="sm">{daChon ? `Lựa chọn hiện tại: ${nhanMucNangLuc(daChon)}` : 'Thầy/Cô chưa chọn.'}</Text>
      {daChon && !cac_muc_duoc_chon.includes(daChon) && (
        <StatusBanner loai="warning">Mức Thầy/Cô đã chọn cao hơn mức hiện tại. Vui lòng chọn lại.</StatusBanner>
      )}
      <Text size="sm">Thầy/Cô chỉ có thể chọn bằng hoặc thấp hơn mức hiện tại.</Text>
      <Radio.Group
        label="Chọn mức muốn bồi dưỡng"
        value={giaTri ?? ''}
        onChange={(v) => {
          setGiaTri(v as MucNangLuc);
          setDaLuu(false);
        }}
      >
        <Stack gap="xs" mt="xs">
          {cac_muc_duoc_chon.map((m) => (
            <Radio
              key={m}
              value={m}
              label={nhanMucNangLuc(m)}
              styles={{ root: { minHeight: 44, display: 'flex', alignItems: 'center' } }}
            />
          ))}
        </Stack>
      </Radio.Group>
      {daLuu && <StatusBanner loai="success">Đã lưu nhu cầu mức học.</StatusBanner>}
      <Button
        onClick={() => {
          chon.reset();
          setXacNhan(true);
        }}
        disabled={!giaTri || giaTri === daChon}
        style={{ minHeight: 44 }}
      >
        Lưu
      </Button>

      <Modal
        opened={xacNhan}
        onClose={() => !chon.isPending && setXacNhan(false)}
        title="Xác nhận nhu cầu mức học"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Thầy/Cô xác nhận chọn nhu cầu bồi dưỡng ở mức <b>{nhanMucNangLuc(giaTri)}</b>?
          </Text>
          {loiMuc && <StatusBanner loai="error">{loiMuc}</StatusBanner>}
          <Group gap="sm" justify="flex-end">
            <Button variant="default" onClick={() => setXacNhan(false)} disabled={chon.isPending} style={{ minHeight: 44 }}>
              Quay lại
            </Button>
            <Button onClick={xacNhanLuu} loading={chon.isPending} style={{ minHeight: 44 }}>
              Xác nhận
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
