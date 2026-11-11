import {
  CheDoChuyenCan,
  dongDiemDanhBuoi,
  khoaBuoi,
  MucLop,
  tinhChuyenCan,
} from '../common/utils/chuyen-can.util';
import { TrangThaiDiemDanh } from '../common/utils/diem-danh-bao-vang.util';
import { Db } from './doi-buoi-hoc-query.service';

// ADR 0012 B2 + ADR 0014: buổi gốc (lớp hiện tại) đã được tinhChuyenCan công
// nhận có mặt nhờ dòng ở lớp khác cùng (giai_doan, buoi_so) — vd đã có mặt ở
// lớp cũ trước khi chuyển lớp — thì không cần học bù.

export interface BuoiGoc {
  id: string;
  lop_id: string;
  giai_doan_id: string;
  buoi_so: number;
  lop: { muc_nang_luc: MucLop };
}

export interface DongCoMatLopKhac {
  lich_hoc_id: string;
  trang_thai: TrangThaiDiemDanh;
  lich_hoc: {
    lop_id: string;
    giai_doan_id: string;
    buoi_so: number;
    lop: { loai_lop: string; muc_nang_luc: MucLop };
  };
}

/** Thuần: id buổi gốc được công nhận có mặt từ dòng lớp khác theo nấc khóa. */
export function buoiGocCoMatLopKhac(
  goc: readonly BuoiGoc[],
  dong: readonly DongCoMatLopKhac[],
  cheDo: CheDoChuyenCan,
): Set<string> {
  // Buổi gốc luôn thuộc lớp hiện tại của giai đoạn (KHONG_THUOC_LOP).
  const lopHienTai = new Map(goc.map((g) => [g.giai_doan_id, g.lop_id]));
  const mucLop = new Map(goc.map((g) => [g.lop_id, g.lop.muc_nang_luc]));
  const kq = tinhChuyenCan(
    lopHienTai,
    dong.map((d) => dongDiemDanhBuoi({ ...d, dang_ky_hoc_id: '' }, new Map())),
    cheDo,
    mucLop,
  );
  return new Set(
    goc
      .filter(
        (g) =>
          kq.get(khoaBuoi(g.giai_doan_id, g.buoi_so))?.trang_thai === 'co_mat',
      )
      .map((g) => g.id),
  );
}

/** Nạp dòng có mặt ở buổi khác cùng (giai_doan, buoi_so) — 1 truy vấn. */
export async function napBuoiGocCoMatLopKhac(
  db: Db,
  dangKyId: string,
  goc: readonly BuoiGoc[],
): Promise<Set<string>> {
  if (goc.length === 0) return new Set();
  const rows = await db.diem_danh.findMany({
    where: {
      dang_ky_hoc_id: dangKyId,
      trang_thai: 'co_mat',
      lich_hoc_id: { notIn: goc.map((g) => g.id) },
      lich_hoc: {
        OR: goc.map((g) => ({
          giai_doan_id: g.giai_doan_id,
          buoi_so: g.buoi_so,
        })),
      },
    },
    select: {
      lich_hoc_id: true,
      trang_thai: true,
      lich_hoc: {
        select: {
          lop_id: true,
          giai_doan_id: true,
          buoi_so: true,
          lop: {
            select: {
              loai_lop: true,
              muc_nang_luc: true,
              khoa: { select: { che_do_chuyen_can: true } },
            },
          },
        },
      },
    },
  });
  if (rows.length === 0) return new Set();
  const cheDo = rows[0].lich_hoc.lop.khoa.che_do_chuyen_can;
  return buoiGocCoMatLopKhac(goc, rows, cheDo);
}
