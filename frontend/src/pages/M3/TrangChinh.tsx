import { Button, Center, Container, List, Loader, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useDotXacNhan } from '@/api/hocVien';
import { dinhDangNgayGio } from '@/lib/ngay';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { CountdownTimer } from '@/components/CountdownTimer';

/** M3 — trang chính, khối trạng thái theo bảng trong dac-ta-cong-hoc-vien.md § M3. */
export default function TrangChinh() {
  const { data, isLoading, isError, error } = useDotXacNhan();

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Trang của tôi
        </Title>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>}

        {data && <KhoiTrangThai data={data} />}
      </Stack>
    </Container>
  );
}

function KhoiTrangThai({ data }: { data: NonNullable<ReturnType<typeof useDotXacNhan>['data']> }) {
  const { dot, dot_sap_mo, da_xac_nhan, xac_nhan_luc, day_du, thieu } = data;

  if (dot && !day_du) {
    return (
      <StatusBanner loai="warning" tieuDe={`Đợt ${dot.ten}`}>
        <Stack gap="xs">
          <Text>
            Còn {thieu.length} thông tin cần bổ sung. Hạn: {dinhDangNgayGio(dot.dong_luc)}
          </Text>
          <CountdownTimer dongLuc={dot.dong_luc} />
          {thieu.length > 0 && (
            <List size="sm">
              {thieu.map((t) => (
                <List.Item key={t.field}>{nhanCuaTruong(t.field)}</List.Item>
              ))}
            </List>
          )}
          <Button component={Link} to="/toi/ho-so" mt="xs">
            Bổ sung thông tin
          </Button>
        </Stack>
      </StatusBanner>
    );
  }

  if (dot && day_du && !da_xac_nhan) {
    return (
      <StatusBanner loai="info" tieuDe={`Đợt ${dot.ten}`}>
        <Stack gap="xs">
          <Text>Hồ sơ đã đủ. Thầy/Cô cần kiểm tra lại và xác nhận trước {dinhDangNgayGio(dot.dong_luc)}</Text>
          <CountdownTimer dongLuc={dot.dong_luc} />
          <Button component={Link} to="/toi/xac-nhan" mt="xs">
            Xem lại &amp; xác nhận
          </Button>
        </Stack>
      </StatusBanner>
    );
  }

  if (dot && day_du && da_xac_nhan) {
    const laDotDanhGia = dot.loai === 'xac_nhan_truoc_danh_gia';
    return (
      <Stack gap="lg">
        <StatusBanner loai="success" tieuDe={`Đợt ${dot.ten}`}>
          <Stack gap="xs">
            <Text>
              Đã xác nhận lúc {xac_nhan_luc ? dinhDangNgayGio(xac_nhan_luc) : ''}. Có thể sửa tới {dinhDangNgayGio(dot.dong_luc)}
              , nhưng sửa xong phải xác nhận lại.
            </Text>
            <CountdownTimer dongLuc={dot.dong_luc} />
            <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
              Xem hồ sơ
            </Button>
          </Stack>
        </StatusBanner>
        {laDotDanhGia && (
          <StatusBanner loai="info" tieuDe="Đánh giá đầu vào">
            <Stack gap="xs">
              <Text>Thầy/Cô đã xác nhận và có thể làm bài đánh giá đầu vào.</Text>
              <Button component={Link} to="/toi/danh-gia-dau-vao" mt="xs">
                Làm bài đánh giá
              </Button>
            </Stack>
          </StatusBanner>
        )}
      </Stack>
    );
  }

  if (!dot && dot_sap_mo) {
    return (
      <StatusBanner loai="info" tieuDe={`Đợt ${dot_sap_mo.ten}`}>
        <Stack gap="xs">
          <Text>Đợt {dot_sap_mo.ten} mở lúc {dinhDangNgayGio(dot_sap_mo.mo_luc)}</Text>
          <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
            Xem hồ sơ
          </Button>
        </Stack>
      </StatusBanner>
    );
  }

  return (
    <StatusBanner loai="info">
      <Stack gap="xs">
        <Text>Hiện không trong thời gian chỉnh sửa hồ sơ</Text>
        <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
          Xem hồ sơ
        </Button>
      </Stack>
    </StatusBanner>
  );
}
