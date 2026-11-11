import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Stack, Text } from '@mantine/core';
import { VLE_CHUA_CAU_HINH_LY_DO, layFormVle, layTrangThaiVle } from '@/api/sso';
import { guiFormVle } from '@/lib/guiFormVle';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { dinhDangNgayGio } from '@/lib/ngay';

export const trangThaiVleKey = ['sso', 'vle', 'trang-thai'] as const;

/** Nút "Vào học VLE" (external-login P.CNTT, api-contract.md mục 10.2) — chỉ hiện ở lớp VLE.
 * Ẩn hẳn khi chức năng chưa được cấu hình; disable + hiện lý do khi học viên chưa có tài khoản VLE
 * (chưa có username/email để khớp sang VLE). Bấm nút mới gọi API lấy field rồi tự submit 1 form POST
 * (cùng tab) — field "key" buộc phải tới trình duyệt học viên (rủi ro đã được chủ sản phẩm chấp
 * nhận, xem api-contract.md mục 10.2), nên không gọi sẵn khi tải trang. */
export function NutVaoHocVle() {
  // refetchOnWindowFocus (mặc định toàn app tắt): học viên vào VLE rồi quay lại tab -> thấy lượt vào mới.
  const trangThai = useQuery({ queryKey: trangThaiVleKey, queryFn: layTrangThaiVle, refetchOnWindowFocus: true });
  const vaoHoc = useMutation({
    mutationFn: layFormVle,
    onSuccess: ({ action, fields }) => guiFormVle(action, fields),
  });

  if (trangThai.isLoading || trangThai.isError) return null;
  const data = trangThai.data;
  if (!data || data.ly_do === VLE_CHUA_CAU_HINH_LY_DO) return null;

  return (
    <Stack gap={4} mt={6} style={{ alignSelf: 'flex-start' }}>
      {vaoHoc.isError && <StatusBanner loai="error">{thongDiepLoiChung(vaoHoc.error)}</StatusBanner>}
      <Button
        size="xs"
        style={{ alignSelf: 'flex-start' }}
        disabled={!data.san_sang}
        loading={vaoHoc.isPending}
        aria-label="Vào học VLE"
        onClick={() => vaoHoc.mutate()}
      >
        Vào học VLE
      </Button>
      {!data.san_sang && data.ly_do && (
        <Text size="xs" c="dimmed">
          {data.ly_do}
        </Text>
      )}
      {/* Lượt vào VLE = số lần cấp form vào VLE (không phải điểm danh). Sau khi bấm, trang chuyển
          sang VLE nên không làm mới ngay — quay lại tab thì refetchOnWindowFocus tự cập nhật. */}
      <Text size="xs" c="dimmed" data-testid="luot-vao-vle">
        {data.so_lan_vao > 0
          ? `Đã vào VLE ${data.so_lan_vao} lần${data.lan_vao_gan_nhat ? ` · gần nhất ${dinhDangNgayGio(data.lan_vao_gan_nhat)}` : ''}`
          : 'Chưa vào VLE lần nào'}
      </Text>
    </Stack>
  );
}
