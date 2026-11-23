import { Outlet } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useToi } from '@/auth/AuthContext';
import { VAI_TRO_SO_PHONG } from '@/api/donViTienDo';
import KhongTimThay from '@/pages/KhongTimThay';

/** Bọc các màn chỉ dành cho Sở/Phòng (issue #71 / ADR 0015 P1): vai trò khác thấy 404 và trang con không được
 * mount (không gọi API). Chặn ở frontend chỉ là UX — phân quyền và phạm vi thật ở backend. */
export default function ChiSoPhongCong() {
  const { dangTai, nguoiDung } = useToi();
  if (dangTai || !nguoiDung) {
    return (
      <Center mih="40vh">
        <Loader />
      </Center>
    );
  }
  if (!VAI_TRO_SO_PHONG.includes(nguoiDung.vai_tro)) return <KhongTimThay />;
  return <Outlet />;
}
