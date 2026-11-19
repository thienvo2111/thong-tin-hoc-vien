import { Outlet } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import KhongTimThay from '@/pages/KhongTimThay';

/** Bọc các màn chỉ dành cho trường trên Cổng đơn vị (issue #60): vai trò khác thấy 404 và trang con không
 * được mount (không gọi API). Chặn ở frontend chỉ là UX — phân quyền thật ở backend. */
export default function ChiTruongCong() {
  const { dangTai, nguoiDung } = useToi();
  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }
  if (nguoiDung.vai_tro !== 'truong') return <KhongTimThay />;
  return <Outlet />;
}
