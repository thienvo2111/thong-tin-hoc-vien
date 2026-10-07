import { useCallback } from 'react';
import { Container, Stack, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BoLocThongKe, useLocTuUrl } from './BoLocThongKe';
import { NgoaiPhamViContext } from './KhoiThongKe';
import { KhoiKpiPheu } from './khoi/KhoiKpiPheu';

interface Props {
  /** 'ho_tro' không render khối Xếp hạng (spec §4 khối 8). */
  che_do: 'admin' | 'ho_tro';
}

export default function DashboardThongKe({ che_do }: Props) {
  const [loc, setLoc] = useLocTuUrl();

  const khiNgoaiPhamVi = useCallback(() => {
    notifications.show({
      id: 'thong-ke-ngoai-pham-vi',
      color: 'red',
      message: 'Bộ lọc nằm ngoài phạm vi quyền',
    });
    setLoc({});
  }, [setLoc]);

  return (
    <NgoaiPhamViContext.Provider value={khiNgoaiPhamVi}>
      <Container size="xl" py="md">
        <Stack gap="md" data-che-do={che_do}>
          <Title order={2}>Thống kê</Title>
          <BoLocThongKe />
          {/* Thứ tự spec §4: 1-2 KPI + phễu → 3 so sánh khóa → 4 khảo sát → 5 chuyển mức
              → 6 kết quả học → 7 chuyên cần → 8 xếp hạng (ẩn khi ho_tro) → 9 cần đôn đốc. Các khối 3-9 thêm ở task sau. */}
          <KhoiKpiPheu loc={loc} />
        </Stack>
      </Container>
    </NgoaiPhamViContext.Provider>
  );
}
