import { Navigate } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';

/** '/' trên Cổng đơn vị: chưa có trang giới thiệu — đã đăng nhập vào Trang chủ, chưa thì về Đăng nhập. */
export default function TrangGocCongDonVi() {
  const { dangTai, daXacThuc } = useToi();
  if (dangTai) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }
  return <Navigate to={daXacThuc ? '/trang-chu' : '/dang-nhap'} replace />;
}
