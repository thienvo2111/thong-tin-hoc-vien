import { useCallback } from 'react';
import { Container, Stack, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useBoLocThongKe } from '@/api/thongKe';
import { BoLocThongKe, useLocTuUrl } from './BoLocThongKe';
import { NgoaiPhamViContext } from './KhoiThongKe';
import { KhoiCanDonDoc } from './khoi/KhoiCanDonDoc';
import { KhoiChuyenCan } from './khoi/KhoiChuyenCan';
import { KhoiChuyenMuc } from './khoi/KhoiChuyenMuc';
import { KhoiKetQuaHoc } from './khoi/KhoiKetQuaHoc';
import { KhoiKhaoSat } from './khoi/KhoiKhaoSat';
import { KhoiKpiPheu } from './khoi/KhoiKpiPheu';
import { KhoiTienDoTruong } from './khoi/KhoiTienDoTruong';
import { KhoiSoSanhKhoa } from './khoi/KhoiSoSanhKhoa';
import { KhoiXepHang } from './khoi/KhoiXepHang';

interface Props {
  /** 'ho_tro' không render khối Xếp hạng (spec §4 khối 8). */
  che_do: 'admin' | 'ho_tro';
}

export default function DashboardThongKe({ che_do }: Props) {
  const [loc, setLoc] = useLocTuUrl();
  const boLoc = useBoLocThongKe();
  // Tài khoản trường chỉ có một đơn vị: bảng so sánh các trường vô nghĩa (và API trả 403).
  const hienTienDoTruong = !!boLoc.data && boLoc.data.don_vi_co_dinh == null;

  const khiNgoaiPhamVi = useCallback(() => {
    notifications.show({
      id: 'thong-ke-ngoai-pham-vi',
      color: 'red',
      message: 'Bộ lọc nằm ngoài phạm vi quyền',
    });
    setLoc({ doi_tuong: loc.doi_tuong });
  }, [setLoc, loc.doi_tuong]);

  return (
    <NgoaiPhamViContext.Provider value={khiNgoaiPhamVi}>
      <Container size="xl" py="md">
        <Stack gap="md" data-che-do={che_do}>
          <Title order={2}>Thống kê</Title>
          <BoLocThongKe />
          {/* Thứ tự spec §4: 1-2 KPI + phễu → 3 so sánh khóa → 4 khảo sát → 5 chuyển mức
              → 6 kết quả học → 7 chuyên cần → 8 xếp hạng (ẩn khi ho_tro) → 9 cần đôn đốc. */}
          <KhoiKpiPheu loc={loc} />
          {hienTienDoTruong && <KhoiTienDoTruong loc={loc} />}
          <KhoiSoSanhKhoa loc={loc} />
          <KhoiKhaoSat loc={loc} />
          <KhoiChuyenMuc loc={loc} />
          <KhoiKetQuaHoc loc={loc} />
          <KhoiChuyenCan loc={loc} />
          {che_do === 'admin' && <KhoiXepHang loc={loc} />}
          <KhoiCanDonDoc loc={loc} />
        </Stack>
      </Container>
    </NgoaiPhamViContext.Provider>
  );
}
