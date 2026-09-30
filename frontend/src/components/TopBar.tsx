import { useState } from 'react';
import { Avatar, Box, Burger, Button, Drawer, Group, Image, Stack, Text } from '@mantine/core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import { useHoSoToi } from '@/api/hocVien';
import logoHcmue from '@/assets/logo-hcmue.png';

const MUC_MENU = [
  { toi: '/toi', nhan: 'Trang chủ' },
  { toi: '/toi/ho-so', nhan: 'Hồ sơ' },
  { toi: '/toi/lop-hoc', nhan: 'Lớp học' },
  { toi: '/toi/xac-nhan', nhan: 'Xác nhận' },
  { toi: '/toi/danh-gia-dau-vao', nhan: 'Đánh giá đầu vào' },
];

/** Thanh trên mọi màn hình sau đăng nhập — menu điều hướng, tên học viên, Đăng xuất, liên hệ hỗ trợ (dac-ta § "Route"). */
export function TopBar() {
  const { dangXuat } = useToi();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: hoSo } = useHoSoToi();
  const hoTro = import.meta.env.VITE_HOTRO_LIEN_HE;
  const [menuMoDt, setMenuMoDt] = useState(false);

  async function xuLyDangXuat() {
    setMenuMoDt(false);
    await dangXuat();
    navigate('/dang-nhap', { replace: true });
  }

  const tenHocVien = hoSo?.ho_ten ?? 'Thầy/Cô';
  const chuCaiDau = tenHocVien.trim().charAt(0).toUpperCase() || 'T';

  return (
    <Box component="header" bg="primary.6" style={{ boxShadow: '0 1px 2px rgba(16,24,40,.15)' }}>
      <Group h={68} px={{ base: 'md', sm: 'xl' }} justify="space-between" wrap="nowrap">
        <Group gap="lg" wrap="nowrap">
          <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={36} w="auto" fit="contain" />
          <Group gap={4} visibleFrom="sm">
            {MUC_MENU.map((m) => (
              <Text
                key={m.toi}
                component={Link}
                to={m.toi}
                px="md"
                py={8}
                fw={600}
                fz="sm"
                c={location.pathname === m.toi ? 'white' : 'gray.4'}
                style={{
                  borderRadius: 8,
                  textDecoration: 'none',
                  background: location.pathname === m.toi ? 'rgba(255,255,255,.14)' : 'transparent',
                }}
              >
                {m.nhan}
              </Text>
            ))}
          </Group>
        </Group>

        <Group gap="md" wrap="nowrap" visibleFrom="sm">
          {hoTro && (
            <Text size="sm" c="gray.4">
              Hỗ trợ: {hoTro}
            </Text>
          )}
          <Group gap="xs" wrap="nowrap">
            <Avatar radius="xl" color="accent" size={36}>
              {chuCaiDau}
            </Avatar>
            <Text c="white" fw={600} fz="sm" truncate maw={160}>
              {tenHocVien}
            </Text>
          </Group>
          <Button variant="subtle" color="gray.3" size="xs" onClick={xuLyDangXuat}>
            Đăng xuất
          </Button>
        </Group>

        <Burger opened={menuMoDt} onClick={() => setMenuMoDt((v) => !v)} color="white" hiddenFrom="sm" />
      </Group>

      <Drawer opened={menuMoDt} onClose={() => setMenuMoDt(false)} title={tenHocVien} position="right" hiddenFrom="sm">
        <Stack gap="xs">
          {MUC_MENU.map((m) => (
            <Text
              key={m.toi}
              component={Link}
              to={m.toi}
              onClick={() => setMenuMoDt(false)}
              px="md"
              py={10}
              fw={600}
              c={location.pathname === m.toi ? 'primary.6' : 'dark'}
              style={{
                borderRadius: 8,
                textDecoration: 'none',
                background: location.pathname === m.toi ? 'var(--mantine-color-primary-0)' : 'transparent',
              }}
            >
              {m.nhan}
            </Text>
          ))}
          {hoTro && (
            <Text size="sm" c="dimmed" px="md">
              Hỗ trợ: {hoTro}
            </Text>
          )}
          <Button variant="light" onClick={xuLyDangXuat}>
            Đăng xuất
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}
