// Thống kê + danh sách học viên ĐÃ ĐIỂM DANH BUỔI 1 ở lớp cũ (do chuyển lớp)
// nhưng hiện thuộc lớp có buổi 1 CHƯA DIỄN RA (cùng giai đoạn). CHỈ ĐỌC.
//   npx ts-node scripts/thong-ke-diem-danh-buoi-1-lop-moi.ts [ma_khoa] [file.xlsx]
// File có PII (ngày sinh, SĐT, email) — không gửi qua kênh công khai.
import 'dotenv/config';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { nhanDoiTuong } from '../src/ho-tro-hoc-vien/xuat-danh-sach-cum.util';

interface Dong {
  ma_khoa: string;
  giai_doan: string;
  lop_moi: string;
  muc_lop_moi: string | null;
  buoi_1_lop_moi: Date;
  lop_cu: string;
  muc_lop_cu: string | null;
  buoi_1_lop_cu: Date;
  trang_thai: 'co_mat' | 'vang' | 'vang_co_phep';
  nguon: string;
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

const NHAN_TRANG_THAI = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  vang_co_phep: 'Vắng có phép',
};
const NHAN_MUC = {
  co_ban: 'Cơ bản',
  thanh_thao: 'Thành thạo',
  nang_cao: 'Nâng cao',
};

const prisma = new PrismaClient();

