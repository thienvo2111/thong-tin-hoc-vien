// Issue #68 / ADR 0015 M3, M6, S1, S3: quy tắc thuần (không DB) chụp danh sách NLS từ ghi danh các khóa của đợt.
// "Giai đoạn học" của khóa = giai đoạn có lớp (có buổi lịch học hoặc phân lớp), không phải hình thức đánh giá,
// theo thu_tu. Suất theo phân lớp giai đoạn (S3) — KHÔNG theo điểm danh.
import {
  GiaiDoanThamGia,
  TyLeSuat,
  suatTuGiaiDoan,
  tongSuat,
} from './quy-tac-hop-dong';

/** Enum giai_doan_tham_gia chỉ biểu diễn được tối đa 2 giai đoạn học. */
export const SO_GIAI_DOAN_HOC_TOI_DA = 2;
/** Cột danh_sach_tham_gia.lop là VARCHAR(100). */
export const DO_DAI_LOP_TOI_DA = 100;

export class QuaNhieuGiaiDoanHocError extends Error {
  constructor(public readonly soGiaiDoanHoc: number) {
    super(
      `Khóa có ${soGiaiDoanHoc} giai đoạn học — chỉ chụp được khóa có tối đa ${SO_GIAI_DOAN_HOC_TOI_DA} giai đoạn học`,
    );
    this.name = 'QuaNhieuGiaiDoanHocError';
  }
}

/**
 * ADR 0015 S1 cho NLS: `cacGiaiDoanDaHoc` = chỉ số (0 = giai đoạn học đầu tiên theo thu_tu) các giai đoạn học
 * học viên được phân lớp. Không học giai đoạn nào → null (không thành dòng). Khóa 1 giai đoạn học: học → Cả 2.
 * Khóa 2 giai đoạn học: cả hai → Cả 2; chỉ GĐ1 / chỉ GĐ2 → 0,5 suất. > 2 giai đoạn học → QuaNhieuGiaiDoanHocError.
 */
export function giaiDoanThamGia(
  soGiaiDoanHoc: number,
  cacGiaiDoanDaHoc: readonly number[],
): GiaiDoanThamGia | null {
  if (soGiaiDoanHoc > SO_GIAI_DOAN_HOC_TOI_DA) {
    throw new QuaNhieuGiaiDoanHocError(soGiaiDoanHoc);
  }
  const daHoc = new Set(
    cacGiaiDoanDaHoc.filter((i) => i >= 0 && i < soGiaiDoanHoc),
  );
  if (daHoc.size === 0) return null;
  if (daHoc.size === soGiaiDoanHoc) return 'ca_hai';
  return daHoc.has(0) ? 'chi_gd1' : 'chi_gd2';
}

/** Ngày sinh hoc_vien (3 cột số) → 'YYYY-MM-DD'; ngày không có thật → null. */
export function ngaySinhTuHocVien(
  ngay: number,
  thang: number,
  nam: number,
): string | null {
  const d = new Date(Date.UTC(nam, thang - 1, ngay));
  const hopLe =
    nam >= 1000 &&
    d.getUTCFullYear() === nam &&
    d.getUTCMonth() === thang - 1 &&
    d.getUTCDate() === ngay;
  return hopLe ? d.toISOString().slice(0, 10) : null;
}

/** Tên lớp theo thứ tự giai đoạn học, bỏ trùng, nối ", ", cắt vừa cột lop (100 ký tự). */
export function noiTenLop(tenLop: readonly string[]): string | null {
  const ds = [...new Set(tenLop.map((t) => t.trim()).filter((t) => t !== ''))];
  if (ds.length === 0) return null;
  const lop = ds.join(', ');
  return lop.length <= DO_DAI_LOP_TOI_DA
    ? lop
    : `${lop.slice(0, DO_DAI_LOP_TOI_DA - 1)}…`;
}

export interface KhoaChup {
  id: string;
  ma_khoa: string;
  /** 'YYYY-MM-DD' — so chuỗi = so ngày. */
  thoi_gian_bat_dau: string;
  /** id các giai đoạn học, theo thu_tu. */
  giai_doan_hoc: readonly string[];
}

export interface DonViHocVien {
  id: string;
  ten_don_vi: string;
  loai_don_vi: string;
  trang_thai: string;
}

export interface HocVienChup {
  id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_dinh_danh_moet: string | null;
  don_vi: DonViHocVien;
}

