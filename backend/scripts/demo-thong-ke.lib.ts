// Hàm THUẦN (không Prisma) của script dữ liệu demo dashboard thống kê.
// Chỉ dùng cho DB dev — xem demo-thong-ke.ts.

export type LoaiLop = 'truc_tiep' | 'zoom' | 'vle';
export type TrangThaiDiemDanh = 'co_mat' | 'vang' | 'vang_co_phep';
export type KetQuaHoc = 'dang_hoc' | 'dat' | 'khong_dat' | 'vang';

export const NHAN_DEMO_NGUON = 'demo';
export const NHAN_DEMO_GHI_CHU = '[demo]';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function kiemTraDbLocal(url: string | undefined | null): void {
  if (!url) throw new Error('DATABASE_URL rỗng — từ chối chạy.');
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL không hợp lệ — từ chối chạy.');
  }
  if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
    throw new Error(
      `Script demo chỉ chạy trên DB local (host hiện tại: ${host}) — từ chối chạy.`,
    );
  }
}

export interface DangKyDemo {
  id: string;
  hoc_vien_id: string;
  don_vi_id: string;
  nguoi_dung_id: string | null;
  cum_id: string | null;
  ket_qua: KetQuaHoc | null;
}
export interface LopDemo {
  id: string;
  loai_lop: LoaiLop;
}
export interface BuoiDemo {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  thoi_gian_bat_dau: Date;
}
export interface GiaiDoanDemo {
  id: string;
  thu_tu: number;
  hinh_thuc: string;
}

export interface DauVaoKeHoach {
  dangKy: DangKyDemo[];
  lop: LopDemo[];
  buoi: BuoiDemo[];
  giaiDoan: GiaiDoanDemo[];
  cumIds: string[];
  thang: string[];
  now: Date;
  /** `${hoc_vien_id}|${loai}` đã có dòng khảo sát. */
  khaoSatDaCo?: string[];
  /** `${dang_ky_hoc_id}|${lich_hoc_id}` đã có điểm danh. */
  diemDanhDaCo?: string[];
  /** `${dang_ky_hoc_id}|${giai_doan_id}` đã có kết quả giai đoạn. */
  ketQuaGiaiDoanDaCo?: string[];
  /** Ép hệ số tích cực theo trường (dùng cho test). */
  heSoEp?: Record<string, number>;
}

export interface KeHoachDemo {
  heSo: Record<string, number>;
  nguoiDung: { id: string; dang_nhap_lan_cuoi: Date }[];
  dangKy: { id: string; ket_qua?: KetQuaHoc; cum_id?: string }[];
  khaoSat: {
    hoc_vien_id: string;
    loai: string;
    trang_thai: 'hoan_thanh';
    muc_goc: string | null;
    nguon: string;
    hoan_thanh_luc: Date;
    bat_dau_luc: Date;
  }[];
  diemDanh: {
    dang_ky_hoc_id: string;
    lich_hoc_id: string;
    trang_thai: TrangThaiDiemDanh;
    nguon: 'thu_cong';
    ghi_chu: string;
  }[];
  ketQuaGiaiDoan: {
    dang_ky_hoc_id: string;
    giai_doan_id: string;
    ty_le_hoan_thanh: number;
    ghi_chu: string;
  }[];
  ghiChuLog: string[];
}

const NGAY_MS = 24 * 3600 * 1000;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const lam2 = (v: number) => Math.round(v * 100) / 100;

function chonMucGoc(r: () => number, thang: string[]): string {
  const x = r();
  const nguong = [0.15, 0.6, 0.9];
  const i = nguong.findIndex((n) => x < n);
  return thang[i === -1 ? 3 : i];
}

function chonMucRa(r: () => number, thang: string[], vao: string): string {
  const x = r();
  const d = x < 0.6 ? 1 : x < 0.95 ? 0 : -1;
  const i = clamp(thang.indexOf(vao) + d, 0, thang.length - 1);
  return thang[i];
}

function tinhHeSo(dauVao: DauVaoKeHoach, r: () => number) {
  const donVi = [...new Set(dauVao.dangKy.map((d) => d.don_vi_id))].sort();
  const heSo: Record<string, number> = {};
  for (const id of donVi) heSo[id] = lam2(0.2 + 0.75 * r());
  return { donVi, heSo: { ...heSo, ...(dauVao.heSoEp ?? {}) } };
}

