import { DotLop } from '../trang-lop/trang-lop.service';
import { TrangThaiNhac, gopTrangThaiNhac } from '../nhac-lich/nhac-lich.util';

// ADR 0004 G5b (issue #17): danh mục quy tắc tự động của bảng kiểm. Mỗi quy
// tắc là 1 hàm thuần (dữ liệu đợt) → { dat, ly_do }. Thêm quy tắc = thêm code
// ở đây; Quản trị chỉ chọn quy tắc nào dùng cho khóa.

export interface NguCanhDot {
  dot: DotLop;
  /** Cảnh báo vượt số phòng của các buổi (DiemHocService.canhBaoVuotSoPhong). */
  canhBaoSoPhong: string[];
}

export interface KetQuaQuyTac {
  dat: boolean;
  ly_do: string | null;
}

export interface QuyTac {
  ten: string;
  kiemTra: (ctx: NguCanhDot) => KetQuaQuyTac;
}

const dat = (): KetQuaQuyTac => ({ dat: true, ly_do: null });
const thieu = (ly_do: string): KetQuaQuyTac => ({ dat: false, ly_do });

function giangVienCuaDot(dot: DotLop) {
  const m = new Map<string, DotLop['buoi'][number]['giang_vien'][number]>();
  for (const b of dot.buoi)
    for (const g of b.giang_vien) if (!m.has(g.id)) m.set(g.id, g);
  return [...m.values()];
}

/** Trạng thái nhắc gộp theo giảng viên của đợt (cần nhắc lại > chưa nhắc > đã nhắc). */
export function nhacTheoGiangVien(dot: DotLop) {
  const m = new Map<
    string,
    { id: string; ho_ten: string; ds: TrangThaiNhac[] }
  >();
  for (const b of dot.buoi)
    for (const g of b.giang_vien) {
      const x = m.get(g.id) ?? { id: g.id, ho_ten: g.ho_ten, ds: [] };
      x.ds.push(g.nhac ?? 'chua_nhac');
      m.set(g.id, x);
    }
  return [...m.values()].map(({ ds, ...g }) => ({
    ...g,
    trang_thai: gopTrangThaiNhac(ds),
  }));
}

