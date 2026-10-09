// ADR 0005 Z2 (issue #23): cửa sổ tự điểm danh lớp Zoom
// [bắt đầu − mở trước, bắt đầu + đóng sau], hai đầu tính là trong cửa sổ.
// Không cắt theo giờ kết thúc buổi. Hàm thuần — `now` do nơi gọi truyền vào
// (API vào học, API trang lớp, cron chốt vắng dùng chung).
export type PhaDiemDanh = 'chua_mo' | 'dang_mo' | 'da_dong';

const MOT_PHUT_MS = 60 * 1000;

export function tinhCuaSoDiemDanh(
  buoi: { thoi_gian_bat_dau: Date },
  khoa: { diem_danh_mo_truoc_phut: number; diem_danh_dong_sau_phut: number },
  now: Date,
): { mo: Date; dong: Date; pha: PhaDiemDanh } {
  const batDau = buoi.thoi_gian_bat_dau.getTime();
  const mo = new Date(batDau - khoa.diem_danh_mo_truoc_phut * MOT_PHUT_MS);
  const dong = new Date(batDau + khoa.diem_danh_dong_sau_phut * MOT_PHUT_MS);
  const t = now.getTime();
  const pha: PhaDiemDanh =
    t < mo.getTime() ? 'chua_mo' : t > dong.getTime() ? 'da_dong' : 'dang_mo';
  return { mo, dong, pha };
}