function lapTruyCapVaKhaoSat(
  dauVao: DauVaoKeHoach,
  dk: DangKyDemo[],
  heSo: Record<string, number>,
  r: () => number,
  kh: KeHoachDemo,
) {
  const daCo = new Set(dauVao.khaoSatDaCo ?? []);
  const truyCap = new Set<string>();
  const coDauRa = new Set<string>();
  for (const d of dk) {
    if (!d.nguoi_dung_id || r() >= heSo[d.don_vi_id]) continue;
    const luc = new Date(dauVao.now.getTime() - r() * 14 * NGAY_MS);
    kh.nguoiDung.push({ id: d.nguoi_dung_id, dang_nhap_lan_cuoi: luc });
    truyCap.add(d.id);
    const them = (loai: string, muc: string | null) => {
      if (daCo.has(`${d.hoc_vien_id}|${loai}`)) return;
      const xong = new Date(
        Math.min(dauVao.now.getTime(), luc.getTime() + (5 + r() * 55) * 60000),
      );
      kh.khaoSat.push({
        hoc_vien_id: d.hoc_vien_id,
        loai,
        trang_thai: 'hoan_thanh',
        muc_goc: muc,
        nguon: NHAN_DEMO_NGUON,
        hoan_thanh_luc: xong,
        bat_dau_luc: new Date(xong.getTime() - 10 * 60000),
      });
    };
    if (r() >= 0.9) continue;
    them('khao-sat', null);
    if (r() >= 0.85) continue;
    const vao = chonMucGoc(r, dauVao.thang);
    them('danh-gia', vao);
    if (r() >= 0.4) continue;
    them('dau-ra', chonMucRa(r, dauVao.thang, vao));
    coDauRa.add(d.id);
  }
  return { truyCap, coDauRa };
}

function chonBuoiDiemDanh(dauVao: DauVaoKeHoach, kh: KeHoachDemo) {
  const lopDiemDanh = dauVao.lop
    .filter((l) => l.loai_lop !== 'vle')
    .map((l) => l.id)
    .sort();
  const theoLop = new Map<string, BuoiDemo[]>();
  for (const b of dauVao.buoi) {
    if (!lopDiemDanh.includes(b.lop_id)) continue;
    theoLop.set(b.lop_id, [...(theoLop.get(b.lop_id) ?? []), b]);
  }
  const cmp = (a: BuoiDemo, b: BuoiDemo) =>
    a.thoi_gian_bat_dau.getTime() - b.thoi_gian_bat_dau.getTime() ||
    a.id.localeCompare(b.id);
  const daQua = [...theoLop.values()].some((ds) =>
    ds.some((b) => b.thoi_gian_bat_dau < dauVao.now),
  );
  if (!daQua) {
    kh.ghiChuLog.push(
      'Không có buổi nào đã bắt đầu — dùng tối đa 3 buổi đầu mỗi lớp.',
    );
  }
  const buoiTheoLop = new Map<string, BuoiDemo[]>();
  for (const [lop, ds] of theoLop) {
    const sx = [...ds].sort(cmp);
    buoiTheoLop.set(
      lop,
      daQua ? sx.filter((b) => b.thoi_gian_bat_dau < dauVao.now) : sx.slice(0, 3),
    );
  }
  return { lopDiemDanh, buoiTheoLop };
}

function lapDiemDanh(
  dauVao: DauVaoKeHoach,
  dk: DangKyDemo[],
  donVi: string[],
  heSo: Record<string, number>,
  r: () => number,
  kh: KeHoachDemo,
) {
  const { lopDiemDanh, buoiTheoLop } = chonBuoiDiemDanh(dauVao, kh);
  const daCo = new Set(dauVao.diemDanhDaCo ?? []);
  const thongKe = new Map<string, { coMat: number; vang: number }>();
  if (lopDiemDanh.length === 0) return thongKe;
  for (const d of dk) {
    const lop = lopDiemDanh[donVi.indexOf(d.don_vi_id) % lopDiemDanh.length];
    const h = heSo[d.don_vi_id];
    const tk = { coMat: 0, vang: 0 };
    for (const b of buoiTheoLop.get(lop) ?? []) {
      let trangThai: TrangThaiDiemDanh = 'co_mat';
      if (r() >= 0.6 + 0.35 * h) trangThai = r() < 0.3 ? 'vang_co_phep' : 'vang';
      if (trangThai === 'co_mat') tk.coMat++;
      else tk.vang++;
      if (daCo.has(`${d.id}|${b.id}`)) continue;
      kh.diemDanh.push({
        dang_ky_hoc_id: d.id,
        lich_hoc_id: b.id,
        trang_thai: trangThai,
        nguon: 'thu_cong',
        ghi_chu: NHAN_DEMO_GHI_CHU,
      });
    }
    thongKe.set(d.id, tk);
  }
  return thongKe;
}