// Lớp hiện tại (phan_lop_giai_doan) có buổi 1 bắt đầu sau now(); điểm danh buổi 1
// cùng giai đoạn nhưng ở lớp khác lớp hiện tại.
function docDuLieu(maKhoa: string | null) {
  return prisma.$queryRaw<Dong[]>`
    SELECT k.ma_khoa, gd.ten_giai_doan AS giai_doan,
           lm.ten_lop AS lop_moi, lm.muc_nang_luc::text AS muc_lop_moi,
           bm.thoi_gian_bat_dau AS buoi_1_lop_moi,
           lc.ten_lop AS lop_cu, lc.muc_nang_luc::text AS muc_lop_cu,
           bc.thoi_gian_bat_dau AS buoi_1_lop_cu,
           dd.trang_thai::text AS trang_thai, dd.nguon::text AS nguon,
           hv.ho_ten, hv.ma_dinh_danh_moet AS ma_moet,
           hv.ngay_sinh, hv.thang_sinh, hv.nam_sinh,
           dv.ten_don_vi AS don_vi, hv.doi_tuong::text AS doi_tuong,
           hv.so_dien_thoai_lien_he AS sdt, hv.email_lien_he AS email
    FROM phan_lop_giai_doan pl
    JOIN lich_hoc_lop bm ON bm.lop_id = pl.lop_id AND bm.giai_doan_id = pl.giai_doan_id
                        AND bm.buoi_so = 1 AND bm.thoi_gian_bat_dau > now()
    JOIN diem_danh dd ON dd.dang_ky_hoc_id = pl.dang_ky_hoc_id
    JOIN lich_hoc_lop bc ON bc.id = dd.lich_hoc_id AND bc.giai_doan_id = pl.giai_doan_id
                        AND bc.buoi_so = 1 AND bc.lop_id <> pl.lop_id
    JOIN lop_hoc lm ON lm.id = pl.lop_id
    JOIN lop_hoc lc ON lc.id = bc.lop_id
    JOIN giai_doan_khoa gd ON gd.id = pl.giai_doan_id
    JOIN khoa_boi_duong k ON k.id = gd.khoa_id
    JOIN dang_ky_hoc dk ON dk.id = pl.dang_ky_hoc_id
    JOIN hoc_vien hv ON hv.id = dk.hoc_vien_id
    JOIN don_vi_cong_tac dv ON dv.id = hv.don_vi_cong_tac_id
    WHERE (${maKhoa}::text IS NULL OR k.ma_khoa = ${maKhoa})
    ORDER BY k.ma_khoa, gd.thu_tu, lm.ten_lop, lc.ten_lop, hv.ho_ten`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const gio = (d: Date) =>
  d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const muc = (m: string | null) => (m ? (NHAN_MUC[m] ?? m) : '');

function themSheetThongKe(wb: ExcelJS.Workbook, ds: Dong[]) {
  const ws = wb.addWorksheet('Thống kê');
  ws.addRow([
    `Học viên đã điểm danh buổi 1 ở lớp cũ, hiện thuộc lớp chưa học buổi 1 — lập ${gio(new Date())}`,
  ]).font = {
    bold: true,
  };
  ws.addRow([
    'Khóa',
    'Giai đoạn',
    'Lớp hiện tại (sắp diễn ra)',
    'Buổi 1 lớp hiện tại',
    'Lớp cũ',
    'Số HV',
    'Có mặt',
    'Vắng',
    'Vắng có phép',
  ]).font = {
    bold: true,
  };
  const nhom = new Map<string, { d: Dong; dem: Record<string, number> }>();
  for (const d of ds) {
    const khoa = [d.ma_khoa, d.giai_doan, d.lop_moi, d.lop_cu].join('|');
    const g = nhom.get(khoa) ?? {
      d,
      dem: { co_mat: 0, vang: 0, vang_co_phep: 0 },
    };
    g.dem[d.trang_thai]++;
    nhom.set(khoa, g);
  }
  for (const { d, dem } of nhom.values()) {
    const tong = dem.co_mat + dem.vang + dem.vang_co_phep;
    ws.addRow([
      d.ma_khoa,
      d.giai_doan,
      d.lop_moi,
      gio(d.buoi_1_lop_moi),
      d.lop_cu,
      tong,
      dem.co_mat,
      dem.vang,
      dem.vang_co_phep,
    ]);
  }
  const tong = (t: string) => ds.filter((d) => d.trang_thai === t).length;
  ws.addRow([
    'Tổng',
    '',
    '',
    '',
    '',
    ds.length,
    tong('co_mat'),
    tong('vang'),
    tong('vang_co_phep'),
  ]).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 14));
  [3, 5].forEach((i) => (ws.getColumn(i).width = 40));
  ws.getColumn(4).width = 22;
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
    'Lớp cũ',
    'Mức lớp cũ',
    'Buổi 1 lớp cũ',
    'Điểm danh buổi 1',
    'Nguồn điểm danh',
    'Lớp hiện tại',
    'Mức lớp hiện tại',
    'Buổi 1 lớp hiện tại',
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
      d.lop_cu,
      muc(d.muc_lop_cu),
      gio(d.buoi_1_lop_cu),
      NHAN_TRANG_THAI[d.trang_thai],
      d.nguon,
      d.lop_moi,
      muc(d.muc_lop_moi),
      gio(d.buoi_1_lop_moi),
    ]),
  );
  ws.columns.forEach((c) => (c.width = 16));
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).numFmt = '@';
  [5, 11, 16].forEach((i) => (ws.getColumn(i).width = 36));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

(async () => {
  const maKhoa =
    process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : null;
  const file =
    process.argv[3] ??
    `diem-danh-buoi-1-lop-moi-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const ds = await docDuLieu(maKhoa);
  const wb = new ExcelJS.Workbook();
  themSheetThongKe(wb, ds);
  themSheetDanhSach(wb, ds);
  await wb.xlsx.writeFile(file);
  // Chỉ in số lượng ra console, không in PII.
  console.log(`Khóa: ${maKhoa ?? 'tất cả'} — ${ds.length} học viên`);
  const theoLop = new Map<string, number>();
  ds.forEach((d) =>
    theoLop.set(
      `${d.lop_moi} ← ${d.lop_cu}`,
      (theoLop.get(`${d.lop_moi} ← ${d.lop_cu}`) ?? 0) + 1,
    ),
  );
  console.table([...theoLop].map(([lop, so_hv]) => ({ lop, so_hv })));
  console.log(`Đã ghi ${file}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
