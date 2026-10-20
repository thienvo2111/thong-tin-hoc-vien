import type { muc_nang_luc, nguon_moc_nhu_cau } from '@prisma/client';
import { THU_TU_MUC } from '../../khoa-boi-duong/util/muc-hoc.util';

export type GiaiDoanPhanLop = {
  giai_doan_id: string;
  ten_giai_doan: string;
  thu_tu: number;
  bat_dau: string; // YYYY-MM-DD
  ket_thuc: string; // YYYY-MM-DD
  lop: {
    id: string;
    ten_lop: string;
    muc_nang_luc: muc_nang_luc | null;
  } | null;
};

export type MocNhuCau = {
  muc: muc_nang_luc;
  nguon: nguon_moc_nhu_cau;
  lop: { id: string; ten_lop: string } | null;
  giai_doan: { id: string; ten_giai_doan: string } | null;
};

/** Lớp học viên đang được phân công: đang diễn ra > sắp tới gần nhất > đã qua gần nhất. */
export function chonLopDangPhanCong(
  gds: GiaiDoanPhanLop[],
  homNay: string,
): GiaiDoanPhanLop | null {
  const coLop = gds.filter((g) => g.lop !== null);
  const dangDienRa = coLop
    .filter((g) => g.bat_dau <= homNay && homNay <= g.ket_thuc)
    .sort((a, b) => a.thu_tu - b.thu_tu);
  if (dangDienRa.length) return dangDienRa[0];

  const sapToi = coLop
    .filter((g) => g.bat_dau > homNay)
    .sort((a, b) => a.bat_dau.localeCompare(b.bat_dau));
  if (sapToi.length) return sapToi[0];

  const daQua = coLop.sort((a, b) => b.ket_thuc.localeCompare(a.ket_thuc));
  return daQua[0] ?? null;
}

/** Mốc = mức của lớp đang phân công; lớp chưa có mức thì dùng mức đầu vào đã chốt. */
export function tinhMocNhuCau(
  gds: GiaiDoanPhanLop[],
  mucDauVao: muc_nang_luc | null,
  homNay: string,
): MocNhuCau | null {
  const gd = chonLopDangPhanCong(gds, homNay);
  const lop = gd?.lop ?? null;
  const giai_doan = gd
    ? { id: gd.giai_doan_id, ten_giai_doan: gd.ten_giai_doan }
    : null;
  const lopRut = lop ? { id: lop.id, ten_lop: lop.ten_lop } : null;

  if (lop?.muc_nang_luc) {
    return { muc: lop.muc_nang_luc, nguon: 'lop', lop: lopRut, giai_doan };
  }
  if (mucDauVao) {
    return { muc: mucDauVao, nguon: 'muc_chot', lop: lopRut, giai_doan };
  }
  return null;
}

/** Mọi mức ≤ mốc, thấp → cao. */
export function cacMucNhuCauDuocChon(moc: muc_nang_luc): muc_nang_luc[] {
  return (Object.keys(THU_TU_MUC) as muc_nang_luc[])
    .filter((m) => THU_TU_MUC[m] <= THU_TU_MUC[moc])
    .sort((a, b) => THU_TU_MUC[a] - THU_TU_MUC[b]);
}

export function duocChonNhuCau(moc: muc_nang_luc, chon: muc_nang_luc): boolean {
  return THU_TU_MUC[chon] <= THU_TU_MUC[moc];
}

/** Ngày hôm nay 'YYYY-MM-DD' theo Asia/Ho_Chi_Minh. */
export function homNayVN(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
}
