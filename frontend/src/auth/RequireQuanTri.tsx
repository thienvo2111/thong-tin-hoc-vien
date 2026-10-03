import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet } from 'react-router-dom';
import { useToi } from './AuthContext';

/** Route chỉ dành cho quan_tri (vd. /admin/nguoi-dung — ADR 0002). Đặt BÊN TRONG RequireAdmin: vai trò
 * quản lý khác bị đưa về Tổng quan thay vì thấy trang lỗi. */
export function RequireQuanTri() {
  const { dangTai, nguoiDung } = useToi();

  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }

  if (nguoiDung.vai_tro !== 'quan_tri') {
    return <Navigate to="/admin/tong-quan" replace />;
  }

  return <Outlet />;
}
