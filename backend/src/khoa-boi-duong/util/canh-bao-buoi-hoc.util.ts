import { hinh_thuc_giai_doan, loai_lop_hoc } from '@prisma/client';
import { formatVnDateTime } from '../../common/utils/vn-datetime.util';

const LECH_GIO_VN_MS = 7 * 60 * 60 * 1000;
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;

// Cảnh báo 🟡 (không chặn dòng) cho import lop_va_lich_hoc — bắt lỗi nhập
// nhầm giai_doan_thu_tu (vd lệch 1 số so với danh sách giai đoạn của khóa):
// buổi nằm ngoài khoảng ngày của giai đoạn, hoặc loại lớp không khớp hình
// thức giai đoạn. giai đoạn lưu @db.Date (00:00 UTC của ngày) -> quy về trọn
// ngày giờ Việt Nam [bắt đầu 00:00, kết thúc 24:00).
export function canhBaoBuoiHocGiaiDoan(
  loaiLop: loai_lop_hoc,
  buoi: { bat_dau: Date; ket_thuc: Date },
  giaiDoan: {
    thu_tu: number;
    ten_giai_doan: string;
    hinh_thuc: hinh_thuc_giai_doan;
    thoi_gian_bat_dau: Date;
    thoi_gian_ket_thuc: Date;
  },
): string | undefined {
  const lyDo: string[] = [];

  const dauGiaiDoan = giaiDoan.thoi_gian_bat_dau.getTime() - LECH_GIO_VN_MS;
  const cuoiGiaiDoan =
    giaiDoan.thoi_gian_ket_thuc.getTime() + MOT_NGAY_MS - LECH_GIO_VN_MS;
  if (
    buoi.bat_dau.getTime() < dauGiaiDoan ||
    buoi.ket_thuc.getTime() > cuoiGiaiDoan
  ) {
    lyDo.push('buổi học nằm ngoài khoảng thời gian của giai đoạn');
  }

  const lech = canhBaoLoaiLopGiaiDoan(loaiLop, giaiDoan.hinh_thuc);
  if (lech) lyDo.push(lech);

  if (lyDo.length === 0) return undefined;
  return `Kiểm tra giai_doan_thu_tu: buổi được gắn vào giai đoạn ${giaiDoan.thu_tu} "${giaiDoan.ten_giai_doan}" — ${lyDo.join('; ')}`;
}

// Loại lớp không khớp hình thức giai đoạn — dùng chung cho import lịch học,
// import phân lớp và gán tay (spec phân lớp theo giai đoạn, mục 4.5).
export function canhBaoLoaiLopGiaiDoan(
  loaiLop: loai_lop_hoc,
  hinhThuc: hinh_thuc_giai_doan,
): string | undefined {
  if (hinhThuc === 'danh_gia') {
    return 'giai đoạn là đánh giá, không phải giai đoạn học';
  }
  if (loaiLop === 'truc_tiep' && hinhThuc === 'truc_tuyen') {
    return 'lớp trực tiếp nhưng giai đoạn là trực tuyến';
  }
  if (loaiLop !== 'truc_tiep' && hinhThuc === 'truc_tiep') {
    return `lớp ${loaiLop} nhưng giai đoạn là trực tiếp`;
  }
  return undefined;
}

// ADR 0005 §9 (issue #28): 2 buổi cùng lớp Zoom có cửa sổ điểm danh
// [bắt đầu − mở trước, bắt đầu + đóng sau] chồng nhau -> học viên dễ bấm nhầm
// buổi. Chỉ cảnh báo, không chặn. Chồng ⇔ |lệch giờ bắt đầu| < mở + đóng
// (chạm đúng 1 thời điểm không tính). cacBuoiKhac: nơi gọi đã loại chính buổi.
export function canhBaoChongCuaSoDiemDanh(
  batDau: Date,
  cacBuoiKhac: { buoi_so: number; thoi_gian_bat_dau: Date }[],
  khoa: { diem_danh_mo_truoc_phut: number; diem_danh_dong_sau_phut: number },
): string[] {
  const doRong =
    (khoa.diem_danh_mo_truoc_phut + khoa.diem_danh_dong_sau_phut) * 60 * 1000;
  return cacBuoiKhac
    .filter(
      (b) =>
        Math.abs(b.thoi_gian_bat_dau.getTime() - batDau.getTime()) < doRong,
    )
    .sort(
      (a, b) => a.thoi_gian_bat_dau.getTime() - b.thoi_gian_bat_dau.getTime(),
    )
    .map(
      (b) =>
        `Cửa sổ điểm danh Zoom chồng với buổi ${b.buoi_so} (${formatVnDateTime(b.thoi_gian_bat_dau)}) cùng lớp — học viên dễ bấm nhầm buổi`,
    );
}

// ADR 0005 §9 (issue #28): số buổi lớp Zoom sắp diễn ra (bắt đầu sau now)
// chưa có link — đếm cả khi khóa chưa bật để Quản trị chuẩn bị trước.
export function demBuoiZoomThieuLink(
  lopHoc: {
    loai_lop: loai_lop_hoc;
    lich_hoc: { thoi_gian_bat_dau: Date; dia_diem_hoac_link: string | null }[];
  }[],
  now: Date,
): number {
  return lopHoc
    .filter((l) => l.loai_lop === 'zoom')
    .flatMap((l) => l.lich_hoc)
    .filter((b) => b.thoi_gian_bat_dau > now && !b.dia_diem_hoac_link?.trim())
    .length;
}
