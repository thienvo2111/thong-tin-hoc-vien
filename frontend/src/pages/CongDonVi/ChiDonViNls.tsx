import { Outlet } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { useChuongTrinhCuaToi, VAI_TRO_DON_VI_NLS } from '@/api/congDonVi';
import KhongTimThay from '@/pages/KhongTimThay';
import { DUONG_DAN_NLS, DuongDanAdminProvider } from '@/pages/Admin/duongDanAdmin';

function DangTai() {
  return (
    <Center mih="40vh">
      <Loader />
    </Center>
  );
}

/** Bọc /nls/* trên Cổng đơn vị (issue #70 / ADR 0015 P1): chỉ trường/Phòng/Sở có học viên NLS; còn lại
 * (kể cả quan_tri — dùng boiduongnls) thấy 404, trang con không mount (không gọi API). Cấp đường dẫn
 * /nls cho 4 màn dùng chung. Chặn ở frontend chỉ là UX — phạm vi dữ liệu thật do API của từng màn. */
export default function ChiDonViNls() {
  const { dangTai, nguoiDung } = useToi();
  const laDonVi = VAI_TRO_DON_VI_NLS.includes(nguoiDung?.vai_tro ?? '');
  const chuongTrinh = useChuongTrinhCuaToi(laDonVi);

  if (dangTai || !nguoiDung) return <DangTai />;
  if (!laDonVi) return <KhongTimThay />;
  if (chuongTrinh.isPending) return <DangTai />;
  if (chuongTrinh.data?.nls !== true) return <KhongTimThay />;
  return (
    <DuongDanAdminProvider value={DUONG_DAN_NLS}>
      <Outlet />
    </DuongDanAdminProvider>
  );
}
