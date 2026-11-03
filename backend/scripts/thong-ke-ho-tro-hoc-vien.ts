// Thống kê số lượt hỗ trợ học viên của từng tài khoản hỗ trợ học viên
// (vai trò ho_tro_hoc_vien). CHỈ ĐỌC (1 câu SELECT tài khoản + 1 câu SELECT lượt).
//   npx ts-node scripts/thong-ke-ho-tro-hoc-vien.ts [tu_ngay|-] [den_ngay|-] [file.xlsx]
// Ngày dạng YYYY-MM-DD theo giờ Việt Nam, đủ cả 2 đầu; "-" = không giới hạn.
// Nguồn đếm (người làm = tài khoản hỗ trợ):
//   - Điểm danh bổ sung, xử lý đổi buổi/học bù, báo vắng, đề nghị đổi lớp:
//     nhat_ky_hoat_dong (không tính lượt hủy báo vắng / hủy đề nghị).
//   - Yêu cầu hỗ trợ đã trả lời: yeu_cau_ho_tro.tra_loi_boi.
//   - Sửa hồ sơ hộ: lich_su_thay_doi_ho_so, 1 lần lưu (cùng sua_luc) = 1 lượt.
//   - Cấp mật khẩu tạm: nhat_ky_dat_lai_mat_khau.
// Không đếm được: gửi link đặt lại mật khẩu, mở khóa tạm (không ghi người làm).
// Sheet "Chi tiết" có họ tên + mã MOET học viên — không gửi qua kênh công khai.
import 'dotenv/config';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const LOAI = {
  diem_danh_bo_sung: 'Điểm danh bổ sung',
  duyet_doi_buoi: 'Duyệt đổi buổi/học bù',
  tu_choi_doi_buoi: 'Từ chối đổi buổi/học bù',
  huy_duyet_doi_buoi: 'Hủy duyệt đổi buổi/học bù',
  tra_loi_yeu_cau: 'Trả lời yêu cầu hỗ trợ',
  sua_ho_so: 'Sửa hồ sơ',
  cap_mat_khau_tam: 'Cấp mật khẩu tạm',
  bao_vang: 'Báo vắng',
  de_nghi_doi_lop: 'Đề nghị đổi lớp',
} as const;
type Loai = keyof typeof LOAI;
const DS_LOAI = Object.keys(LOAI) as Loai[];

interface TaiKhoan {
  id: string;
  ho_ten: string;
  ten_dang_nhap: string;
  trang_thai: string;
  so_cum: number;
  so_lop: number;
}

interface Luot {
  tk_id: string;
  loai: Loai;
  thoi_gian: Date;
  hoc_vien_id: string | null;
  ho_ten_hv: string | null;
  ma_moet: string | null;
  don_vi: string | null;
  mo_ta: string | null;
}

// Nhận client để kiểm thử được trong transaction rồi rollback.
type Db = Pick<PrismaClient, '$queryRaw'>;

export function docTaiKhoan(db: Db) {
  return db.$queryRaw<TaiKhoan[]>`
    SELECT u.id, u.ho_ten, u.ten_dang_nhap, u.trang_thai::text AS trang_thai,
           (SELECT count(*)::int FROM phan_cong_ho_tro p WHERE p.nguoi_dung_id = u.id) AS so_cum,
           (SELECT count(*)::int FROM phan_cong_ho_tro_lop p WHERE p.nguoi_dung_id = u.id) AS so_lop
    FROM nguoi_dung u
    WHERE u.vai_tro = 'ho_tro_hoc_vien'
    ORDER BY u.ho_ten, u.ten_dang_nhap`;
}

