import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { trangChuTheoVaiTro } from '@/lib/trangChuTheoVaiTro';
import { congHienTai, daCauHinhCongDonVi, vaiTroDungCong } from '@/lib/congHienTai';
import TrangSaiCong from '@/pages/CongDonVi/TrangSaiCong';
import { useToi } from './AuthContext';

/** Guard route: yêu cầu đã đăng nhập; nếu phai_doi_mat_khau=true, buộc về M2 (CLAUDE.md § Token & bảo mật). */
export function RequireAuth() {
  const { dangTai, daXacThuc, phaiDoiMatKhau, nguoiDung } = useToi();
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

  const laTrangDoiMatKhau = location.pathname === '/doi-mat-khau';

  if (phaiDoiMatKhau && !laTrangDoiMatKhau) {
    return <Navigate to="/doi-mat-khau" replace />;
  }

  if (!phaiDoiMatKhau && laTrangDoiMatKhau) {
    return <Navigate to={trangChuTheoVaiTro(nguoiDung?.vai_tro)} replace />;
  }

  // Issue #55 / ADR 0015 P3: vai trò không thuộc cổng hiện tại → báo + link cổng đúng (chỉ khi đã cấu hình Cổng đơn vị).
  if (!vaiTroDungCong(nguoiDung?.vai_tro ?? '', congHienTai(), daCauHinhCongDonVi())) {
    return <TrangSaiCong />;
  }

  return <Outlet />;
}
