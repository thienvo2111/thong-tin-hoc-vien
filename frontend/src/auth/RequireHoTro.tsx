import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { useToi } from './AuthContext';

/** Khu /ho-tro chỉ cho người hỗ trợ học viên (ADR 0003). Đặt BÊN TRONG RequireAuth (đã lo đăng nhập + đổi
 * mật khẩu lần đầu); vai trò khác về trang chủ của mình. */
export function RequireHoTro() {
  const { dangTai, nguoiDung } = useToi();

  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  if (nguoiDung.vai_tro !== 'ho_tro_hoc_vien') {
    return <Navigate to={trangChuTheoVaiTro(nguoiDung.vai_tro)} replace />;
  }

  return <Outlet />;
}