// Mốc ngày tính theo giờ Việt Nam: [tu 00:00, den+1 00:00).
export function docLuot(db: Db, tu: string | null, den: string | null) {
  return db.$queryRaw<Luot[]>`
    WITH luot AS (
      SELECT nk.nguoi_dung_id AS tk_id,
             CASE
               WHEN nk.hanh_dong <> 'duyet_doi_buoi' THEN
                 CASE nk.hanh_dong WHEN 'ho_tro_diem_danh_bo_sung' THEN 'diem_danh_bo_sung'
                                   ELSE nk.hanh_dong END
               WHEN nk.chi_tiet->>'tu_choi' = 'true' THEN 'tu_choi_doi_buoi'
               WHEN nk.chi_tiet->>'huy_duyet' = 'true' THEN 'huy_duyet_doi_buoi'
               ELSE 'duyet_doi_buoi'
             END AS loai,
             nk.thoi_gian, nk.hoc_vien_id, nk.chi_tiet->>'mo_ta' AS mo_ta
      FROM nhat_ky_hoat_dong nk
      WHERE nk.hanh_dong IN ('ho_tro_diem_danh_bo_sung', 'duyet_doi_buoi',
                             'bao_vang', 'de_nghi_doi_lop')
        AND coalesce(nk.chi_tiet->>'huy', '') <> 'true'
      UNION ALL
      SELECT y.tra_loi_boi, 'tra_loi_yeu_cau', y.thoi_gian_phan_hoi, y.hoc_vien_id,
             coalesce(y.tinh_huong, lv.ten)
      FROM yeu_cau_ho_tro y
      LEFT JOIN loai_van_de_ho_tro lv ON lv.id = y.loai_van_de_id
      WHERE y.tra_loi_boi IS NOT NULL AND y.thoi_gian_phan_hoi IS NOT NULL
      UNION ALL
      SELECT ls.nguoi_sua_id, 'sua_ho_so', ls.sua_luc, ls.hoc_vien_id,
             string_agg(ls.truong, ', ' ORDER BY ls.truong)
      FROM lich_su_thay_doi_ho_so ls
      WHERE ls.vai_tro_nguoi_sua = 'ho_tro_hoc_vien'
      GROUP BY ls.nguoi_sua_id, ls.hoc_vien_id, ls.sua_luc
      UNION ALL
      SELECT n.thuc_hien_boi, 'cap_mat_khau_tam', n.created_at, u.hoc_vien_id, NULL
      FROM nhat_ky_dat_lai_mat_khau n
      JOIN nguoi_dung u ON u.id = n.nguoi_dung_id
    )
    SELECT l.tk_id, l.loai, l.thoi_gian, l.hoc_vien_id,
           hv.ho_ten AS ho_ten_hv, hv.ma_dinh_danh_moet AS ma_moet,
           dv.ten_don_vi AS don_vi, l.mo_ta
    FROM luot l
    JOIN nguoi_dung tk ON tk.id = l.tk_id AND tk.vai_tro = 'ho_tro_hoc_vien'
    LEFT JOIN hoc_vien hv ON hv.id = l.hoc_vien_id
    LEFT JOIN don_vi_cong_tac dv ON dv.id = hv.don_vi_cong_tac_id
    WHERE (${tu}::date IS NULL
           OR l.thoi_gian >= ${tu}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND (${den}::date IS NULL
           OR l.thoi_gian < (${den}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    ORDER BY l.thoi_gian`;
}

interface TongHop {
  luot: Record<Loai, number>;
  hv: Record<Loai, Set<string>>;
  hvTong: Set<string>;
}

function tongHopRong(): TongHop {
  return {
    luot: Object.fromEntries(DS_LOAI.map((l) => [l, 0])) as Record<
      Loai,
      number
    >,
    hv: Object.fromEntries(
      DS_LOAI.map((l) => [l, new Set<string>()]),
    ) as Record<Loai, Set<string>>,
    hvTong: new Set<string>(),
  };
}

function cong(t: TongHop, l: Luot) {
  t.luot[l.loai]++;
  if (!l.hoc_vien_id) return;
  t.hv[l.loai].add(l.hoc_vien_id);
  t.hvTong.add(l.hoc_vien_id);
}

const gio = (d: Date) =>
  d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
const NHAN_TRANG_THAI_TK: Record<string, string> = {
  active: 'Hoạt động',
  ngung: 'Ngừng',
};

function dongSo(t: TongHop) {
  const tongLuot = DS_LOAI.reduce((s, l) => s + t.luot[l], 0);
  return [
    ...DS_LOAI.flatMap((l) => [t.luot[l], t.hv[l].size]),
    tongLuot,
    t.hvTong.size,
  ];
}

function themSheetTongHop(
  wb: ExcelJS.Workbook,
  dsTk: TaiKhoan[],
  theoTk: Map<string, TongHop>,
  tong: TongHop,
  khoang: string,
) {
  const ws = wb.addWorksheet('Tổng hợp');
  ws.addRow([
    `Số lượt hỗ trợ học viên theo tài khoản hỗ trợ — ${khoang} — lập ${gio(new Date())}`,
  ]).font = { bold: true };
  const coDinh = [
    'STT',
    'Họ tên',
    'Tên đăng nhập',
    'Trạng thái',
    'Số cụm',
    'Số lớp',
  ];
  ws.addRow([
    ...coDinh.map(() => ''),
    ...DS_LOAI.flatMap((l) => [LOAI[l], '']),
    'Tổng',
    '',
  ]).font = { bold: true };
  ws.addRow([
    ...coDinh,
    ...DS_LOAI.flatMap(() => ['Lượt', 'Số HV']),
    'Lượt',
    'Số HV',
  ]).font = { bold: true };
  for (let i = 0; i <= DS_LOAI.length; i++) {
    const c = coDinh.length + 1 + i * 2;
    ws.mergeCells(2, c, 2, c + 1);
  }
  dsTk.forEach((tk, i) =>
    ws.addRow([
      i + 1,
      tk.ho_ten,
      tk.ten_dang_nhap,
      NHAN_TRANG_THAI_TK[tk.trang_thai] ?? tk.trang_thai,
      tk.so_cum,
      tk.so_lop,
      ...dongSo(theoTk.get(tk.id) ?? tongHopRong()),
    ]),
  );
  // Dòng tổng: "Số HV" = số học viên khác nhau trên mọi tài khoản (không cộng dồn).
  ws.addRow(['', 'Tổng', '', '', '', '', ...dongSo(tong)]).font = {
    bold: true,
  };
  ws.columns.forEach((c) => (c.width = 9));
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 12;
  ws.getRow(2).alignment = {
    wrapText: true,
    horizontal: 'center',
    vertical: 'middle',
  };
  ws.getRow(2).height = 32;
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 3 }];
}

