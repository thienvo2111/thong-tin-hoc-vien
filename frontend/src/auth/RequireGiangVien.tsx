import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { useToi } from './AuthContext';

/** Khu /giang-day chỉ cho giảng viên (ADR 0004 G8). Đặt BÊN TRONG RequireAuth; vai trò khác về trang chủ của mình. */
export function RequireGiangVien() {
  const { dangTai, nguoiDung } = useToi();

  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  if (nguoiDung.vai_tro !== 'giang_vien') {
    return <Navigate to={trangChuTheoVaiTro(nguoiDung.vai_tro)} replace />;
  }

  return <Outlet />;
}
