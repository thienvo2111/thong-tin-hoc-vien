import { Avatar, Box, Group, Image, Stack, Text } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import { useToi } from '@/auth/AuthContext';
import logoHcmue from '@/assets/logo-hcmue.png';
import { MENU_ADMIN } from './menu';

const NHAN_VAI_TRO: Record<string, string> = {
  quan_tri: 'Quản trị viên',
  truong: 'Trường',
  phong_vhxh: 'Phòng VHXH',
  so_gddt: 'Sở GD&ĐT',
};

/** Nội dung sidebar quản trị — dùng chung cho sidebar cố định (desktop) và Drawer (mobile), khớp
 * design/redesign-spec.md § 2 + mockup AdminTongQuan.dc.html. */
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { nguoiDung } = useToi();
  const tenVaiTro = nguoiDung ? (NHAN_VAI_TRO[nguoiDung.vai_tro] ?? nguoiDung.vai_tro) : '';
  const chuCaiDau = tenVaiTro.trim().charAt(0).toUpperCase() || 'Q';

  return (
    <Stack h="100%" gap={0} p="md" justify="space-between" style={{ background: '#0F2942', color: '#fff' }}>
      <Stack gap="lg">
        <Box
          py="sm"
          style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}
        >
          <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={40} w="auto" fit="contain" />
        </Box>

        <Stack gap={2}>
          <Text fz={11} fw={700} c="#5E7A9B" tt="uppercase" style={{ letterSpacing: '.08em' }} px={10} mb={4}>
            Quản trị hệ thống
          </Text>
          {MENU_ADMIN.filter((m) => !m.chiQuanTri || nguoiDung?.vai_tro === 'quan_tri').map((m) => {
            const active = location.pathname === m.to || location.pathname.startsWith(`${m.to}/`);
            return (
              <Text
                key={m.to}
                component={Link}
                to={m.to}
                onClick={onNavigate}
                px={12}
                py={10}
                fz={13.5}
                fw={600}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  borderRadius: 8,
                  textDecoration: 'none',
                  background: active ? '#124874' : 'transparent',
                  color: active ? '#fff' : '#B8CBE0',
                }}
              >
                <span aria-hidden>{m.icon}</span>
                {m.nhan}
                {m.sapRaMat && (
                  <Text component="span" fz={10} fw={700} c="#7C93AE" ml="auto">
                    Sắp ra mắt
                  </Text>
                )}
              </Text>
            );
          })}
        </Stack>
      </Stack>

      {nguoiDung && (
        <Box p={12} style={{ borderRadius: 10, background: 'rgba(255,255,255,.05)' }}>
          <Group gap={10} wrap="nowrap">
            <Avatar radius="xl" size={32} color="accent">
              {chuCaiDau}
            </Avatar>
            <Box style={{ minWidth: 0 }}>
              <Text fz={12.5} fw={600} c="white" truncate maw={140}>
                {nguoiDung.ten_dang_nhap}
              </Text>
              <Text fz={11} c="#7C93AE">
                {tenVaiTro}
              </Text>
            </Box>
          </Group>
        </Box>
      )}
    </Stack>
  );
}