function themSheetChiTiet(
  wb: ExcelJS.Workbook,
  ds: Luot[],
  tenTk: Map<string, TaiKhoan>,
) {
  const ws = wb.addWorksheet('Chi tiết');
  ws.addRow([
    'STT',
    'Thời gian',
    'Tài khoản hỗ trợ',
    'Tên đăng nhập',
    'Loại hỗ trợ',
    'Học viên',
    'Mã MOET',
    'Đơn vị công tác',
    'Nội dung',
  ]).font = { bold: true };
  ds.forEach((l, i) => {
    const tk = tenTk.get(l.tk_id);
    ws.addRow([
      i + 1,
      gio(l.thoi_gian),
      tk?.ho_ten ?? '',
      tk?.ten_dang_nhap ?? '',
      LOAI[l.loai],
      l.ho_ten_hv ?? '',
      l.ma_moet ?? '',
      l.don_vi ?? '',
      l.mo_ta ?? '',
    ]);
  });
  ws.columns.forEach((c) => (c.width = 18));
  ws.getColumn(1).width = 6;
  ws.getColumn(3).width = 28;
  ws.getColumn(5).width = 26;
  ws.getColumn(6).width = 28;
  ws.getColumn(7).numFmt = '@';
  ws.getColumn(8).width = 36;
  ws.getColumn(9).width = 60;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function docNgay(s: string | undefined): string | null {
  if (!s || s === '-') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Ngày "${s}" không đúng dạng YYYY-MM-DD`);
  }
  return s;
}

export function tongHop(ds: Luot[]) {
  const theoTk = new Map<string, TongHop>();
  const tong = tongHopRong();
  for (const l of ds) {
    const t = theoTk.get(l.tk_id) ?? tongHopRong();
    cong(t, l);
    cong(tong, l);
    theoTk.set(l.tk_id, t);
  }
  return { theoTk, tong };
}

async function main(prisma: PrismaClient) {
  const tu = docNgay(process.argv[2]);
  const den = docNgay(process.argv[3]);
  const file =
    process.argv[4] ??
    `thong-ke-ho-tro-hoc-vien-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const khoang =
    tu || den ? `từ ${tu ?? 'đầu'} đến ${den ?? 'nay'}` : 'toàn bộ thời gian';

  const [dsTk, ds] = await Promise.all([
    docTaiKhoan(prisma),
    docLuot(prisma, tu, den),
  ]);
  const { theoTk, tong } = tongHop(ds);

  const wb = new ExcelJS.Workbook();
  themSheetTongHop(wb, dsTk, theoTk, tong, khoang);
  themSheetChiTiet(wb, ds, new Map(dsTk.map((tk) => [tk.id, tk])));
  await wb.xlsx.writeFile(file);

  // Console chỉ in số lượng theo tài khoản, không in thông tin học viên.
  console.log(
    `Khoảng: ${khoang} — ${dsTk.length} tài khoản, ${ds.length} lượt`,
  );
  console.table(
    dsTk.map((tk) => {
      const t = theoTk.get(tk.id) ?? tongHopRong();
      return {
        tai_khoan: tk.ten_dang_nhap,
        diem_danh_bs: t.luot.diem_danh_bo_sung,
        doi_buoi:
          t.luot.duyet_doi_buoi +
          t.luot.tu_choi_doi_buoi +
          t.luot.huy_duyet_doi_buoi,
        tra_loi_yc: t.luot.tra_loi_yeu_cau,
        ho_so:
          t.luot.sua_ho_so +
          t.luot.cap_mat_khau_tam +
          t.luot.bao_vang +
          t.luot.de_nghi_doi_lop,
        so_hv: t.hvTong.size,
      };
    }),
  );
  console.log(`Đã ghi ${file}`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  main(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
