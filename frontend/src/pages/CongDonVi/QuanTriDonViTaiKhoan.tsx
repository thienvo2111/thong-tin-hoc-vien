import { useSearchParams } from 'react-router-dom';
import { Tabs } from '@mantine/core';
import AdminNguoiDung from '@/pages/Admin/AdminNguoiDung';
import AdminDanhMucTruong from '@/pages/Admin/AdminDanhMucTruong';

type Tab = 'tai-khoan' | 'danh-muc';

/** Đơn vị & tài khoản trên Cổng đơn vị (issue #57, ADR 0015 P2): dùng lại 2 màn quản trị sẵn có.
 * Tab đang mở giữ ở ?tab= để F5/chia sẻ link vẫn đúng tab. Route đã bọc ChiQuanTriCong. */
export default function QuanTriDonViTaiKhoan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'danh-muc' ? 'danh-muc' : 'tai-khoan';

  return (
    <Tabs
      value={tab}
      onChange={(v) => setSearchParams({ tab: v === 'danh-muc' ? 'danh-muc' : 'tai-khoan' }, { replace: true })}
      keepMounted={false}
    >
      <Tabs.List px={{ base: 'md', md: 28 }} pt="sm">
        <Tabs.Tab value="tai-khoan">Tài khoản đơn vị</Tabs.Tab>
        <Tabs.Tab value="danh-muc">Danh mục trường</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="tai-khoan">
        <AdminNguoiDung duongDanNhapExcel="/quan-tri/nhap-tai-khoan-don-vi" choGuiEmailKichHoat={false} />
      </Tabs.Panel>
      <Tabs.Panel value="danh-muc">
        <AdminDanhMucTruong />
      </Tabs.Panel>
    </Tabs>
  );
}