export interface DangKyChup {
  khoa_id: string;
  trang_thai: string;
  hoc_vien: HocVienChup;
  phan_lop: readonly { giai_doan_id: string; ten_lop: string }[];
}

export interface DongChup {
  hoc_vien_id: string;
  don_vi_id: string;
  ho_ten: string;
  ngay_sinh: string | null;
  gioi_tinh: string | null;
  ma_goc: string | null;
  lop: string | null;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: TyLeSuat;
  ghi_chu: string | null;
  y_kien_truong: null;
}

export interface NgoaiPhamVi {
  hoc_vien_id: string;
  ho_ten: string;
  don_vi_ten: string;
  ly_do: string;
}

export interface BoQua {
  /** Số người không có dòng vì chưa được phân lớp giai đoạn học nào (ở mọi khóa của đợt). */
  chua_phan_lop: number;
  /** M6: đơn vị công tác không phải trường đang hoạt động trong phạm vi Sở của đợt. */
  ngoai_pham_vi: NgoaiPhamVi[];
  /** Số người ghi danh ≥ 2 khóa của đợt (gộp thành 1 dòng). */
  trung_khoa: number;
}

export interface KetQuaChup {
  dong: DongChup[];
  bo_qua: BoQua;
}

/** Mã các khóa có > 2 giai đoạn học — cả thao tác bị từ chối, không đoán. */
export function khoaQuaNhieuGiaiDoan(khoa: readonly KhoaChup[]): string[] {
  return khoa
    .filter((k) => k.giai_doan_hoc.length > SO_GIAI_DOAN_HOC_TOI_DA)
    .map((k) => k.ma_khoa)
    .sort((a, b) => a.localeCompare(b));
}

export const LY_DO_KHONG_PHAI_TRUONG = 'Đơn vị công tác không phải trường';
export const LY_DO_NGUNG_HOAT_DONG = 'Trường đã ngưng hoạt động';
export const LY_DO_NGOAI_SO = 'Trường không thuộc phạm vi Sở của đợt';

/** M6: lý do đơn vị công tác không nhận được dòng; null = hợp lệ. `phamViSo` = id cây đơn vị của Sở. */
export function lyDoNgoaiPhamVi(
  donVi: DonViHocVien,
  phamViSo: ReadonlySet<string>,
): string | null {
  if (donVi.loai_don_vi !== 'truong') return LY_DO_KHONG_PHAI_TRUONG;
  if (donVi.trang_thai !== 'active') return LY_DO_NGUNG_HOAT_DONG;
  if (!phamViSo.has(donVi.id)) return LY_DO_NGOAI_SO;
  return null;
}

interface UngVien {
  khoa: KhoaChup;
  dang_ky: DangKyChup;
  giai_doan: GiaiDoanThamGia;
  ty_le_suat: TyLeSuat;
  lop: string | null;
}

/** Thứ tự chọn khi trùng khóa: suất cao hơn → khóa bắt đầu sớm hơn → mã khóa. */
function soSanhUngVien(a: UngVien, b: UngVien): number {
  return (
    b.ty_le_suat - a.ty_le_suat ||
    a.khoa.thoi_gian_bat_dau.localeCompare(b.khoa.thoi_gian_bat_dau) ||
    a.khoa.ma_khoa.localeCompare(b.khoa.ma_khoa)
  );
}

function ungVienCua(
  khoa: KhoaChup,
  dk: DangKyChup,
): Omit<UngVien, 'khoa' | 'dang_ky'> | null {
  const lopTheoGiaiDoan = new Map(
    dk.phan_lop.map((p) => [p.giai_doan_id, p.ten_lop]),
  );
  const chiSo = khoa.giai_doan_hoc
    .map((id, i) => (lopTheoGiaiDoan.has(id) ? i : -1))
    .filter((i) => i >= 0);
  const giai_doan = giaiDoanThamGia(khoa.giai_doan_hoc.length, chiSo);
  if (giai_doan === null) return null;
  return {
    giai_doan,
    ty_le_suat: suatTuGiaiDoan(giai_doan).ty_le_suat,
    lop: noiTenLop(
      khoa.giai_doan_hoc
        .filter((id) => lopTheoGiaiDoan.has(id))
        .map((id) => lopTheoGiaiDoan.get(id) as string),
    ),
  };
}

