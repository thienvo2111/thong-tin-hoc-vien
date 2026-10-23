// Học viên bị CHUYỂN LỚP (nhật ký "Phân lớp") sang lớp mà lúc chuyển đã diễn ra
// ≥1 buổi của giai đoạn, trong khi lớp cũ lúc đó CHƯA học buổi 1. CHỈ ĐỌC.
//   npx ts-node scripts/chuyen-lop-vao-lop-da-hoc.ts [tu_ngay] [den_ngay] [file.xlsx]
// Ngày dạng YYYY-MM-DD giờ VN, mặc định 2026-10-22 (đến hết ngày tu_ngay).
// File có PII (ngày sinh, SĐT, email) — không gửi qua kênh công khai.
import 'dotenv/config';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { nhanDoiTuong } from '../src/ho-tro-hoc-vien/xuat-danh-sach-cum.util';

interface LuotChuyen {
  stt: number;
  thoi_gian: Date;
  hoc_vien_id: string;
  ten_khoa: string;
  gd: number;
  lop_cu: string;
  lop_moi: string;
}

interface Dong {
  thoi_gian: Date;
  ma_khoa: string;
  giai_doan: string;
  lop_cu: string;
  muc_lop_cu: string | null;
  buoi_1_lop_cu: Date | null;
  lop_moi: string;
  muc_lop_moi: string | null;
  buoi_1_lop_moi: Date;
  buoi_2_lop_moi: Date | null;
  so_buoi_da_qua: number;
  diem_danh_buoi_da_qua: string;
  co_mat_noi_khac: string | null;
  lop_hien_tai: string | null;
  ho_ten: string;
  ma_moet: string | null;
  ngay_sinh: number;
  thang_sinh: number;
  nam_sinh: number;
  don_vi: string;
  doi_tuong: string | null;
  sdt: string | null;
  email: string | null;
}

const NHAN_MUC = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};
// Khớp ghiPhanLop: `${khoa} — GĐ${n} "${gd}": ${cu} → ${moi}[ (nhập file)][ — phụ lục]`
const MO_TA = /^(.+) — GĐ(\d+) ".*": (.+?) → (.+?)( \(nhập file\))?( — .*)?$/;
const KHONG_PHAI_LOP = ['(chưa có lớp)', '(gỡ lớp)'];

const prisma = new PrismaClient();

async function docLuotChuyen(tu: Date, den: Date): Promise<LuotChuyen[]> {
  const nk = await prisma.nhat_ky_hoat_dong.findMany({
    where: { hanh_dong: 'phan_lop', thoi_gian: { gte: tu, lt: den } },
    select: { thoi_gian: true, hoc_vien_id: true, chi_tiet: true },
    orderBy: { thoi_gian: 'asc' },
  });
  const ds: LuotChuyen[] = [];
  for (const n of nk) {
    const m = MO_TA.exec((n.chi_tiet as { mo_ta?: string })?.mo_ta ?? '');
    if (!m || !n.hoc_vien_id) continue;
    const [, ten_khoa, gd, lop_cu, lop_moi] = m;
    if (KHONG_PHAI_LOP.includes(lop_cu) || KHONG_PHAI_LOP.includes(lop_moi))
      continue;
    ds.push({
      stt: ds.length,
      thoi_gian: n.thoi_gian,
      hoc_vien_id: n.hoc_vien_id,
      ten_khoa,
      gd: Number(gd),
      lop_cu,
      lop_moi,
    });
  }
  return ds;
}