function giaiDoanVle(dauVao: DauVaoKeHoach): string[] {
  const lopVle = new Set(
    dauVao.lop.filter((l) => l.loai_lop === 'vle').map((l) => l.id),
  );
  const ids = [
    ...new Set(
      dauVao.buoi.filter((b) => lopVle.has(b.lop_id)).map((b) => b.giai_doan_id),
    ),
  ].sort();
  if (ids.length > 0 || lopVle.size === 0) return ids;
  const tt = dauVao.giaiDoan
    .filter((g) => g.hinh_thuc === 'truc_tuyen')
    .sort((a, b) => a.thu_tu - b.thu_tu)[0];
  return tt ? [tt.id] : [];
}

function lapVle(
  dauVao: DauVaoKeHoach,
  dk: DangKyDemo[],
  heSo: Record<string, number>,
  r: () => number,
  kh: KeHoachDemo,
) {
  const gds = giaiDoanVle(dauVao);
  const daCo = new Set(dauVao.ketQuaGiaiDoanDaCo ?? []);
  const tb = new Map<string, number>();
  for (const d of dk) {
    const mu = 30 + 60 * heSo[d.don_vi_id];
    const tyLe: number[] = [];
    for (const g of gds) {
      const nhieu = ((r() + r() + r() - 1.5) / 1.5) * 25;
      const v = lam2(clamp(Math.round(mu + nhieu), 0, 100));
      tyLe.push(v);
      if (daCo.has(`${d.id}|${g}`)) continue;
      kh.ketQuaGiaiDoan.push({
        dang_ky_hoc_id: d.id,
        giai_doan_id: g,
        ty_le_hoan_thanh: v,
        ghi_chu: NHAN_DEMO_GHI_CHU,
      });
    }
    tb.set(d.id, tyLe.length ? tyLe.reduce((a, b) => a + b, 0) / tyLe.length : 0);
  }
  return tb;
}

export function lapKeHoachDemo(dauVao: DauVaoKeHoach, seed = 2026): KeHoachDemo {
  const r = mulberry32(seed);
  const dk = [...dauVao.dangKy].sort((a, b) => a.id.localeCompare(b.id));
  const { donVi, heSo } = tinhHeSo(dauVao, r);
  const kh: KeHoachDemo = {
    heSo,
    nguoiDung: [],
    dangKy: [],
    khaoSat: [],
    diemDanh: [],
    ketQuaGiaiDoan: [],
    ghiChuLog: [],
  };
  const doi = new Map<string, { ket_qua?: KetQuaHoc; cum_id?: string }>();

  // Cụm: chia luân phiên cho đăng ký chưa có cụm.
  if (dauVao.cumIds.length > 0) {
    const cums = [...dauVao.cumIds].sort();
    dk.filter((d) => !d.cum_id).forEach((d, i) =>
      doi.set(d.id, { cum_id: cums[i % cums.length] }),
    );
  }

  const { truyCap, coDauRa } = lapTruyCapVaKhaoSat(dauVao, dk, heSo, r, kh);
  const diemDanh = lapDiemDanh(dauVao, dk, donVi, heSo, r, kh);
  const vle = lapVle(dauVao, dk, heSo, r, kh);

  for (const d of dk) {
    if (d.ket_qua && d.ket_qua !== 'dang_hoc') continue;
    const tk = diemDanh.get(d.id) ?? { coMat: 0, vang: 0 };
    const tong = tk.coMat + tk.vang;
    const tyLeCoMat = tong ? tk.coMat / tong : 0;
    let ketQua: KetQuaHoc | null = null;
    if (coDauRa.has(d.id)) {
      ketQua = tyLeCoMat >= 0.7 && (vle.get(d.id) ?? 0) >= 50 ? 'dat' : 'khong_dat';
    } else if (!truyCap.has(d.id) && tk.vang >= 2 && r() < 0.5) {
      ketQua = 'vang';
    }
    if (ketQua && ketQua !== d.ket_qua) {
      doi.set(d.id, { ...(doi.get(d.id) ?? {}), ket_qua: ketQua });
    }
  }

  for (const d of dk) {
    const c = doi.get(d.id);
    if (c) kh.dangKy.push({ id: d.id, ...c });
  }
  return kh;
}
