import * as ExcelJS from 'exceljs';

// ADR 0003 H6: file xuất danh sách cụm cho người hỗ trợ — tối thiểu hóa dữ
// liệu vì file nằm trên máy cá nhân/có thể bị chuyển qua Zalo: KHÔNG có số
// định danh/CCCD, ngày sinh (= mật khẩu mặc định), mã MOET, nơi sinh.

export interface DongXuat {
  ho_ten: string;
  don_vi_cong_tac_ten: string;
  doi_tuong: string | null;
  so_dien_thoai_lien_he: string | null;
  email_lien_he: string | null;
  day_du: boolean;
  dang_nhap_lan_cuoi: Date | null;
  lop_theo_giai_doan: Record<string, string>;
  khao_sat: { loai: string; trang_thai: string; muc: string | null }[];
}

export interface SheetCum {
  ten_cum: string;
  giai_doan: { id: string; thu_tu: number; ten_giai_doan: string }[];
  hoc_vien: DongXuat[];
}

const NHAN_DOI_TUONG: Record<string, string> = {
  giao_vien: 'Giáo viên',
  can_bo_quan_ly: 'Cán bộ quản lý',
  nhan_vien: 'Nhân viên',
};

const NHAN_KHAO_SAT: Record<string, string> = {
  da_mo: 'đã mở',
  dang_lam: 'đang làm',
  hoan_thanh: 'hoàn thành',
};

// Tên sheet Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ] và không trùng.
function tenSheet(ten: string, daDung: Set<string>): string {
  const goc =
    ten
      .replace(/[:\\/?*[\]]/g, ' ')
      .trim()
      .slice(0, 31) || 'Cụm';
  let kq = goc;
  for (let i = 2; daDung.has(kq.toLowerCase()); i++) {
    const hau = ` (${i})`;
    kq = goc.slice(0, 31 - hau.length) + hau;
  }
  daDung.add(kq.toLowerCase());
  return kq;
}

export async function buildDanhSachCumWorkbook(
  sheets: SheetCum[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const daDung = new Set<string>();
  if (sheets.length === 0) wb.addWorksheet('Danh sách');
  for (const s of sheets) {
    const ws = wb.addWorksheet(tenSheet(s.ten_cum, daDung));
    ws.addRow([
      'STT',
      'Họ tên',
      'Đơn vị công tác',
      'Đối tượng',
      'Số điện thoại',
      'Email',
      ...s.giai_doan.map((g) => `GĐ${g.thu_tu} - ${g.ten_giai_doan}`),
      'Hồ sơ đầy đủ',
      'Đã đăng nhập',
      'Khảo sát',
    ]).font = { bold: true };
    s.hoc_vien.forEach((h, i) => {
      ws.addRow([
        i + 1,
        h.ho_ten,
        h.don_vi_cong_tac_ten,
        h.doi_tuong ? (NHAN_DOI_TUONG[h.doi_tuong] ?? h.doi_tuong) : '',
        h.so_dien_thoai_lien_he ?? '',
        h.email_lien_he ?? '',
        ...s.giai_doan.map((g) => h.lop_theo_giai_doan[g.id] ?? ''),
        h.day_du ? 'Đủ' : 'Chưa đủ',
        h.dang_nhap_lan_cuoi ? 'Rồi' : 'Chưa',
        h.khao_sat
          .map(
            (k) => `${k.loai}: ${NHAN_KHAO_SAT[k.trang_thai] ?? k.trang_thai}`,
          )
          .join('; '),
      ]);
    });
    ws.columns.forEach((c) => (c.width = 18));
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 36;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
