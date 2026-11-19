import { Outlet } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import KhongTimThay from '@/pages/KhongTimThay';

/** Bọc các route /quan-tri/* của Cổng đơn vị: chỉ quan_tri; vai trò khác thấy 404 và trang con không
 * được mount (không gọi API). Chặn ở frontend chỉ là UX — phân quyền thật ở backend. */
export default function ChiQuanTriCong() {
  const { dangTai, nguoiDung } = useToi();
  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }
  if (nguoiDung.vai_tro !== 'quan_tri') return <KhongTimThay />;
  return <Outlet />;
}
