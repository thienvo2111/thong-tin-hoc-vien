import { useCallback, useState } from 'react';
import { Button, Container, Group, Stack, Tabs, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSearchParams } from 'react-router-dom';
import { useBoLocThongKe, xuatBieuMauDangKyTruyCap } from '@/api/thongKe';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { BoLocThongKe, useLocTuUrl } from './BoLocThongKe';
import { NgoaiPhamViContext } from './KhoiThongKe';
import { KhoiCanDonDoc } from './khoi/KhoiCanDonDoc';
import { KhoiChatLuongHoSo } from './khoi/KhoiChatLuongHoSo';
import { KhoiChuyenCan } from './khoi/KhoiChuyenCan';
import { KhoiChuyenMuc } from './khoi/KhoiChuyenMuc';
import { KhoiKetQuaHoc } from './khoi/KhoiKetQuaHoc';
import { KhoiKhaoSat } from './khoi/KhoiKhaoSat';
import { KhoiMucNlsTheoTruong } from './khoi/KhoiMucNlsTheoTruong';
import { KhoiNhuCauMucHoc } from './khoi/KhoiNhuCauMucHoc';
import { KhoiKpiPheu } from './khoi/KhoiKpiPheu';
import { KhoiTienDoTruong } from './khoi/KhoiTienDoTruong';
import { KhoiSoSanhKhoa } from './khoi/KhoiSoSanhKhoa';
import { KhoiXepHang } from './khoi/KhoiXepHang';

interface Props {
  /** 'ho_tro' không render khối Xếp hạng (spec §4 khối 8). */
  che_do: 'admin' | 'ho_tro';
}

const THAM_SO_TAB = 'tab';
const TAB_MAC_DINH = 'tong_quan';
const TAB_VALUES = ['tong_quan', 'ho_so', 'danh_gia', 'nhu_cau', 'hoc_tap'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function tabHopLe(v: string | null): TabValue {
  return (TAB_VALUES as readonly string[]).includes(v ?? '') ? (v as TabValue) : TAB_MAC_DINH;
}

export default function DashboardThongKe({ che_do }: Props) {
  const [loc, setLoc] = useLocTuUrl();
  const boLoc = useBoLocThongKe();
  // Tài khoản trường chỉ có một đơn vị: bảng so sánh các trường vô nghĩa (và API trả 403).
  const hienTienDoTruong = !!boLoc.data && boLoc.data.don_vi_co_dinh == null;

  const [params, setParams] = useSearchParams();
  const tabHienTai = tabHopLe(params.get(THAM_SO_TAB));

  function doiTab(v: string | null) {
    if (!v) return;
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.set(THAM_SO_TAB, v);
        return moi;
      },
      { replace: true },
    );
  }

  const [dangXuat, setDangXuat] = useState(false);

  async function xuatBieuMau() {
    setDangXuat(true);
    try {
      await xuatBieuMauDangKyTruyCap(loc);
    } catch (e) {
      notifications.show({ color: 'red', message: thongDiepLoiChung(e) });
    } finally {
      setDangXuat(false);
    }
  }

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
          <Group justify="space-between" align="center">
            <Title order={2}>Thống kê</Title>
            <Button size="sm" variant="light" loading={dangXuat} onClick={() => void xuatBieuMau()}>
              Xuất biểu mẫu ĐK & truy cập
            </Button>
          </Group>
          <BoLocThongKe />
          {/* Chia tab để mỗi tab chỉ tải (và gọi API) khối đang xem — tránh ~12 request nặng
              cùng lúc. Thứ tự tab theo spec §4: 1 tổng quan (KPI + phễu, so sánh khóa)
              → 2 hồ sơ & đôn đốc → 3 đánh giá NLS thực tế (khảo sát, theo mức, chuyển mức)
              → 4 nhu cầu mức học → 5 học tập (kết quả, chuyên cần, xếp hạng — ẩn khi ho_tro). */}
          <Tabs value={tabHienTai} onChange={doiTab} keepMounted={false}>
            <Tabs.List style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
              <Tabs.Tab value="tong_quan">Tổng quan</Tabs.Tab>
              <Tabs.Tab value="ho_so">Hồ sơ & đôn đốc</Tabs.Tab>
              <Tabs.Tab value="danh_gia">Đánh giá NLS (thực tế)</Tabs.Tab>
              <Tabs.Tab value="nhu_cau">Nhu cầu mức học</Tabs.Tab>
              <Tabs.Tab value="hoc_tap">Học tập</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="tong_quan">
              <Stack gap="md" pt="md">
                <KhoiKpiPheu loc={loc} />
                {hienTienDoTruong && <KhoiTienDoTruong loc={loc} />}
                <KhoiSoSanhKhoa loc={loc} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="ho_so">
              <Stack gap="md" pt="md">
                <KhoiChatLuongHoSo loc={loc} />
                <KhoiCanDonDoc loc={loc} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="danh_gia">
              <Stack gap="md" pt="md">
                <KhoiKhaoSat loc={loc} />
                <KhoiMucNlsTheoTruong loc={loc} />
                <KhoiChuyenMuc loc={loc} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="nhu_cau">
              <Stack gap="md" pt="md">
                <KhoiNhuCauMucHoc loc={loc} />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="hoc_tap">
              <Stack gap="md" pt="md">
                <KhoiKetQuaHoc loc={loc} />
                <KhoiChuyenCan loc={loc} />
                {che_do === 'admin' && <KhoiXepHang loc={loc} />}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </NgoaiPhamViContext.Provider>
  );
}
