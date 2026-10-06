import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { useToi } from './AuthContext';

/**
 * Guard route quản trị — tự đủ điều kiện (không phụ thuộc thứ tự lồng route với RequireAuth), lặp lại
 * phần kiểm tra đăng nhập/đổi mật khẩu của RequireAuth rồi chặn thêm hoc_vien/ho_tro_hoc_vien. Mọi vai trò
 * quản lý khác (quan_tri/truong/phong_vhxh/so_gddt) đều dùng chung layout admin, nội dung tự thu hẹp
 * theo phạm vi quyền trả về từ API — không lọc lại theo vai_tro ở FE.
 */
export function RequireAdmin() {
  const { dangTai, daXacThuc, nguoiDung, phaiDoiMatKhau } = useToi();
  const location = useLocation();

  if (dangTai) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }

  if (!daXacThuc) {
    return <Navigate to="/dang-nhap" replace state={{ tu: location.pathname }} />;
  }

  if (phaiDoiMatKhau) {
    return <Navigate to="/doi-mat-khau" replace />;
  }

  // Học viên và người hỗ trợ (ADR 0003, 0004) không dùng layout admin.
  if (
    nguoiDung?.vai_tro === 'hoc_vien' ||
    nguoiDung?.vai_tro === 'ho_tro_hoc_vien' ||
    nguoiDung?.vai_tro === 'ho_tro_giang_vien' ||
    nguoiDung?.vai_tro === 'giang_vien'
  ) {
    return <Navigate to={trangChuTheoVaiTro(nguoiDung.vai_tro)} replace />;
  }

  return <Outlet />;
}
