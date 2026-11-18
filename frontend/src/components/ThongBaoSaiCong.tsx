import { Anchor, Text } from '@mantine/core';
import { congDonVi } from '@/content/congDonVi';
import { urlCong, type Cong } from '@/lib/congHienTai';
import { StatusBanner } from './StatusBanner';

const NOI_DUNG: Record<Cong, { thongBao: string; nhanLienKet: string }> = {
  nls: {
    thongBao: 'Tài khoản này dùng trên trang Bồi dưỡng năng lực số.',
    nhanLienKet: 'Mở trang Bồi dưỡng năng lực số',
  },
  don_vi: {
    thongBao: 'Tài khoản đơn vị đăng nhập tại Cổng đơn vị.',
    nhanLienKet: `Mở ${congDonVi.tenCong}`,
  },
};

/** ADR 0015 P3: báo tài khoản thuộc cổng khác + link sang cổng đúng. Không tự chuyển hướng (2 tên miền không chung phiên). */
export function ThongBaoSaiCong({ congDung }: { congDung: Cong }) {
  const { thongBao, nhanLienKet } = NOI_DUNG[congDung];
  const url = urlCong(congDung);
  return (
    <StatusBanner loai="error">
      <Text size="sm">{thongBao}</Text>
      {url && (
        <Anchor href={url} size="sm" fw={600} mt={4} display="inline-block">
          {nhanLienKet}
        </Anchor>
      )}
    </StatusBanner>
  );
}
