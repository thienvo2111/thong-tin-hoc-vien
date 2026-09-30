import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Container, Group, Paper, Select, Skeleton, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useHocVienTheoId } from '@/api/admin';
import {
  useCapNhatCumDangKy,
  useCapNhatLopDangKy,
  useChiTietKhoa,
  useKhoaHocCuaHocVien,
  useXoaLopDangKy,
} from '@/api/khoaBoiDuong';
import type { KhoaHocDangKy, LoaiLop } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { TrangThaiBadge } from '@/components/TrangThaiBadge';
import { AdminPageHeader } from './AdminPageHeader';

const NHAN_LOAI_LOP: Record<LoaiLop, string> = {
  truc_tiep: 'Lớp trực tiếp',
  zoom: 'Lớp Zoom',
  vle: 'Lớp VLE',
};

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
  'so_dien_thoai_lien_he',
  'email_lien_he',
  'trinh_do_chuyen_mon',
  'cap_giang_day',
] as const;

export default function AdminHocVienChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useHocVienTheoId(id);

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
      </Container>
    </>
  );
}

// Thêm 2026-09-30 (QĐ10, docs/api-contract.md mục 3) — sửa tay lớp (trực tiếp/Zoom/VLE, 3 loại độc
// lập nhau qua bảng nối dang_ky_hoc_lop) và cụm hỗ trợ Zalo cho từng khóa mà học viên đã ghi danh.
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
  const capNhatLop = useCapNhatLopDangKy(hocVienId);
  const xoaLop = useXoaLopDangKy(hocVienId);
  const capNhatCum = useCapNhatCumDangKy(hocVienId);

  const [chonLop, setChonLop] = useState<Record<LoaiLop, string>>({
    truc_tiep: dangKy.lop_truc_tiep?.id ?? '',
    zoom: dangKy.lop_zoom?.id ?? '',
    vle: dangKy.lop_vle?.id ?? '',
  });
  const [chonCum, setChonCum] = useState(dangKy.cum?.id ?? '');

  function luuLop(loaiLop: LoaiLop) {
    const lopId = chonLop[loaiLop];
    if (!lopId) {
      xoaLop.mutate(
        { dangKyHocId: dangKy.id, loaiLop },
        {
          onSuccess: () => notifications.show({ color: 'green', message: 'Đã bỏ gán lớp' }),
          onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
        },
      );
      return;
    }
    capNhatLop.mutate(
      { dangKyHocId: dangKy.id, dto: { loai_lop: loaiLop, lop_id: lopId } },
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã lưu lớp' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

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
          {(Object.keys(NHAN_LOAI_LOP) as LoaiLop[]).map((loaiLop) => (
            <Group key={loaiLop} gap="sm" wrap="wrap" data-testid={`dong-lop-${loaiLop}`}>
              <Select
                label={NHAN_LOAI_LOP[loaiLop]}
                data={[
                  { value: '', label: '-- Bỏ gán --' },
                  ...khoa.lop_hoc
                    .filter((l) => l.loai_lop === loaiLop)
                    .map((l) => ({ value: l.id, label: l.ten_lop })),
                ]}
                value={chonLop[loaiLop]}
                onChange={(v) => setChonLop((f) => ({ ...f, [loaiLop]: v ?? '' }))}
                allowDeselect={false}
                w={260}
              />
              <Button
                size="xs"
                loading={capNhatLop.isPending || xoaLop.isPending}
                onClick={() => luuLop(loaiLop)}
              >
                Lưu
              </Button>
            </Group>
          ))}

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
