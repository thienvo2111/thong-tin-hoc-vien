// Hàm thuần nghiệp vụ "học viên đề nghị đổi buổi học". Không phụ thuộc Nest/Prisma client.
import {
  loai_doi_buoi,
  loai_lop_hoc,
  muc_nang_luc,
  trang_thai_active,
  trang_thai_de_nghi,
  trang_thai_diem_danh,
} from '@prisma/client';

export interface LichTomTat {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  buoi_so: number;
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc?: Date;
  lop: {
    khoa_id: string;
    loai_lop: loai_lop_hoc;
    muc_nang_luc: muc_nang_luc | null;
    trang_thai: trang_thai_active;
    si_so_toi_da: number | null;
    ten_lop: string;
  };
}

export type MaLoiDoiBuoi =
  | 'KHOA_TAT'
  | 'HET_LUOT'
  | 'KHONG_THUOC_LOP'
  | 'KHONG_TUONG_DUONG'
  | 'DA_BAT_DAU'
  | 'BUOI_DAY'
  | 'LY_DO'
  | 'DA_XU_LY'
  | 'PHAN_LOP_DOI'
  | 'GIU_CHO'
  | 'TRUNG_BUOI_CHOT'
  | 'DA_DIEM_DANH'
  // ADR 0012 (học bù)
  | 'CHUA_DIEN_RA'
  | 'DA_CO_MAT'
  | 'DA_DOI_BUOI';

export type KetQuaKiemTra =
  { ok: true } | { ok: false; ma: MaLoiDoiBuoi; thong_diep: string };

export const HTTP_THEO_MA: Record<MaLoiDoiBuoi, 400 | 403 | 409> = {
  KHOA_TAT: 403,
  HET_LUOT: 400,
  KHONG_THUOC_LOP: 400,
  KHONG_TUONG_DUONG: 400,
  DA_BAT_DAU: 400,
  LY_DO: 400,
  DA_XU_LY: 409,
  PHAN_LOP_DOI: 409,
  BUOI_DAY: 409,
  GIU_CHO: 409,
  TRUNG_BUOI_CHOT: 400,
  DA_DIEM_DANH: 400,
  CHUA_DIEN_RA: 400,
  DA_CO_MAT: 400,
  DA_DOI_BUOI: 400,
};

const LY_DO_TOI_THIEU = 5;
const LY_DO_TOI_DA = 500;

export function laBuoiTuongDuong(nguon: LichTomTat, dich: LichTomTat): boolean {
  return (
    nguon.lop_id !== dich.lop_id &&
    nguon.buoi_so === dich.buoi_so &&
    nguon.giai_doan_id === dich.giai_doan_id &&
    nguon.lop.khoa_id === dich.lop.khoa_id &&
    nguon.lop.loai_lop === dich.lop.loai_lop &&
    nguon.lop.muc_nang_luc === dich.lop.muc_nang_luc &&
    dich.lop.trang_thai === 'active'
  );
}

export function daBatDau(
  lich: { thoi_gian_bat_dau: Date },
  now: Date,
): boolean {
  return lich.thoi_gian_bat_dau.getTime() <= now.getTime();
}

export function tinhSiSoBuoi(x: {
  so_phan_lop: number;
  so_doi_ra: number;
  so_doi_vao: number;
}): number {
  return x.so_phan_lop - x.so_doi_ra + x.so_doi_vao;
}

// Còn chỗ cho đề nghị này khi tính cả các đề nghị gửi trước nó.
export function conChoChoDeNghi(x: {
  si_so: number;
  si_so_toi_da: number | null;
  so_truoc: number;
}): boolean {
  if (x.si_so_toi_da === null) return true;
  return x.si_so + x.so_truoc < x.si_so_toi_da;
}

// D8 + D11: lượt = số buổi nguồn KHÁC NHAU có đề nghị chờ hoặc đã duyệt —
// đề nghị đổi lại (chờ, cùng buổi nguồn với bản đã duyệt) không tốn thêm lượt.
// ADR 0012 B4: lượt tách theo loại; dòng thiếu `loai` = doi_buoi.
export function soLuotDaDung(
  ds: {
    trang_thai: trang_thai_de_nghi;
    lich_nguon_id: string;
    loai?: loai_doi_buoi;
  }[],
  loai: loai_doi_buoi = 'doi_buoi',
): number {
  return new Set(
    ds
      .filter((d) => d.trang_thai === 'cho_duyet' || d.trang_thai === 'da_duyet')
      .filter((d) => (d.loai ?? 'doi_buoi') === loai)
      .map((d) => d.lich_nguon_id),
  ).size;
}

