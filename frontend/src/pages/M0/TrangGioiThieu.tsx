import { useEffect } from 'react';
import {
  Accordion,
  Anchor,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Image,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import { gioiThieu } from '@/content/gioiThieu';
import logoHcmue from '@/assets/logo-hcmue.png';

// CHỈ bản tối thiểu vòng này: mục 1 (mở đầu), 6 (hướng dẫn nhanh), 7 (FAQ), 8 (liên hệ) — theo cột
// "Bản tối thiểu" của bảng ưu tiên trong dac-ta-cong-hoc-vien.md. KHÔNG render mục 2/3/5/9 dù `hien`
// trong gioiThieu.ts có true hay false — các mục đó chờ nội dung chính thức sau 05/10.
//
// Component chỉ hiển thị nội dung từ src/content/gioiThieu.ts, không chứa chữ/số liệu cứng (CLAUDE.md).
export default function TrangGioiThieu() {
  const { dangTai, daXacThuc } = useToi();

  useEffect(() => {
    if (import.meta.env.DEV) {
      import('@/content/kiemTraNoiDungTam').then((m) => m.baoCacKhoiTam());
    }
  }, []);

  const { thongBaoNoiBat, moDau, huongDan, hoiDap, lienHe, donVi } = gioiThieu;

  return (
    <Box>
      {thongBaoNoiBat && (
        <Box bg="blue.7" c="white" py="xs" ta="center">
          <Text size="sm" fw={500}>
            {thongBaoNoiBat}
          </Text>
        </Box>
      )}

      {moDau.hien && (
        <Container size="sm" py="xl">
          <Stack gap="md" ta="center">
            <Group justify="center" gap="sm" wrap="nowrap">
              <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={48} w="auto" fit="contain" />
              <Title order={1}>{moDau.tenChuongTrinh}</Title>
            </Group>
            <Text size="lg">{moDau.thongDiep}</Text>
            <Group justify="center" gap="sm" wrap="wrap">
              {/* Không chờ dangTai để tránh nút chính bị ẩn thoáng qua ở lần vẽ đầu (yêu cầu: nút chính
                  luôn thấy được ngay màn hình đầu trên điện thoại). Phần lớn khách vào từ link Zalo chưa
                  đăng nhập nên mặc định hiện CTA công khai; chỉ đổi sang "Vào trang của tôi" sau khi xác
                  định chắc chắn đã đăng nhập. */}
              <Button component={Link} to={!dangTai && daXacThuc ? '/toi' : '/dang-nhap'} size="lg">
                {!dangTai && daXacThuc ? 'Vào trang của tôi' : moDau.nutChinh}
              </Button>
              {huongDan.hien && (
                <Button component="a" href="#huong-dan" variant="default" size="lg">
                  {moDau.nutPhu}
                </Button>
              )}
            </Group>
          </Stack>
        </Container>
      )}

      {huongDan.hien && (
        <Container size="sm" py="xl" id="huong-dan">
          <Stack gap="lg">
            <Title order={2} ta="center">
              {huongDan.tieuDe}
            </Title>
            <Stack gap="md">
              {huongDan.buoc.map((b, i) => (
                <Group key={b.ten} align="flex-start" wrap="nowrap">
                  <Text fw={700} c="blue.7" style={{ minWidth: 28 }}>
                    {i + 1}.
                  </Text>
                  <Box>
                    <Text fw={600}>{b.ten}</Text>
                    <Text size="sm" c="dimmed">
                      {b.moTa}
                    </Text>
                  </Box>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Container>
      )}

      {hoiDap.hien && (
        <Container size="sm" py="xl">
          <Stack gap="lg">
            <Title order={2} ta="center">
              {hoiDap.tieuDe}
            </Title>
            <Accordion variant="separated">
              {hoiDap.cau.map((c) => (
                <Accordion.Item key={c.hoi} value={c.hoi}>
                  <Accordion.Control>{c.hoi}</Accordion.Control>
                  <Accordion.Panel>{c.dap}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        </Container>
      )}

      {lienHe.hien && (
        <Container size="sm" py="xl">
          <Stack gap="xs" ta="center">
            <Title order={2}>{lienHe.tieuDe}</Title>
            <Text>Hotline: {lienHe.hotline}</Text>
            <Text>Zalo hỗ trợ: {lienHe.zalo}</Text>
            <Text>Email: {lienHe.email}</Text>
            <Text c="dimmed" size="sm">
              Giờ hỗ trợ: {lienHe.gioHoTro}
            </Text>
          </Stack>
        </Container>
      )}

      <Divider />
      <Container size="sm" py="lg">
        <Stack gap={4} ta="center">
          <Text size="sm">{donVi.toChuc.ten}</Text>
          <Text size="xs" c="dimmed">
            {donVi.toChuc.diaChi}
          </Text>
          <Group justify="center" gap="xs">
            <Anchor component={Link} to="/dang-nhap" size="sm">
              Đăng nhập
            </Anchor>
            <Text size="xs" c="dimmed">
              · {new Date().getFullYear()}
            </Text>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
