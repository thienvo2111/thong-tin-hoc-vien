import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import type { SsoTarget } from '@/api/hocVien';
import type { TinhTrangBaiKhaoSat } from '@/api/ketQuaKhaoSat';
import { dinhDangNgayGio } from '@/lib/ngay';
import { NHAN_MUC_NANG_LUC, TEN_BAI_KHAO_SAT, nhanTrangThaiKhaoSat } from '@/lib/trangThaiKhaoSat';

const NHAN_NUT: Record<TinhTrangBaiKhaoSat['trang_thai'], string> = {
  chua_lam: 'Làm bài',
  da_mo: 'Làm tiếp',
  dang_lam: 'Làm tiếp',
  hoan_thanh: 'Mở lại trang khảo sát',
};

/** 1 bài trên hệ thống khảo sát: tên + trạng thái (+ mức khi đã xong) + nút vào bài qua SSO.
 * `tinhTrang` chưa tải được -> vẫn cho làm bài, chỉ ẩn trạng thái (không chặn học viên vì lỗi phụ). */
export function BaiKhaoSat({
  loai,
  thuTu,
  tinhTrang,
  dangChuyen,
  khoaNut,
  onLam,
}: {
  loai: SsoTarget;
  thuTu?: number;
  tinhTrang?: TinhTrangBaiKhaoSat;
  dangChuyen: boolean;
  khoaNut: boolean;
  onLam: () => void;
}) {
  const trangThai = tinhTrang?.trang_thai ?? 'chua_lam';
  const xong = trangThai === 'hoan_thanh';
  const badge = tinhTrang && nhanTrangThaiKhaoSat(trangThai, tinhTrang.can_kiem_tra);
  const ten = thuTu ? `${thuTu}. ${TEN_BAI_KHAO_SAT[loai]}` : TEN_BAI_KHAO_SAT[loai];

  return (
    <Paper withBorder radius="md" p="md" aria-label={TEN_BAI_KHAO_SAT[loai]}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Text fw={700}>{ten}</Text>
          {badge && (
            <Badge color={badge.mau} variant="light" style={{ flexShrink: 0 }}>
              {badge.nhan}
            </Badge>
          )}
        </Group>

        {xong && tinhTrang && (
          <Text size="sm">
            {tinhTrang.hoan_thanh_luc && <>Hoàn thành lúc {dinhDangNgayGio(tinhTrang.hoan_thanh_luc)}. </>}
            {tinhTrang.muc ? (
              <>
                Kết quả: mức{' '}
                <Text span fw={700}>
                  {NHAN_MUC_NANG_LUC[tinhTrang.muc]}
                </Text>
                .
              </>
            ) : (
              'Kết quả đang được tổng hợp.'
            )}
          </Text>
        )}

        {tinhTrang?.can_kiem_tra && (
          <Text size="sm" c="orange.9">
            Hệ thống chưa nhận được bài nộp của Thầy/Cô. Nếu đã làm xong, Thầy/Cô vui lòng vào lại trang khảo sát kiểm
            tra và bấm nộp bài.
          </Text>
        )}

        <Button
          size={xong ? 'sm' : 'lg'}
          variant={xong ? 'default' : 'filled'}
          fullWidth
          loading={dangChuyen}
          disabled={khoaNut}
          onClick={onLam}
        >
          {NHAN_NUT[trangThai]}
        </Button>
      </Stack>
    </Paper>
  );
}