export function chuanHoaLyDo(s: string | undefined): string | null {
  if (s === undefined) return null;
  const v = s.normalize('NFC').trim();
  if (v.length < LY_DO_TOI_THIEU || v.length > LY_DO_TOI_DA) return null;
  return v;
}

function loi(ma: MaLoiDoiBuoi, thong_diep: string): KetQuaKiemTra {
  return { ok: false, ma, thong_diep };
}

type DauVaoGui = {
    /** ADR 0012: mặc định doi_buoi. */
    loai?: loai_doi_buoi;
    so_buoi_doi_toi_da: number;
    so_luot_da_dung: number;
    buoi_nguon: LichTomTat;
    buoi_dich: LichTomTat;
    lop_phan_hien_tai: string | null;
    si_so_dich: number;
    ly_do: string | undefined;
    /** Đổi lại (D11): buổi chốt của bản đã duyệt cùng buổi nguồn. */
    buoi_chot_hien_tai?: LichTomTat | null;
    /** D12: học viên đã có dòng điểm danh ở buổi nguồn / buổi chốt hiện tại. */
    da_diem_danh_nguon?: boolean;
    da_diem_danh_chot?: boolean;
    /** Học bù: lượt học bù riêng (B4). */
    so_buoi_hoc_bu_toi_da?: number;
    so_luot_hoc_bu_da_dung?: number;
    /** Học bù: điểm danh của học viên ở buổi gốc (null = chưa có dòng). */
    trang_thai_diem_danh_nguon?: trang_thai_diem_danh | null;
    /** Học bù: buổi gốc đã có đổi buổi da_duyet (B6). */
    nguon_co_doi_buoi_da_duyet?: boolean;
};

export function kiemTraGui(x: DauVaoGui, now: Date): KetQuaKiemTra {
  if (x.loai === 'hoc_bu') return kiemTraGuiHocBu(x, now);
  if (x.so_buoi_doi_toi_da <= 0)
    return loi('KHOA_TAT', 'Khóa học chưa mở đề nghị đổi buổi');
  if (x.so_luot_da_dung >= x.so_buoi_doi_toi_da)
    return loi(
      'HET_LUOT',
      `Bạn đã dùng hết ${x.so_buoi_doi_toi_da} lượt đổi buổi của khóa`,
    );
  if (x.lop_phan_hien_tai !== x.buoi_nguon.lop_id)
    return loi('KHONG_THUOC_LOP', 'Buổi này không thuộc lớp của bạn');
  if (!laBuoiTuongDuong(x.buoi_nguon, x.buoi_dich))
    return loi(
      'KHONG_TUONG_DUONG',
      'Buổi chọn không tương đương với buổi của bạn',
    );
  if (daBatDau(x.buoi_nguon, now) || daBatDau(x.buoi_dich, now))
    return loi('DA_BAT_DAU', 'Buổi đã bắt đầu, không thể đổi');
  const chot = x.buoi_chot_hien_tai;
  if (chot && daBatDau(chot, now))
    return loi('DA_BAT_DAU', 'Buổi đã bắt đầu, không thể đổi');
  if (x.da_diem_danh_nguon || (chot && x.da_diem_danh_chot))
    return loi('DA_DIEM_DANH', 'Thầy/Cô đã điểm danh buổi này, không thể đổi');
  if (chot && chot.id === x.buoi_dich.id)
    return loi('TRUNG_BUOI_CHOT', 'Thầy/Cô đang học buổi này rồi');
  return kiemTraChoVaLyDo(x);
}

function kiemTraChoVaLyDo(x: DauVaoGui): KetQuaKiemTra {
  const toiDa = x.buoi_dich.lop.si_so_toi_da;
  if (toiDa !== null && x.si_so_dich >= toiDa)
    return loi('BUOI_DAY', 'Buổi đã đủ sĩ số, hãy chọn buổi khác');
  if (chuanHoaLyDo(x.ly_do) === null)
    return loi('LY_DO', 'Lý do phải từ 5 đến 500 ký tự');
  return { ok: true };
}

