import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { useToi } from './AuthContext';

/** Khu /ho-tro-gv chỉ cho người hỗ trợ giảng viên (ADR 0004). Đặt BÊN TRONG RequireAuth; vai trò khác về
 * trang chủ của mình. */
export function RequireHoTroGv() {
  const { dangTai, nguoiDung } = useToi();

  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  if (nguoiDung.vai_tro !== 'ho_tro_giang_vien') {
    return <Navigate to={trangChuTheoVaiTro(nguoiDung.vai_tro)} replace />;
  }

  return <Outlet />;
}
