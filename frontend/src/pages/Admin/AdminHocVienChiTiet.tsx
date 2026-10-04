import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Group, Paper, Select, Skeleton, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useHocVienTheoId } from '@/api/admin';
import { useNhatKyHocVien } from '@/api/taiKhoanHocVien';
import { useToi } from '@/auth/AuthContext';
import { DongThoiGianNhatKy } from '@/components/DongThoiGianNhatKy';
import {
  useCapNhatCumDangKy,
  useChiTietKhoa,
  useKhoaHocCuaHocVien,
} from '@/api/khoaBoiDuong';
import type { KhoaHocDangKy } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';
import { PhanLopTheoGiaiDoan } from './PhanLopTheoGiaiDoan';

// Placeholder tối thiểu cho phase này (yêu cầu phase 3 mục 4: "chưa cần đẹp, sẽ hoàn thiện ở phase
// sau") — hiện vài field chính từ GET /hoc-vien/{id}, không phải màn chi tiết đầy đủ.
const TRUONG_HIEN_THI = [
  'ma_dinh_danh_moet',
  'so_dinh_danh_ca_nhan',
  'ngay_sinh',
  'thang_sinh',
  'nam_sinh',
  'gioi_tinh',
  'chuc_vu',
  'doi_tuong',
  'so_dien_thoai_lien_he',
  'email_lien_he',
  'trinh_do_chuyen_mon',
  'cap_giang_day',
] as const;

export default function AdminHocVienChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useHocVienTheoId(id);
  const { nguoiDung } = useToi();

  return (
    <>
      <AdminPageHeader title="Chi tiết hồ sơ học viên" />
      <Container size="sm" py="lg" px={{ base: 'md', md: 28 }}>
        {isLoading && (
          <Stack gap="sm">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={20} />
            ))}
          </Stack>
        )}

        {isError && <Alert color="red">{thongDiepLoiChung(error)}</Alert>}

        {data && (
          <Paper withBorder radius={14} p="lg">
            <Group justify="space-between" mb="md">
              <Text fz={18} fw={700}>
                {data.ho_ten ?? '(Chưa có tên)'}
              </Text>
              <TrangThaiBadge trangThai={data.trang_thai} />
            </Group>
            <Text fz={13} c="dimmed" mb="lg">
              {data.don_vi_cong_tac_ten ?? data.don_vi_cong_tac_id ?? '—'}
            </Text>

            <Stack gap="xs">
              {TRUONG_HIEN_THI.map((truong) => (
                <Group key={truong} justify="space-between" py={6} style={{ borderBottom: '1px solid #F1F3F6' }}>
                  <Text fz={13} c="dimmed">
                    {nhanCuaTruong(truong)}
                  </Text>
                  <Text fz={13} fw={600}>
                    {String(data[truong] ?? '—')}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}

        {id && (
          <Paper withBorder radius={14} p="lg" mt="lg">
            <Text fz={16} fw={700} mb="md">
              Khóa & lớp
            </Text>
            <KhoaVaLopCuaHocVien hocVienId={id} />
          </Paper>
        )}

        {/* Chỉ quản trị: API trả 403 cho tài khoản đơn vị (có IP/thiết bị). */}
        {id && nguoiDung?.vai_tro === 'quan_tri' && (
          <Paper withBorder radius={14} p="lg" mt="lg">
            <Text fz={16} fw={700} mb={4}>
              Nhật ký hoạt động
            </Text>
            <Text fz={13} c="dimmed" mb="md">
              Đăng nhập, sửa hồ sơ, xác nhận, khảo sát, kết quả, phân lớp, email, hỗ trợ — dùng để đối chiếu khi học
              viên phản ánh.
            </Text>
            <NhatKyCuaHocVien hocVienId={id} />
          </Paper>
        )}
      </Container>
    </>
  );
}

function NhatKyCuaHocVien({ hocVienId }: { hocVienId: string }) {
  const { data, isLoading, isError, error } = useNhatKyHocVien(hocVienId);
  if (isLoading) return <Skeleton height={80} />;
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  return data ? <DongThoiGianNhatKy muc={data.muc} /> : null;
}

// Thêm 2026-09-30 (QĐ10, docs/api-contract.md mục 3) — sửa tay phân lớp theo giai đoạn (spec
// 2026-10-02, xem PhanLopTheoGiaiDoan) và cụm hỗ trợ Zalo cho từng khóa mà học viên đã ghi danh.
// Thao tác sửa tay ít dùng — giao diện đơn giản (Select + nút Lưu), không cần đẹp phức tạp, đúng tính
// chất "placeholder, hoàn thiện sau" của trang này.
function KhoaVaLopCuaHocVien({ hocVienId }: { hocVienId: string }) {
  const { data, isLoading, isError, error } = useKhoaHocCuaHocVien(hocVienId);

  if (isLoading) {
    return (
      <Stack gap="sm">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={20} />
        ))}
      </Stack>
    );
  }
  if (isError) return <Alert color="red">{thongDiepLoiChung(error)}</Alert>;
  if (!data || data.length === 0) return <Text c="dimmed">Chưa ghi danh khóa nào.</Text>;

  return (
    <Stack gap="xl">
      {data.map((dangKy) => (
        <KhoiDangKy key={dangKy.id} hocVienId={hocVienId} dangKy={dangKy} />
      ))}
    </Stack>
  );
}

function KhoiDangKy({ hocVienId, dangKy }: { hocVienId: string; dangKy: KhoaHocDangKy }) {
  const { data: khoa } = useChiTietKhoa(dangKy.khoa_id);
  const capNhatCum = useCapNhatCumDangKy(hocVienId);

  const [chonCum, setChonCum] = useState(dangKy.cum?.id ?? '');

  function luuCum() {
    capNhatCum.mutate(
      { dangKyHocId: dangKy.id, dto: { cum_id: chonCum || null } },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã lưu cụm' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Box>
      <Text fw={600} mb="xs">
        {dangKy.khoa.ten_khoa}
      </Text>

      {!khoa && <Skeleton height={20} />}

      {khoa && (
        <Stack gap="sm">
          <PhanLopTheoGiaiDoan hocVienId={hocVienId} dangKy={dangKy} khoa={khoa} />

          <Group gap="sm" wrap="wrap" data-testid="dong-cum">
            <Select
              label="Cụm hỗ trợ Zalo"
              data={[
                { value: '', label: '-- Bỏ gán --' },
                ...khoa.cum_hoc_vien.map((c) => ({ value: c.id, label: c.ten_cum })),
              ]}
              value={chonCum}
              onChange={(v) => setChonCum(v ?? '')}
              allowDeselect={false}
              w={260}
            />
            <Button size="xs" loading={capNhatCum.isPending} onClick={luuCum}>
              Lưu
            </Button>
          </Group>
        </Stack>
      )}
    </Box>
  );
}