/**
 * Chụp danh sách NLS: mỗi học viên tối đa 1 dòng. Bỏ ghi danh tu_choi (kể cả còn phân lớp cũ), bỏ người chưa
 * phân lớp giai đoạn học nào, bỏ người ngoài phạm vi (M6). Trùng khóa → giữ ghi danh suất cao hơn (bằng nhau →
 * khóa bắt đầu sớm hơn), ghi chú "Cũng ghi danh khóa …". Khóa > 2 giai đoạn học phải chặn TRƯỚC (khoaQuaNhieuGiaiDoan).
 */
export function lapBanChup(
  khoa: readonly KhoaChup[],
  dangKy: readonly DangKyChup[],
  phamViSo: ReadonlySet<string>,
): KetQuaChup {
  const khoaTheoId = new Map(khoa.map((k) => [k.id, k]));
  const theoHocVien = new Map<
    string,
    { hoc_vien: HocVienChup; ung_vien: UngVien[] }
  >();
  for (const dk of dangKy) {
    const k = khoaTheoId.get(dk.khoa_id);
    if (!k || dk.trang_thai === 'tu_choi') continue;
    const nhom = theoHocVien.get(dk.hoc_vien.id) ?? {
      hoc_vien: dk.hoc_vien,
      ung_vien: [],
    };
    theoHocVien.set(dk.hoc_vien.id, nhom);
    const uv = ungVienCua(k, dk);
    if (uv) nhom.ung_vien.push({ ...uv, khoa: k, dang_ky: dk });
  }

  const bo_qua: BoQua = { chua_phan_lop: 0, ngoai_pham_vi: [], trung_khoa: 0 };
  const dong: DongChup[] = [];
  for (const { hoc_vien: hv, ung_vien } of theoHocVien.values()) {
    if (ung_vien.length === 0) {
      bo_qua.chua_phan_lop++;
      continue;
    }
    const lyDo = lyDoNgoaiPhamVi(hv.don_vi, phamViSo);
    if (lyDo) {
      bo_qua.ngoai_pham_vi.push({
        hoc_vien_id: hv.id,
        ho_ten: hv.ho_ten,
        don_vi_ten: hv.don_vi.ten_don_vi,
        ly_do: lyDo,
      });
      continue;
    }
    const [chon, ...khac] = [...ung_vien].sort(soSanhUngVien);
    if (khac.length > 0) bo_qua.trung_khoa++;
    const maKhac = khac
      .sort(
        (a, b) =>
          a.khoa.thoi_gian_bat_dau.localeCompare(b.khoa.thoi_gian_bat_dau) ||
          a.khoa.ma_khoa.localeCompare(b.khoa.ma_khoa),
      )
      .map((u) => u.khoa.ma_khoa);
    dong.push({
      hoc_vien_id: hv.id,
      don_vi_id: hv.don_vi.id,
      ho_ten: hv.ho_ten,
      ngay_sinh: hv.ngay_sinh,
      gioi_tinh: hv.gioi_tinh,
      ma_goc: hv.ma_dinh_danh_moet,
      lop: chon.lop,
      giai_doan: chon.giai_doan,
      ty_le_suat: chon.ty_le_suat,
      ghi_chu:
        maKhac.length > 0 ? `Cũng ghi danh khóa ${maKhac.join(', ')}` : null,
      y_kien_truong: null,
    });
  }
  bo_qua.ngoai_pham_vi.sort(
    (a, b) =>
      a.don_vi_ten.localeCompare(b.don_vi_ten, 'vi') ||
      a.ho_ten.localeCompare(b.ho_ten, 'vi'),
  );
  return { dong, bo_qua };
}

/** Số dòng + tổng suất (chính xác tuyệt đối) theo trường. */
export function tongHopTheoTruong(
  dong: readonly Pick<DongChup, 'don_vi_id' | 'ty_le_suat'>[],
): Map<string, { so_dong: number; tong_suat: number }> {
  const nhom = new Map<string, { ty_le_suat: number }[]>();
  for (const d of dong) {
    const ds = nhom.get(d.don_vi_id) ?? [];
    ds.push(d);
    nhom.set(d.don_vi_id, ds);
  }
  return new Map(
    [...nhom].map(([id, ds]) => [
      id,
      { so_dong: ds.length, tong_suat: tongSuat(ds) },
    ]),
  );
}