// Lớp mới: buổi cùng giai đoạn bắt đầu TRƯỚC lúc chuyển. Lớp cũ: buổi 1 bắt
// đầu SAU lúc chuyển (hoặc chưa có lịch). Tên lớp tra trong cùng khóa.
function docDuLieu(luot: LuotChuyen[]) {
  return prisma.$queryRaw<Dong[]>`
    WITH x AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(luot)}::jsonb)
        AS x(stt int, thoi_gian timestamptz, hoc_vien_id uuid, ten_khoa text,
             gd int, lop_cu text, lop_moi text)
    )
    SELECT x.thoi_gian, k.ma_khoa, gd.ten_giai_doan AS giai_doan,
           la.ten_lop AS lop_cu, la.muc_nang_luc::text AS muc_lop_cu,
           a1.thoi_gian_bat_dau AS buoi_1_lop_cu,
           lb.ten_lop AS lop_moi, lb.muc_nang_luc::text AS muc_lop_moi,
           qua.buoi_1 AS buoi_1_lop_moi, qua.buoi_2 AS buoi_2_lop_moi,
           qua.so_buoi AS so_buoi_da_qua, qua.diem_danh AS diem_danh_buoi_da_qua,
           noi_khac.ds AS co_mat_noi_khac, lh.ten_lop AS lop_hien_tai,
           hv.ho_ten, hv.ma_dinh_danh_moet AS ma_moet,
           hv.ngay_sinh, hv.thang_sinh, hv.nam_sinh,
           dv.ten_don_vi AS don_vi, hv.doi_tuong::text AS doi_tuong,
           hv.so_dien_thoai_lien_he AS sdt, hv.email_lien_he AS email
    FROM x
    JOIN khoa_boi_duong k ON k.ten_khoa = x.ten_khoa
    JOIN dang_ky_hoc dk ON dk.khoa_id = k.id AND dk.hoc_vien_id = x.hoc_vien_id
    JOIN giai_doan_khoa gd ON gd.khoa_id = k.id AND gd.thu_tu = x.gd
    JOIN lop_hoc la ON la.khoa_id = k.id AND la.ten_lop = x.lop_cu
    JOIN lop_hoc lb ON lb.khoa_id = k.id AND lb.ten_lop = x.lop_moi
    JOIN hoc_vien hv ON hv.id = x.hoc_vien_id
    JOIN don_vi_cong_tac dv ON dv.id = hv.don_vi_cong_tac_id
    LEFT JOIN lich_hoc_lop a1 ON a1.lop_id = la.id AND a1.giai_doan_id = gd.id
                             AND a1.buoi_so = 1
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS so_buoi,
             min(b.thoi_gian_bat_dau) FILTER (WHERE b.buoi_so = 1) AS buoi_1,
             min(b.thoi_gian_bat_dau) FILTER (WHERE b.buoi_so = 2) AS buoi_2,
             string_agg('B' || b.buoi_so || ': ' || coalesce(dd.trang_thai::text, 'chưa có'),
                        ', ' ORDER BY b.buoi_so) AS diem_danh
      FROM lich_hoc_lop b
      LEFT JOIN diem_danh dd ON dd.lich_hoc_id = b.id AND dd.dang_ky_hoc_id = dk.id
      WHERE b.lop_id = lb.id AND b.giai_doan_id = gd.id
        AND b.thoi_gian_bat_dau < x.thoi_gian
    ) qua
    LEFT JOIN LATERAL (
      SELECT string_agg(DISTINCT 'B' || b.buoi_so || ' ở ' || l.ten_lop, ', ') AS ds
      FROM diem_danh dd
      JOIN lich_hoc_lop b ON b.id = dd.lich_hoc_id AND b.giai_doan_id = gd.id
                         AND b.lop_id <> lb.id
      JOIN lop_hoc l ON l.id = b.lop_id
      WHERE dd.dang_ky_hoc_id = dk.id AND dd.trang_thai = 'co_mat'
    ) noi_khac ON true
    LEFT JOIN phan_lop_giai_doan pl ON pl.dang_ky_hoc_id = dk.id
                                   AND pl.giai_doan_id = gd.id
    LEFT JOIN lop_hoc lh ON lh.id = pl.lop_id
    WHERE qua.so_buoi > 0
      AND (a1.id IS NULL OR a1.thoi_gian_bat_dau > x.thoi_gian)
    ORDER BY k.ma_khoa, gd.thu_tu, la.ten_lop, lb.ten_lop, hv.ho_ten, x.stt`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const gio = (d: Date | null) =>
  d
    ? d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
    : '';
const muc = (m: string | null) => (m ? (NHAN_MUC[m] ?? m) : '');

function themSheetThongKe(wb: ExcelJS.Workbook, ds: Dong[], khoang: string) {
  const ws = wb.addWorksheet('Thống kê');
  ws.addRow([
    `Chuyển lớp ${khoang} sang lớp đã học buổi 1/2 khi lớp cũ chưa học — lập ${gio(new Date())}`,
  ]).font = { bold: true };
  ws.addRow([
    'Khóa',
    'Giai đoạn',
    'Lớp cũ (chưa học)',
    'Buổi 1 lớp cũ',
    'Lớp chuyển đến (đã học)',
    'Buổi 1 lớp chuyển đến',
    'Số HV',
  ]).font = { bold: true };
  const nhom = new Map<string, { d: Dong; so: number }>();
  for (const d of ds) {
    const khoa = [d.ma_khoa, d.giai_doan, d.lop_cu, d.lop_moi].join('|');
    const g = nhom.get(khoa) ?? { d, so: 0 };
    g.so++;
    nhom.set(khoa, g);
  }
  for (const { d, so } of nhom.values()) {
    ws.addRow([
      d.ma_khoa,
      d.giai_doan,
      d.lop_cu,
      gio(d.buoi_1_lop_cu),
      d.lop_moi,
      gio(d.buoi_1_lop_moi),
      so,
    ]);
  }
  ws.addRow(['Tổng', '', '', '', '', '', ds.length]).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 14));
  [3, 5].forEach((i) => (ws.getColumn(i).width = 40));
  [4, 6].forEach((i) => (ws.getColumn(i).width = 22));
}

