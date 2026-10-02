import { hinh_thuc_giai_doan, loai_lop_hoc } from '@prisma/client';

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
