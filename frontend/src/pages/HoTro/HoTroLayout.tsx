import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Box, Button, Group, Image, ScrollArea, Text } from '@mantine/core';
import { useDemYeuCauHoTroCuaCum } from '@/api/hoTro';
import { useDemNhacLichCum } from '@/api/nhacLich';
import { useToi } from '@/auth/AuthContext';
import logoHcmue from '@/assets/logo-hcmue.png';
import { tokenKhac } from '@/theme';

const MENU = [
  { to: '/ho-tro', nhan: 'Cụm của tôi', end: true },
  { to: '/ho-tro/hoc-vien', nhan: 'Học viên', end: false },
  { to: '/ho-tro/lich-hoc', nhan: 'Lịch học', end: false },
  { to: '/ho-tro/yeu-cau-ho-tro', nhan: 'Yêu cầu hỗ trợ', end: false },
];

/** Khung khu làm việc của người hỗ trợ học viên (ADR 0003) — tách hẳn layout admin để không rò quyền qua
 * menu/trang quản trị. Menu ngang cuộn được trên điện thoại. */
export default function HoTroLayout() {
  const { nguoiDung, dangXuat } = useToi();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dem = useDemYeuCauHoTroCuaCum();
  const { refetch } = dem;
  // ADR 0003 H13: số đếm chờ xử lý tải lại mỗi lần chuyển trang (không polling, không email từng ticket).
  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);
  const soChoXuLy = dem.data?.cho_xu_ly ?? 0;
  // ADR 0004 G11 (issue #21): buổi 2 ngày tới chưa nhắc / cần nhắc lại.
  const demNhac = useDemNhacLichCum();
  const refetchNhac = demNhac.refetch;
  useEffect(() => {
    void refetchNhac();
  }, [pathname, refetchNhac]);
  const soCanNhac = demNhac.data?.can_nhac ?? 0;

  async function xuLyDangXuat() {
    await dangXuat();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <>
      <Box component="header" bg="primary.6" style={{ boxShadow: '0 1px 2px rgba(16,24,40,.15)' }}>
        <Group h={56} px={{ base: 'md', sm: 'xl' }} justify="space-between" wrap="nowrap">
          <Group gap="md" wrap="nowrap">
            <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={32} w="auto" fit="contain" />
            <Text c="white" fw={700} fz="sm" visibleFrom="xs">
              Hỗ trợ học viên
            </Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text c="gray.3" fz="sm" ff="monospace" truncate maw={180} visibleFrom="xs">
              {nguoiDung?.ten_dang_nhap}
            </Text>
            <Button variant="subtle" color="gray.3" size="xs" onClick={xuLyDangXuat}>
              Đăng xuất
            </Button>
          </Group>
        </Group>
        <ScrollArea type="never">
          <Group component="nav" aria-label="Menu hỗ trợ" gap={4} px={{ base: 'sm', sm: 'xl' }} pb={8} wrap="nowrap">
            {MENU.map((m) => (
              <NavLink key={m.to} to={m.to} end={m.end} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <Text
                    component="span"
                    px="md"
                    py={6}
                    fw={600}
                    fz="sm"
                    c={isActive ? 'white' : 'gray.4'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: 8,
                      whiteSpace: 'nowrap',
                      background: isActive ? 'rgba(255,255,255,.14)' : 'transparent',
                    }}
                  >
                    {m.nhan}
                    {m.to === '/ho-tro/lich-hoc' && soCanNhac > 0 && (
                      <Badge component="span" ml={6} size="sm" color="orange" circle={soCanNhac < 10} aria-label={`${soCanNhac} buổi cần nhắc`}>
                        {soCanNhac}
                      </Badge>
                    )}
                    {m.to === '/ho-tro/yeu-cau-ho-tro' && soChoXuLy > 0 && (
                      <Badge component="span" ml={6} size="sm" color="red" circle={soChoXuLy < 10} aria-label={`${soChoXuLy} yêu cầu chờ xử lý`}>
                        {soChoXuLy}
                      </Badge>
                    )}
                  </Text>
                )}
              </NavLink>
            ))}
          </Group>
        </ScrollArea>
      </Box>
      <Box mih="calc(100vh - 96px)" style={{ background: tokenKhac.bg }}>
        <Outlet />
      </Box>
    </>
  );
}
