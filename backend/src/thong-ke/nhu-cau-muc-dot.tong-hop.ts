import type { muc_nang_luc } from '@prisma/client';
import { THU_TU_MUC } from '../khoa-boi-duong/util/muc-hoc.util';
import {
  DongNhuCauMucDot,
  NhuCauMucDotResult,
  NhuCauMucDotTruong,
} from './thong-ke.types';

const tyLe = (tu: number, mau: number) =>
  mau ? Math.round((tu / mau) * 1000) / 10 : 0;

/**
 * Tổng hợp nhu cầu mức học của 1 đợt (hàm thuần). Mỗi dòng là 1 đăng ký đủ
 * điều kiện hoặc đã có lựa chọn; ma trận và hạ mức dùng mốc LÚC CHỌN.
 */
export function tongHopNhuCauMucDot(
  rows: DongNhuCauMucDot[],
): NhuCauMucDotResult {
  const maTran = new Map<string, number>();
  const truong = new Map<string, NhuCauMucDotTruong>();
  let daChon = 0;

  for (const r of rows) {
    const dv = r.hoc_vien.truong ?? r.hoc_vien.don_vi;
    let t = truong.get(dv.id);
    if (!t) {
      t = {
        don_vi_id: dv.id,
        ten: dv.ten,
        tong: 0,
        da_chon: 0,
        chua_chon: 0,
        ha_muc: 0,
      };
      truong.set(dv.id, t);
    }
    t.tong += 1;
    const lc = r.lua_chon;
    if (!lc) {
      t.chua_chon += 1;
      continue;
    }
    daChon += 1;
    t.da_chon += 1;
    if (THU_TU_MUC[lc.muc_chon] < THU_TU_MUC[lc.muc_moc]) t.ha_muc += 1;
    const khoa = `${lc.muc_moc}|${lc.muc_chon}`;
    maTran.set(khoa, (maTran.get(khoa) ?? 0) + 1);
  }

  const ma_tran = [...maTran.entries()]
    .map(([khoa, so_luong]) => {
      const [muc_moc, muc_chon] = khoa.split('|') as [
        muc_nang_luc,
        muc_nang_luc,
      ];
      return { muc_moc, muc_chon, so_luong };
    })
    .sort(
      (a, b) =>
        THU_TU_MUC[b.muc_moc] - THU_TU_MUC[a.muc_moc] ||
        THU_TU_MUC[b.muc_chon] - THU_TU_MUC[a.muc_chon],
    );

  return {
    tong_du_dieu_kien: rows.length,
    da_chon: daChon,
    chua_chon: rows.length - daChon,
    ty_le_da_chon: tyLe(daChon, rows.length),
    ma_tran,
    theo_truong: [...truong.values()].sort((a, b) =>
      a.ten.localeCompare(b.ten, 'vi'),
    ),
  };
}