// ADR 0012 B2–B6, spec §2: buổi gốc ĐÃ bắt đầu + không có mặt; buổi học bù
// chưa bắt đầu. Đổi lại học bù: D12 chỉ áp cho buổi chốt hiện tại.
function kiemTraGuiHocBu(x: DauVaoGui, now: Date): KetQuaKiemTra {
  const toiDa = x.so_buoi_hoc_bu_toi_da ?? 0;
  if (toiDa <= 0) return loi('KHOA_TAT', 'Khóa học chưa mở đăng ký học bù');
  if ((x.so_luot_hoc_bu_da_dung ?? 0) >= toiDa)
    return loi(
      'HET_LUOT',
      `Thầy/Cô đã dùng hết ${toiDa} lượt học bù của khóa này`,
    );
  if (x.lop_phan_hien_tai !== x.buoi_nguon.lop_id)
    return loi('KHONG_THUOC_LOP', 'Buổi này không thuộc lớp của bạn');
  if (!daBatDau(x.buoi_nguon, now))
    return loi('CHUA_DIEN_RA', 'Buổi này chưa diễn ra — hãy dùng đổi buổi');
  if (x.trang_thai_diem_danh_nguon === 'co_mat')
    return loi('DA_CO_MAT', 'Thầy/Cô đã có mặt buổi này, không cần học bù');
  if (x.nguon_co_doi_buoi_da_duyet)
    return loi('DA_DOI_BUOI', 'Buổi này đã được đổi, liên hệ người hỗ trợ');
  if (!laBuoiTuongDuong(x.buoi_nguon, x.buoi_dich))
    return loi(
      'KHONG_TUONG_DUONG',
      'Buổi chọn không tương đương với buổi của bạn',
    );
  if (daBatDau(x.buoi_dich, now))
    return loi('DA_BAT_DAU', 'Buổi học bù đã bắt đầu, hãy chọn buổi khác');
  const chot = x.buoi_chot_hien_tai;
  if (chot && daBatDau(chot, now))
    return loi('DA_BAT_DAU', 'Buổi đã bắt đầu, không thể đổi');
  if (chot && x.da_diem_danh_chot)
    return loi('DA_DIEM_DANH', 'Thầy/Cô đã điểm danh buổi này, không thể đổi');
  if (chot && chot.id === x.buoi_dich.id)
    return loi('TRUNG_BUOI_CHOT', 'Thầy/Cô đang học buổi này rồi');
  return kiemTraChoVaLyDo(x);
}

type KetQuaDuyet = {
  ket_qua: 'duyet' | 'chan';
  ma?: MaLoiDoiBuoi;
  thong_diep?: string;
  canh_bao: string[];
};

function chan(ma: MaLoiDoiBuoi, thong_diep: string): KetQuaDuyet {
  return { ket_qua: 'chan', ma, thong_diep, canh_bao: [] };
}

type DauVaoDuyet = {
    /** ADR 0012: mặc định doi_buoi. */
    loai?: loai_doi_buoi;
    vai_tro: 'quan_tri' | 'ho_tro_hoc_vien';
    trang_thai: trang_thai_de_nghi;
    buoi_nguon: LichTomTat;
    buoi_chot: LichTomTat;
    lop_phan_hien_tai: string | null;
    si_so: number;
    so_truoc: number;
    /** D12: đã điểm danh ở buổi nguồn / buổi chốt cũ (đổi lại) → không đổi. */
    da_diem_danh_nguon?: boolean;
    da_diem_danh_chot_cu?: boolean;
    /** Học bù: đọc lại trong tx lúc duyệt (có thể được ghi có mặt sau khi gửi). */
    trang_thai_diem_danh_nguon?: trang_thai_diem_danh | null;
    nguon_co_doi_buoi_da_duyet?: boolean;
};

// Đổi buổi: buổi nguồn + buổi chốt chưa bắt đầu, chưa điểm danh (D2, D12).
function chanDoiBuoi(x: DauVaoDuyet, now: Date): KetQuaDuyet | null {
  if (daBatDau(x.buoi_nguon, now) || daBatDau(x.buoi_chot, now))
    return chan('DA_BAT_DAU', 'Buổi đã bắt đầu, không thể đổi');
  if (x.da_diem_danh_nguon || x.da_diem_danh_chot_cu)
    return chan('DA_DIEM_DANH', 'Học viên đã điểm danh buổi này, không thể đổi');
  return null;
}