function themSheetDanhSach(wb: ExcelJS.Workbook, ds: Dong[]) {
  const ws = wb.addWorksheet('Danh sách');
  ws.addRow([
    'STT',
    'Họ tên',
    'Mã MOET',
    'Ngày sinh',
    'Đơn vị công tác',
    'Đối tượng',
    'Số điện thoại',
    'Email',
    'Khóa',
    'Giai đoạn',
    'Lúc chuyển lớp',
    'Lớp cũ',
    'Mức lớp cũ',
    'Buổi 1 lớp cũ',
    'Lớp chuyển đến',
    'Mức lớp chuyển đến',
    'Buổi 1 lớp chuyển đến',
    'Buổi 2 lớp chuyển đến',
    'Số buổi đã qua lúc chuyển',
    'Điểm danh các buổi đã qua',
    'Có mặt ở lớp khác (cùng GĐ)',
    'Lớp hiện tại',
  ]).font = { bold: true };
  ds.forEach((d, i) =>
    ws.addRow([
      i + 1,
      d.ho_ten,
      d.ma_moet ?? '',
      `${pad2(d.ngay_sinh)}/${pad2(d.thang_sinh)}/${d.nam_sinh}`,
      d.don_vi,
      nhanDoiTuong(d.doi_tuong),
      d.sdt ?? '',
      d.email ?? '',
      d.ma_khoa,
      d.giai_doan,
      gio(d.thoi_gian),
      d.lop_cu,
      muc(d.muc_lop_cu),
      gio(d.buoi_1_lop_cu),
      d.lop_moi,
      muc(d.muc_lop_moi),
      gio(d.buoi_1_lop_moi),
      gio(d.buoi_2_lop_moi),
      d.so_buoi_da_qua,
      d.diem_danh_buoi_da_qua,
      d.co_mat_noi_khac ?? '',
      d.lop_hien_tai ?? '(không có lớp)',
    ]),
  );
  ws.columns.forEach((c) => (c.width = 16));
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).numFmt = '@';
  [5, 12, 15, 20, 21, 22].forEach((i) => (ws.getColumn(i).width = 36));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const ngayVN = (s: string) => new Date(`${s}T00:00:00+07:00`);

(async () => {
  const tuNgay = process.argv[2] ?? '2026-10-22';
  const denNgay = process.argv[3] ?? tuNgay;
  const tu = ngayVN(tuNgay);
  const den = new Date(ngayVN(denNgay).getTime() + 24 * 3600 * 1000);
  if (isNaN(tu.getTime()) || isNaN(den.getTime()))
    throw new Error('Ngày phải dạng YYYY-MM-DD');
  const file =
    process.argv[4] ?? `chuyen-lop-vao-lop-da-hoc-${tuNgay}_${denNgay}.xlsx`;
  const luot = await docLuotChuyen(tu, den);
  const ds = luot.length ? await docDuLieu(luot) : [];
  const khoang = tuNgay === denNgay ? tuNgay : `${tuNgay} → ${denNgay}`;
  const wb = new ExcelJS.Workbook();
  themSheetThongKe(wb, ds, khoang);
  themSheetDanhSach(wb, ds);
  await wb.xlsx.writeFile(file);
  // Chỉ in số lượng ra console, không in PII.
  console.log(
    `${khoang}: ${luot.length} lượt chuyển lớp → ${ds.length} lượt vào lớp đã học khi lớp cũ chưa học`,
  );
  const theoLop = new Map<string, number>();
  ds.forEach((d) => {
    const k = `${d.ma_khoa} ${d.giai_doan}: ${d.lop_cu} → ${d.lop_moi}`;
    theoLop.set(k, (theoLop.get(k) ?? 0) + 1);
  });
  console.table([...theoLop].map(([lop, so_hv]) => ({ lop, so_hv })));
  console.log(`Đã ghi ${file}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
