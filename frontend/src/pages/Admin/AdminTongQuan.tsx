import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Container, Group, Paper, Skeleton, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useBaoCaoTongHop, useDanhSachHocVien } from '@/api/admin';
import { layDonViCongTac } from '@/api/danhMuc';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

const SO_DONG_CHO_DUYET = 8;

/** KPI card — số liệu THẬT lấy từ API, không bịa (yêu cầu phase 3 mục 3). */
function TheKpi({ nhan, giaTri, ghiChu, dangTai, loi }: { nhan: string; giaTri: string; ghiChu?: string; dangTai: boolean; loi: boolean }) {
  return (
    <Paper withBorder p="md" radius={14}>
      <Text fz={12.5} fw={600} c="dimmed" mb={10}>
        {nhan}
      </Text>
      {dangTai ? (
        <Skeleton height={26} width="60%" mb={6} />
      ) : loi ? (
        <Text fz={13} c="danger.6">
          Không tải được
        </Text>
      ) : (
        <>
          <Text fz={26} fw={800} mb={6}>
            {giaTri}
          </Text>
          {ghiChu && (
            <Text fz={12} c="dimmed" fw={600}>
              {ghiChu}
            </Text>
          )}
        </>
      )}
    </Paper>
  );
}

function chuCaiDauTen(ten: string): string {
  const phan = ten.trim().split(/\s+/);
  return (phan[phan.length - 1]?.charAt(0) ?? '?').toUpperCase();
}

/** Tổng quan quản trị — 3 KPI thật (Tổng học viên, Hồ sơ chờ duyệt, Đơn vị tham gia) + bảng hồ sơ
 * chờ duyệt gần nhất. Bỏ KPI "tỉ lệ xác nhận" vì cần chọn đợt cụ thể (dot_id) — chưa có UI chọn đợt
 * trong phase này, thà bỏ bớt còn hơn bịa số (yêu cầu phase 3 mục 3). */
export default function AdminTongQuan() {
  const tongHocVien = useDanhSachHocVien({ page_size: 1 });
  const choDuyet = useDanhSachHocVien({ trang_thai: 'cho_duyet', page_size: SO_DONG_CHO_DUYET });
  const tongHopDonVi = useBaoCaoTongHop('don_vi');
  // Danh mục đơn vị (không scope theo quyền) — chỉ dùng để tra tên hiển thị trong bảng chờ duyệt,
  // KHÔNG dùng để tính KPI (KPI "Đơn vị tham gia" dùng bao-cao/tong-hop vì có scope theo quyền caller).
  const donViDanhMuc = useQuery({ queryKey: ['danh-muc', 'don-vi-cong-tac', 'all'], queryFn: () => layDonViCongTac({}) });

  const donViMap = new Map((donViDanhMuc.data?.data ?? []).map((d) => [d.id, d.ten_don_vi]));

  return (
    <>
      <AdminPageHeader title="Tổng quan hệ thống" />
      <Container size="xl" py="lg" px={{ base: 'md', md: 28 }}>
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="md">
            <TheKpi
              nhan="Tổng học viên"
              giaTri={(tongHocVien.data?.total ?? 0).toLocaleString('vi-VN')}
              ghiChu="Trong phạm vi quyền"
              dangTai={tongHocVien.isLoading}
              loi={tongHocVien.isError}
            />
            <TheKpi
              nhan="Hồ sơ chờ duyệt"
              giaTri={(choDuyet.data?.total ?? 0).toLocaleString('vi-VN')}
              ghiChu="Cần xử lý"
              dangTai={choDuyet.isLoading}
              loi={choDuyet.isError}
            />
            <TheKpi
              nhan="Đơn vị tham gia"
              giaTri={(tongHopDonVi.data?.rows.length ?? 0).toLocaleString('vi-VN')}
              ghiChu="Trong phạm vi quyền"
              dangTai={tongHopDonVi.isLoading}
              loi={tongHopDonVi.isError}
            />
          </SimpleGrid>

          <Paper withBorder radius={14} p="lg">
            <Group justify="space-between" mb="md">
              <Text fz={14.5} fw={700}>
                Hồ sơ chờ duyệt gần nhất
              </Text>
              <Text component={Link} to="/admin/hoc-vien?trang_thai=cho_duyet" fz={12.5} fw={600}>
                Xem tất cả →
              </Text>
            </Group>

            {choDuyet.isLoading && (
              <Stack gap="sm">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={44} />
                ))}
              </Stack>
            )}

            {choDuyet.isError && <Alert color="red">{thongDiepLoiChung(choDuyet.error)}</Alert>}

            {choDuyet.data && choDuyet.data.data.length === 0 && (
              <Text c="dimmed" fz="sm">
                Không có hồ sơ nào đang chờ duyệt.
              </Text>
            )}

            {choDuyet.data && choDuyet.data.data.length > 0 && (
              <Stack gap={0}>
                {choDuyet.data.data.map((hv) => (
                  <Group
                    key={hv.id}
                    justify="space-between"
                    py={12}
                    style={{ borderBottom: '1px solid #F1F3F6' }}
                  >
                    <Group gap={12}>
                      <Box
                        w={32}
                        h={32}
                        style={{
                          borderRadius: '50%',
                          background: '#EAF0F7',
                          color: '#124874',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {chuCaiDauTen(hv.ho_ten ?? '?')}
                      </Box>
                      <Box>
                        <Text fz={13.5} fw={600}>
                          {hv.ho_ten ?? '(Chưa có tên)'}
                        </Text>
                        <Text fz={12} c="dimmed">
                          {hv.don_vi_cong_tac_id ? (donViMap.get(hv.don_vi_cong_tac_id) ?? '—') : '—'}
                        </Text>
                      </Box>
                    </Group>
                    <Group gap={16}>
                      <TrangThaiBadge trangThai={hv.trang_thai} />
                      <Button component={Link} to={`/admin/hoc-vien/${hv.id}`} variant="default" size="xs">
                        Xem hồ sơ
                      </Button>
                    </Group>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </>
  );
}
