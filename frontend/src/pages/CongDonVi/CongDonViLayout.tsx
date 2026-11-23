import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Box, Button, Group, Image, ScrollArea, Text } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { useChuongTrinhCuaToi, VAI_TRO_DON_VI_NLS } from '@/api/congDonVi';
import { DUONG_DAN_NLS } from '@/pages/Admin/duongDanAdmin';
import { congDonVi } from '@/content/congDonVi';
import logoHcmue from '@/assets/logo-hcmue.png';
import { tokenKhac } from '@/theme';
import { useTieuDeCongDonVi } from './useTieuDeCongDonVi';

// ADR 0015 P1/P2: menu sẽ thêm Hồ sơ đơn vị, Danh sách tham gia… theo vai trò; hiện quản trị dùng chung menu này.
const MENU = [
  { to: '/trang-chu', nhan: 'Trang chủ' },
  { to: '/huong-dan', nhan: 'Hướng dẫn' },
];
// Issue #63 / P1: "Hồ sơ đơn vị" chỉ cho trường, ngay sau Trang chủ.
const MENU_TRUONG = [MENU[0], { to: '/ho-so-don-vi', nhan: 'Hồ sơ đơn vị' }, ...MENU.slice(1)];
// Issue #56/#57: mục chỉ hiện cho quan_tri. Issue #65 / P2: "Tiến độ đợt" là mục quản trị đầu tiên.
const MENU_QUAN_TRI = [
  { to: '/quan-tri/tien-do-dot', nhan: 'Tiến độ đợt' },
  { to: '/quan-tri/dot-trien-khai', nhan: 'Chương trình / Đợt' },
  { to: '/quan-tri/don-vi-tai-khoan', nhan: 'Đơn vị & tài khoản' },
  { to: '/quan-tri/danh-sach-tham-gia', nhan: 'Danh sách tham gia' },
  // Issue #67 / P2: Hợp đồng (xem, xuất Excel cho KHTC).
  { to: '/quan-tri/hop-dong', nhan: 'Hợp đồng' },
];
// Issue #70 / P1: nhóm NLS (4 màn dùng chung với boiduongnls) — chỉ đơn vị có học viên NLS.
const MENU_NLS = [
  { to: DUONG_DAN_NLS.tongQuan(), nhan: 'Tổng quan' },
  { to: DUONG_DAN_NLS.hocVien(), nhan: 'Học viên' },
  { to: DUONG_DAN_NLS.khoa(), nhan: 'Khóa' },
  { to: DUONG_DAN_NLS.baoCao(), nhan: 'Báo cáo' },
];

function MucMenu({ to, nhan }: { to: string; nhan: string }) {
  return (
    <NavLink to={to} style={{ textDecoration: 'none' }}>
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
            borderRadius: 8,
            whiteSpace: 'nowrap',
            background: isActive ? 'rgba(255,255,255,.14)' : 'transparent',
          }}
        >
          {nhan}
        </Text>
      )}
    </NavLink>
  );
}

/** Khung Cổng đơn vị (issue #55): header logo + tên cổng + tài khoản + Đăng xuất, menu ngang cuộn được trên điện thoại. */
export default function CongDonViLayout() {
  useTieuDeCongDonVi();
  const { nguoiDung, dangXuat } = useToi();
  const navigate = useNavigate();
  const vaiTro = nguoiDung?.vai_tro;
  const menu = vaiTro === 'quan_tri' ? [...MENU, ...MENU_QUAN_TRI] : vaiTro === 'truong' ? MENU_TRUONG : MENU;
  const laDonViNls = VAI_TRO_DON_VI_NLS.includes(vaiTro ?? '');
  // Ẩn khi đang tải/lỗi; quan_tri, học viên… không gọi API.
  const coNls = useChuongTrinhCuaToi(laDonViNls).data?.nls === true;

  async function xuLyDangXuat() {
    try {
      await dangXuat();
    } finally {
      navigate('/dang-nhap', { replace: true });
    }
  }

  return (
    <>
      <Box component="header" bg="primary.6" style={{ boxShadow: '0 1px 2px rgba(16,24,40,.15)' }}>
        <Group h={56} px={{ base: 'md', sm: 'xl' }} justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <Image src={logoHcmue} alt="Trường Đại học Sư phạm Thành phố Hồ Chí Minh" h={32} w="auto" fit="contain" />
            <Text c="white" fw={700} fz="sm" lh={1.3} lineClamp={2}>
              {congDonVi.tenCong}
            </Text>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text c="gray.3" fz="sm" ff="monospace" truncate maw={180} visibleFrom="sm">
              {nguoiDung?.ten_dang_nhap}
            </Text>
            <Button variant="subtle" color="gray.3" size="xs" onClick={xuLyDangXuat}>
              Đăng xuất
            </Button>
          </Group>
        </Group>
        <ScrollArea type="never">
          <Group
            component="nav"
            aria-label="Menu Cổng đơn vị"
            gap={4}
            px={{ base: 'sm', sm: 'xl' }}
            pb={8}
            wrap="nowrap"
          >
            {menu.map((m) => (
              <MucMenu key={m.to} to={m.to} nhan={m.nhan} />
            ))}
            {coNls && (
              <Group role="group" aria-label="NLS" gap={4} wrap="nowrap">
                {/* Nhãn nhóm + vạch ngăn: cùng 1 hàng cuộn ngang với menu trên điện thoại. */}
                <Text
                  component="span"
                  aria-hidden
                  fz="xs"
                  fw={700}
                  c="gray.5"
                  pl="sm"
                  ml={4}
                  style={{ borderLeft: '1px solid rgba(255,255,255,.3)', whiteSpace: 'nowrap', letterSpacing: 0.4 }}
                >
                  NLS
                </Text>
                {MENU_NLS.map((m) => (
                  <MucMenu key={m.to} to={m.to} nhan={m.nhan} />
                ))}
              </Group>
            )}
          </Group>
        </ScrollArea>
      </Box>
      <Box component="main" mih="calc(100vh - 96px)" style={{ background: tokenKhac.bg }}>
        <Outlet />
      </Box>
    </>
  );
}
