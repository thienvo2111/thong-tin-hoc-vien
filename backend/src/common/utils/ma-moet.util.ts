import { Prisma } from '@prisma/client';

// Khớp mã định danh MOET bỏ số 0 đầu + khớp SĐT (spec
// docs/superpowers/specs/2026-10-09-khop-ma-moet-dang-nhap-sdt-design.md
// Q-A/Q-B). Trường gửi lại danh sách thường mất số 0 đầu (Excel đổi ô thành
// số) — CHỈ đổi logic so khớp, KHÔNG đổi giá trị đã lưu. Mọi nơi tìm học viên
// theo mã MOET từ dữ liệu người dùng/import đi qua đây, không tự viết ltrim.

// Client tối thiểu cần dùng — PrismaService hoặc tx trong $transaction.
export type MaMoetDb = Pick<Prisma.TransactionClient, '$queryRaw'>;

// Bỏ khoảng trắng/dấu chấm/gạch (giữ số 0 đầu).
export function lamSachMaMoet(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[\s.\-]/g, '');
}

// Khóa so khớp: lamSachMaMoet + bỏ TOÀN BỘ số 0 đầu. Rỗng = không khớp gì.
export function chuanHoaMaMoet(raw: string | null | undefined): string {
  return lamSachMaMoet(raw).replace(/^0+/, '');
}

// Ô tìm kiếm: chỉ bỏ số 0 đầu của chuỗi đã trim (giữ ký tự phân cách để
// mã dạng "MOET-SSO-x" vẫn khớp chuỗi con). Toàn số 0 -> giữ nguyên.
export function boSo0DauDeTimKiem(q: string): string {
  const t = q.trim();
  return t.replace(/^0+/, '') || t;
}

// Chuẩn hóa SĐT: chỉ giữ chữ số; 84 + 9 số -> 0 + 9 số; 9 số không bắt đầu
// bằng 0 -> thêm 0. Cùng quy tắc với SQL_SDT_CHUAN_HOA bên dưới.
export function chuanHoaSoDienThoai(raw: string | null | undefined): string {
  const so = (raw ?? '').replace(/\D/g, '');
  if (so.length === 11 && so.startsWith('84')) return '0' + so.slice(2);
  if (so.length === 9 && !so.startsWith('0')) return '0' + so;
  return so;
}

// Tất cả học viên khớp mã: ưu tiên khớp chính xác (chỉ trim); không có thì
// khớp ltrim(ma_dinh_danh_moet,'0') = chuanHoaMaMoet(raw). Dùng trực tiếp cho
// kiểm tra trùng (bất kỳ kết quả nào = trùng).
export async function timCacHocVienIdTheoMaMoet(
  db: MaMoetDb,
  raw: string | null | undefined,
): Promise<string[]> {
  const sach = (raw ?? '').trim();
  if (!sach) return [];
  const khoa = chuanHoaMaMoet(raw);
  const rows = await db.$queryRaw<{ id: string; chinh_xac: boolean }[]>(
    Prisma.sql`SELECT id, (ma_dinh_danh_moet = ${sach}) AS chinh_xac
      FROM "hoc_vien"
      WHERE ma_dinh_danh_moet = ${sach}
         OR (${khoa} <> '' AND ltrim(ma_dinh_danh_moet, '0') = ${khoa})`,
  );
  const chinhXac = rows.filter((r) => r.chinh_xac);
  return (chinhXac.length > 0 ? chinhXac : rows).map((r) => r.id);
}

// Xác định đúng 1 học viên theo mã; 0 hoặc >= 2 -> null (không đoán).
export async function timHocVienIdTheoMaMoet(
  db: MaMoetDb,
  raw: string | null | undefined,
): Promise<string | null> {
  const ids = await timCacHocVienIdTheoMaMoet(db, raw);
  return ids.length === 1 ? ids[0] : null;
}

const SQL_SO_THUAN = Prisma.sql`regexp_replace(coalesce(so_dien_thoai_lien_he, ''), '\\D', '', 'g')`;
const SQL_SDT_CHUAN_HOA = Prisma.sql`CASE
  WHEN length(${SQL_SO_THUAN}) = 11 AND left(${SQL_SO_THUAN}, 2) = '84'
    THEN '0' || substr(${SQL_SO_THUAN}, 3)
  WHEN length(${SQL_SO_THUAN}) = 9 AND left(${SQL_SO_THUAN}, 1) <> '0'
    THEN '0' || ${SQL_SO_THUAN}
  ELSE ${SQL_SO_THUAN} END`;

// Học viên có SĐT liên hệ khớp sau chuẩn hóa — đúng 1 mới trả id; SĐT không
// tồn tại hoặc dùng chung (>= 2 học viên) -> null.
export async function timHocVienIdTheoSoDienThoai(
  db: MaMoetDb,
  raw: string | null | undefined,
): Promise<string | null> {
  const sdt = chuanHoaSoDienThoai(raw);
  if (!sdt) return null;
  const rows = await db.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "hoc_vien" WHERE ${SQL_SDT_CHUAN_HOA} = ${sdt} LIMIT 2`,
  );
  return rows.length === 1 ? rows[0].id : null;
}