export const QUY_TAC: Record<string, QuyTac> = {
  co_diem_hoc: {
    ten: 'Mọi buổi có điểm học',
    kiemTra: ({ dot }) => {
      const thieuBuoi = dot.buoi
        .filter((b) => !b.diem_hoc)
        .map((b) => b.buoi_so);
      if (dot.buoi.length === 0) return thieu('Đợt chưa có buổi học');
      return thieuBuoi.length
        ? thieu(`Buổi ${thieuBuoi.join(', ')} chưa có điểm học`)
        : dat();
    },
  },
  co_giang_vien: {
    ten: 'Mọi buổi có ≥ 1 giảng viên',
    kiemTra: ({ dot }) => {
      const thieuBuoi = dot.buoi
        .filter((b) => b.giang_vien.length === 0)
        .map((b) => b.buoi_so);
      if (dot.buoi.length === 0) return thieu('Đợt chưa có buổi học');
      return thieuBuoi.length
        ? thieu(`Buổi ${thieuBuoi.join(', ')} chưa có giảng viên`)
        : dat();
    },
  },
  khong_vuot_so_phong: {
    ten: 'Không vượt số phòng của điểm học',
    kiemTra: ({ canhBaoSoPhong }) =>
      canhBaoSoPhong.length ? thieu(canhBaoSoPhong.join('; ')) : dat(),
  },
  co_hoc_vien: {
    ten: 'Có học viên, không vượt sĩ số tối đa',
    kiemTra: ({ dot }) => {
      const siSo = dot.hoc_vien.length;
      if (siSo === 0) return thieu('Chưa có học viên được phân lớp ở đợt này');
      const toiDa = dot.lop.si_so_toi_da;
      if (toiDa && siSo > toiDa)
        return thieu(`Sĩ số ${siSo} vượt tối đa ${toiDa}`);
      return dat();
    },
  },
  // L7 (issue #20): đạt khi mọi giảng viên của đợt đã được cấp tài khoản
  // (đã gửi link, chưa bị khóa) — chưa kích hoạt vẫn tính là đã cấp.
  giang_vien_co_tai_khoan: {
    ten: 'Giảng viên đã được cấp tài khoản',
    kiemTra: ({ dot }) => {
      const gv = giangVienCuaDot(dot);
      if (gv.length === 0) return thieu('Chưa phân công giảng viên');
      const thieuEmail = gv
        .filter((g) => g.tai_khoan === 'chua_co' && !g.email)
        .map((g) => g.ho_ten);
      const chuaCap = gv
        .filter((g) => g.tai_khoan === 'chua_co' && g.email)
        .map((g) => g.ho_ten);
      const biKhoa = gv
        .filter((g) => g.tai_khoan === 'bi_khoa')
        .map((g) => g.ho_ten);
      const lyDo = [
        chuaCap.length && `Chưa cấp tài khoản: ${chuaCap.join(', ')}`,
        thieuEmail.length && `Chưa có email: ${thieuEmail.join(', ')}`,
        biKhoa.length && `Tài khoản bị khóa: ${biKhoa.join(', ')}`,
      ].filter(Boolean);
      return lyDo.length ? thieu(lyDo.join('; ')) : dat();
    },
  },
  hau_can_da_xac_nhan: {
    ten: 'Đã xác nhận chỗ ở + phương tiện của mọi giảng viên',
    kiemTra: ({ dot }) => {
      const gv = giangVienCuaDot(dot);
      if (gv.length === 0) return thieu('Chưa phân công giảng viên');
      const chua = gv
        .filter((g) => {
          const h = dot.hau_can.find((x) => x.giang_vien_id === g.id);
          return !h || !h.da_xac_nhan_noi_o || !h.da_xac_nhan_di_chuyen;
        })
        .map((g) => g.ho_ten);
      return chua.length
        ? thieu(`Chưa xác nhận hậu cần: ${chua.join(', ')}`)
        : dat();
    },
  },
  // ADR 0004 G10/G11 (issue #21): mọi (buổi, giảng viên) đã nhắc, không có buổi sửa sau lần nhắc.
  da_nhac_giang_vien: {
    ten: 'Đã nhắc lịch mọi giảng viên',
    kiemTra: ({ dot }) => {
      const nhac = nhacTheoGiangVien(dot);
      if (nhac.length === 0) return thieu('Chưa phân công giảng viên');
      const chua = nhac
        .filter((n) => n.trang_thai === 'chua_nhac')
        .map((n) => n.ho_ten);
      const lai = nhac
        .filter((n) => n.trang_thai === 'can_nhac_lai')
        .map((n) => n.ho_ten);
      const lyDo = [
        chua.length && `Chưa nhắc: ${chua.join(', ')}`,
        lai.length && `Cần nhắc lại (lịch đã đổi): ${lai.join(', ')}`,
      ].filter(Boolean);
      return lyDo.length ? thieu(lyDo.join('; ')) : dat();
    },
  },
  // ADR 0004 G14 (issue #18).
  khong_de_nghi_cho: {
    ten: 'Không còn đề nghị đổi lớp chờ duyệt',
    kiemTra: ({ dot }) =>
      dot.de_nghi_cho.length
        ? thieu(`${dot.de_nghi_cho.length} đề nghị đổi lớp đang chờ duyệt`)
        : dat(),
  },
  co_thuc_dia: {
    ten: 'Có người hỗ trợ thực địa',
    kiemTra: ({ dot }) =>
      dot.thuc_dia.length ? dat() : thieu('Chưa có người hỗ trợ thực địa'),
  },
};

export type TrangThaiMuc = 'dat' | 'chua_dat' | 'qua_han';
export type MauDot = 'xanh' | 'vang' | 'do';

const MOT_NGAY_MS = 24 * 3600 * 1000;

/** Hạn của mục = buổi đầu đợt − N ngày (null nếu mục không có hạn hoặc đợt chưa có buổi). */
export function tinhHan(
  buoiDau: Date | null,
  hanTruocNgay: number | null,
): Date | null {
  if (!buoiDau || hanTruocNgay == null) return null;
  return new Date(buoiDau.getTime() - hanTruocNgay * MOT_NGAY_MS);
}

export function trangThaiMuc(
  datMuc: boolean,
  han: Date | null,
  bayGio: Date,
): TrangThaiMuc {
  if (datMuc) return 'dat';
  return han && bayGio > han ? 'qua_han' : 'chua_dat';
}

/** Đỏ = có mục quá hạn; vàng = có mục chưa đạt (chưa tới hạn / không có hạn); xanh = đạt hết. */
export function mauDot(ds: TrangThaiMuc[]): MauDot {
  if (ds.includes('qua_han')) return 'do';
  if (ds.includes('chua_dat')) return 'vang';
  return 'xanh';
}
