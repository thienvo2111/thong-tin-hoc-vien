// Bước dùng chung trong transaction trên danh sách của trường (issue #61, #62, #64 / ADR 0015 X1, X2, X5):
// khóa dòng hop_dong_boi_duong (chặn khi đã nộp hợp đồng), đọc "sai lệch đang mở", đặt trạng thái, tự từ chối đề nghị khi dòng bị xóa.
// Thứ tự khóa luôn là hop_dong trước rồi mới tới dòng danh sách / đề nghị — tránh deadlock.
import type { Prisma, trang_thai_hop_dong } from '@prisma/client';
import {
  ConflictAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exceptions';
import { TrangThaiDanhSach, YKienTruong } from './quy-tac-hop-dong';

export type Tx = Prisma.TransactionClient;

export const KHONG_THAY_DANH_SACH =
  'Không tìm thấy danh sách của trường cho đợt này';

/** X1: người + thời điểm thao tác gần nhất trên danh sách của 1 trường (trường hoặc Quản trị). */
export function thaoTacCuoi(userId: string) {
  const luc = new Date();
  return { thao_tac_cuoi_boi: userId, thao_tac_cuoi_luc: luc, updated_at: luc };
}

// Issue #64 / ADR 0015 X5: hợp đồng đã nộp → danh sách của trường chỉ xem, tới khi Quản trị Mở lại.
export const DA_NOP_TRUONG = 'Hợp đồng đã nộp — danh sách chỉ xem';
export const DA_NOP_QUAN_TRI =
  'Trường đã nộp hợp đồng — Mở lại hợp đồng trước khi sửa danh sách';

export interface TrangThaiDaKhoa {
  danhSach: TrangThaiDanhSach;
  hopDong: trang_thai_hop_dong;
}

/** Khóa FOR UPDATE + đọc cả 2 trạng thái của dòng hop_dong (đợt, trường). Không có → 404. */
export async function khoaTrangThaiHopDong(
  tx: Tx,
  dotId: string,
  donViId: string,
): Promise<TrangThaiDaKhoa> {
  const rows = await tx.$queryRaw<TrangThaiDaKhoa[]>`
    SELECT trang_thai_danh_sach::text AS "danhSach", trang_thai_hop_dong::text AS "hopDong"
    FROM hop_dong_boi_duong
    WHERE dot_trien_khai_id = ${dotId}::uuid AND don_vi_id = ${donViId}::uuid
    FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundAppException(KHONG_THAY_DANH_SACH);
  return rows[0];
}

/**
 * Khóa dòng hop_dong_boi_duong của (đợt, trường) tới hết transaction — thao tác đồng thời trên cùng trường
 * chạy lần lượt, trạng thái tính trên dữ liệu mới nhất. Không có → 404. X5: hợp đồng đã nộp → 409 với
 * thông báo `loiDaNop` (mọi thao tác sửa danh sách đều truyền).
 */
export async function khoaHopDong(
  tx: Tx,
  dotId: string,
  donViId: string,
  loiDaNop: string,
): Promise<TrangThaiDanhSach> {
  const { danhSach, hopDong } = await khoaTrangThaiHopDong(tx, dotId, donViId);
  if (hopDong === 'da_nop') throw new ConflictAppException(loiDaNop);
  return danhSach;
}

/**
 * Khóa hop_dong của nhiều trường (thứ tự don_vi_id cố định). Trường chưa có dòng hợp đồng bị bỏ qua.
 * Trả id các trường đã nộp hợp đồng (X5) — người gọi quyết định chặn.
 */
export async function khoaNhieuHopDong(
  tx: Tx,
  dotId: string,
  donViIds: string[],
): Promise<string[]> {
  if (donViIds.length === 0) return [];
  const rows = await tx.$queryRaw<
    { don_vi_id: string; trang_thai_hop_dong: trang_thai_hop_dong }[]
  >`
    SELECT don_vi_id::text AS don_vi_id, trang_thai_hop_dong::text AS trang_thai_hop_dong
    FROM hop_dong_boi_duong
    WHERE dot_trien_khai_id = ${dotId}::uuid AND don_vi_id = ANY(${donViIds}::uuid[])
    ORDER BY don_vi_id
    FOR UPDATE`;
  return rows
    .filter((r) => r.trang_thai_hop_dong === 'da_nop')
    .map((r) => r.don_vi_id);
}

/** X5 cho Quản trị sửa/thêm/xóa dòng: khóa các trường, có trường đã nộp → 409. */
export async function khoaNhieuHopDongChuaNop(
  tx: Tx,
  dotId: string,
  donViIds: string[],
): Promise<void> {
  const daNop = await khoaNhieuHopDong(tx, dotId, donViIds);
  if (daNop.length > 0) throw new ConflictAppException(DA_NOP_QUAN_TRI);
}

/** Ý kiến các dòng + số đề nghị chờ (mọi loại) của 1 trường trong đợt. */
export async function saiLechCuaTruong(
  tx: Tx,
  dotId: string,
  donViId: string,
): Promise<{ yKiens: (YKienTruong | null)[]; soDeNghiCho: number }> {
  const [ds, soDeNghiCho] = await Promise.all([
    tx.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: donViId },
      select: { y_kien_truong: true },
    }),
    tx.de_nghi_sua_danh_sach.count({
      where: {
        dot_trien_khai_id: dotId,
        don_vi_id: donViId,
        trang_thai: 'cho',
      },
    }),
  ]);
  return {
    yKiens: ds.map((d) => d.y_kien_truong as YKienTruong | null),
    soDeNghiCho,
  };
}

/**
 * Đặt trạng thái danh sách cho nhiều trường theo quy tắc (yKiens, soDeNghiCho) → trạng thái, + người/lúc
 * thao tác cuối. Đọc gộp (2 truy vấn) rồi ghi tối đa 1 lệnh cho mỗi trạng thái đích.
 */
export async function datTrangThaiTheoSaiLech(
  tx: Tx,
  dotId: string,
  donViIds: string[],
  userId: string,
  quyTac: (
    yKiens: readonly (YKienTruong | null)[],
    soDeNghiCho: number,
  ) => TrangThaiDanhSach,
): Promise<void> {
  const ids = [...new Set(donViIds)];
  if (ids.length === 0) return;
  const [dong, choTheoTruong] = await Promise.all([
    tx.danh_sach_tham_gia.findMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: { in: ids } },
      select: { don_vi_id: true, y_kien_truong: true },
    }),
    tx.de_nghi_sua_danh_sach.groupBy({
      by: ['don_vi_id'],
      where: {
        dot_trien_khai_id: dotId,
        don_vi_id: { in: ids },
        trang_thai: 'cho',
      },
      _count: { _all: true },
    }),
  ]);
  const soCho = new Map(choTheoTruong.map((g) => [g.don_vi_id, g._count._all]));
  const theoTrangThai = new Map<TrangThaiDanhSach, string[]>();
  for (const id of ids) {
    const yKiens = dong
      .filter((d) => d.don_vi_id === id)
      .map((d) => d.y_kien_truong as YKienTruong | null);
    const moi = quyTac(yKiens, soCho.get(id) ?? 0);
    theoTrangThai.set(moi, [...(theoTrangThai.get(moi) ?? []), id]);
  }
  for (const [trangThai, nhom] of theoTrangThai) {
    await tx.hop_dong_boi_duong.updateMany({
      where: { dot_trien_khai_id: dotId, don_vi_id: { in: nhom } },
      data: { trang_thai_danh_sach: trangThai, ...thaoTacCuoi(userId) },
    });
  }
}

export interface DeNghiTuDongTuChoi {
  dot_trien_khai_id: string;
  don_vi_id: string;
  de_nghi_id: string;
  loai: string;
  dong_id: string | null;
  ly_do: string;
}

/**
 * Issue #62: Quản trị xóa / nạp lại dòng → tự Từ chối các đề nghị sửa/bớt đang chờ trên các dòng đó (TRƯỚC
 * khi xóa, để còn dong_id cho nhật ký). Đề nghị thêm người không gắn dòng nên không bị đụng.
 * Trả chi tiết nhật ký 'tu_choi_de_nghi_sua_danh_sach' cho từng đề nghị.
 */
export async function tuChoiDeNghiCuaDong(
  tx: Tx,
  dong: Prisma.danh_sach_tham_giaWhereInput,
  lyDo: string,
  adminId: string,
): Promise<DeNghiTuDongTuChoi[]> {
  const ds = await tx.de_nghi_sua_danh_sach.findMany({
    where: { trang_thai: 'cho', loai: { in: ['sua', 'bot'] }, dong },
    select: {
      id: true,
      dot_trien_khai_id: true,
      don_vi_id: true,
      loai: true,
      dong_id: true,
    },
  });
  if (ds.length === 0) return [];
  const luc = new Date();
  await tx.de_nghi_sua_danh_sach.updateMany({
    where: { id: { in: ds.map((d) => d.id) }, trang_thai: 'cho' },
    data: {
      trang_thai: 'tu_choi',
      ly_do_tu_choi: lyDo,
      xu_ly_boi: adminId,
      xu_ly_luc: luc,
      updated_at: luc,
    },
  });
  return ds.map((d) => ({
    dot_trien_khai_id: d.dot_trien_khai_id,
    don_vi_id: d.don_vi_id,
    de_nghi_id: d.id,
    loai: d.loai,
    dong_id: d.dong_id,
    ly_do: lyDo,
  }));
}