// Học bù (spec §4): bỏ "buổi gốc chưa bắt đầu" + D12 buổi gốc; thêm DA_CO_MAT.
function chanHocBu(x: DauVaoDuyet, now: Date): KetQuaDuyet | null {
  if (!daBatDau(x.buoi_nguon, now))
    return chan('CHUA_DIEN_RA', 'Buổi này chưa diễn ra — hãy dùng đổi buổi');
  if (x.trang_thai_diem_danh_nguon === 'co_mat')
    return chan('DA_CO_MAT', 'Học viên đã có mặt buổi này, không cần học bù');
  if (x.nguon_co_doi_buoi_da_duyet)
    return chan('DA_DOI_BUOI', 'Buổi này đã được đổi, liên hệ người hỗ trợ');
  if (daBatDau(x.buoi_chot, now))
    return chan('DA_BAT_DAU', 'Buổi học bù đã bắt đầu, hãy chọn buổi khác');
  if (x.da_diem_danh_chot_cu)
    return chan('DA_DIEM_DANH', 'Học viên đã điểm danh buổi này, không thể đổi');
  return null;
}

export function quyetDinhDuyet(x: DauVaoDuyet, now: Date): KetQuaDuyet {
  if (x.trang_thai !== 'cho_duyet')
    return chan('DA_XU_LY', 'Đề nghị đã được xử lý');
  const chanTruoc =
    x.loai === 'hoc_bu' ? chanHocBu(x, now) : chanDoiBuoi(x, now);
  if (chanTruoc) return chanTruoc;
  if (!laBuoiTuongDuong(x.buoi_nguon, x.buoi_chot))
    return chan(
      'KHONG_TUONG_DUONG',
      'Buổi chọn không tương đương với buổi của bạn',
    );
  if (x.lop_phan_hien_tai !== x.buoi_nguon.lop_id)
    return chan(
      'PHAN_LOP_DOI',
      'Phân lớp của học viên đã thay đổi — hãy từ chối',
    );

  const toiDa = x.buoi_chot.lop.si_so_toi_da;
  const day = toiDa !== null && x.si_so >= toiDa;
  const vuotThuTu =
    x.so_truoc > 0 &&
    !conChoChoDeNghi({
      si_so: x.si_so,
      si_so_toi_da: toiDa,
      so_truoc: x.so_truoc,
    });

  if (x.vai_tro === 'ho_tro_hoc_vien') {
    if (day)
      return chan(
        'BUOI_DAY',
        `Buổi đã đủ sĩ số ${x.si_so}/${toiDa} — chọn buổi khác`,
      );
    if (vuotThuTu && toiDa !== null)
      return chan(
        'GIU_CHO',
        `Còn ${toiDa - x.si_so} chỗ, có ${x.so_truoc} đề nghị gửi trước đang chờ — cần xử lý trước`,
      );
    return { ket_qua: 'duyet', canh_bao: [] };
  }

  const canh_bao: string[] = [];
  if (day) canh_bao.push(`Vượt sĩ số ${x.si_so + 1}/${toiDa}`);
  if (vuotThuTu)
    canh_bao.push(`Vượt thứ tự: ${x.so_truoc} đề nghị gửi trước đang chờ`);
  return { ket_qua: 'duyet', canh_bao };
}

// Thứ hạng (k) của đề nghị trong hàng chờ n đề nghị, theo thời điểm gửi.
export function thuTuHang(
  deNghi: { id: string; tao_luc: Date },
  dsCho: { id: string; tao_luc: Date }[],
): { k: number; n: number } {
  const truoc = dsCho.filter((d) => {
    const lech = d.tao_luc.getTime() - deNghi.tao_luc.getTime();
    return lech < 0 || (lech === 0 && d.id < deNghi.id);
  }).length;
  return { k: truoc + 1, n: dsCho.length };
}

/** Buổi trên lịch thực tế của học viên (dùng cho cảnh báo trùng giờ). */
export interface LichTrung {
  id: string;
  buoi_so: number;
  thoi_gian_bat_dau: Date;
  thoi_gian_ket_thuc: Date;
  lop: { ten_lop: string };
}

// Khoảng mở: chạm mép (08:00–12:00 và 12:00–17:00) không tính trùng.
export function buoiTrungGio(
  ungVien: { thoi_gian_bat_dau: Date; thoi_gian_ket_thuc: Date },
  lich: LichTrung[],
): LichTrung[] {
  const bd = ungVien.thoi_gian_bat_dau.getTime();
  const kt = ungVien.thoi_gian_ket_thuc.getTime();
  return lich.filter(
    (b) =>
      bd < b.thoi_gian_ket_thuc.getTime() && b.thoi_gian_bat_dau.getTime() < kt,
  );
}
