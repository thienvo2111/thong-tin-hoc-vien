import { Box, Button, Center, Container, List, Loader, Stack, Stepper, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useDotXacNhan } from '@/api/hocVien';
import { dinhDangNgayGio } from '@/lib/ngay';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { CountdownTimer } from '@/components/CountdownTimer';

const CAC_BUOC = ['Hồ sơ', 'Xác nhận thông tin', 'Đánh giá đầu vào', 'Hoàn tất'];

/** Suy ra bước hiện tại (0-3) từ đúng các trường đã dùng để chọn banner bên dưới — không thêm dữ liệu mới. */
function tinhBuocHienTai(data: NonNullable<ReturnType<typeof useDotXacNhan>['data']>): number {
  const { dot, da_xac_nhan, day_du } = data;
  if (dot && !day_du) return 0;
  if (dot && day_du && !da_xac_nhan) return 1;
  if (dot && day_du && da_xac_nhan) return 2;
  return 0;
}

/** M3 — trang chính, khối trạng thái theo bảng trong dac-ta-cong-hoc-vien.md § M3. */
export default function TrangChinh() {
  const { data, isLoading, isError, error } = useDotXacNhan();

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Box
          p="lg"
          style={{
            borderRadius: 16,
            background: 'linear-gradient(120deg, var(--mantine-color-primary-6), var(--mantine-color-primary-4))',
          }}
        >
          <Title order={1} size="h2" c="white">
            Chào mừng trở lại 👋
          </Title>
          <Text c="gray.3" size="sm" mt={4}>
            Theo dõi tiến độ hồ sơ và các đợt xác nhận của bạn tại đây.
          </Text>
        </Box>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>}

        {data && (
          <>
            <Box visibleFrom="xs" p="lg" style={{ borderRadius: 14, border: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-white)' }}>
              <Stepper active={tinhBuocHienTai(data)} size="sm" iconSize={32}>
                {CAC_BUOC.map((buoc) => (
                  <Stepper.Step key={buoc} label={buoc} />
                ))}
              </Stepper>
            </Box>

            <Stack gap="sm">
              <Text fw={700} size="sm">
                Việc cần làm
              </Text>
              <KhoiTrangThai data={data} />
            </Stack>
          </>
        )}
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
