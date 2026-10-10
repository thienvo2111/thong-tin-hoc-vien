import { useState } from 'react';
import { Button, Group, NumberInput, Paper, Select, Stack, Switch, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCapNhatKhoa, type CapNhatKhoaDto } from '@/api/khoaBoiDuong';
import type { CheDoChuyenCan, KhoaBoiDuong } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

const CHE_DO_CHUYEN_CAN: { value: CheDoChuyenCan; label: string }[] = [
  { value: 'theo_lop_hien_tai', label: 'Theo lớp hiện tại (học lại các buổi ở lớp mới)' },
  { value: 'cong_nhan_lop_cu', label: 'Công nhận buổi đã có mặt ở lớp cũ' },
];

// Khoảng hợp lệ khớp UpdateKhoaBoiDuongDto + CHECK trong DB (ADR 0005).
function hopLe(v: number | string, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

/** ADR 0005 (issue #23): công tắc + cấu hình tự điểm danh lớp Zoom của khóa — chỉ quan_tri. */
export function CauHinhDiemDanhZoom({ khoa }: { khoa: KhoaBoiDuong }) {
  const capNhat = useCapNhatKhoa(khoa.id);
  const [moTruoc, setMoTruoc] = useState<number | string>(khoa.diem_danh_mo_truoc_phut);
  const [dongSau, setDongSau] = useState<number | string>(khoa.diem_danh_dong_sau_phut);

  const luu = (dto: CapNhatKhoaDto, thanhCong: (k: KhoaBoiDuong) => string) =>
    capNhat.mutate(dto, {
      onSuccess: (k) => notifications.show({ color: 'green', message: thanhCong(k) }),
      onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
    });

  const phutHopLe = hopLe(moTruoc, 0, 180) && hopLe(dongSau, 15, 720);
  const phutDaDoi = moTruoc !== khoa.diem_danh_mo_truoc_phut || dongSau !== khoa.diem_danh_dong_sau_phut;

  return (
    <Paper withBorder radius={14} p="md">
      <Stack gap="sm">
        <Title order={2} size="h5">
          Điểm danh lớp Zoom
        </Title>
        <Switch
          label="Bật tự điểm danh lớp Zoom"
          description="Học viên bấm 'Điểm danh & vào Zoom' trong cửa sổ điểm danh; hết cửa sổ hệ thống tự chốt vắng. Chỉ áp dụng cho buổi bắt đầu sau thời điểm bật."
          checked={khoa.bat_diem_danh_zoom_luc !== null}
          disabled={capNhat.isPending}
          onChange={(e) =>
            luu({ bat_diem_danh_zoom: e.currentTarget.checked }, (k) =>
              k.bat_diem_danh_zoom_luc ? 'Đã bật tự điểm danh lớp Zoom' : 'Đã tắt tự điểm danh lớp Zoom',
            )
          }
        />
        {khoa.bat_diem_danh_zoom_luc && (
          <Text fz={13} c="dimmed">
            Bật từ {dinhDangNgayGio(khoa.bat_diem_danh_zoom_luc)}
          </Text>
        )}

        <Group align="flex-end" gap="sm">
          <NumberInput
            label="Mở trước giờ bắt đầu (phút)"
            min={0}
            max={180}
            allowDecimal={false}
            value={moTruoc}
            onChange={setMoTruoc}
            w={220}
          />
          <NumberInput
            label="Đóng sau giờ bắt đầu (phút)"
            min={15}
            max={720}
            allowDecimal={false}
            value={dongSau}
            onChange={setDongSau}
            w={220}
          />
          <Button
            disabled={capNhat.isPending || !phutHopLe || !phutDaDoi}
            onClick={() => {
              if (!phutHopLe) return;
              luu({ diem_danh_mo_truoc_phut: moTruoc, diem_danh_dong_sau_phut: dongSau }, () => 'Đã lưu cửa sổ điểm danh');
            }}
          >
            Lưu
          </Button>
        </Group>

        <Select
          label="Chuyên cần khi học viên chuyển lớp Zoom"
          data={CHE_DO_CHUYEN_CAN}
          value={khoa.che_do_chuyen_can}
          allowDeselect={false}
          disabled={capNhat.isPending}
          onChange={(v) => {
            if (!v || v === khoa.che_do_chuyen_can) return;
            luu({ che_do_chuyen_can: v as CheDoChuyenCan }, () => 'Đã lưu cách tính chuyên cần');
          }}
          maw={460}
        />
      </Stack>
    </Paper>
  );
}
