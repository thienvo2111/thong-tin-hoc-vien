import * as ExcelJS from 'exceljs';
import {
  cap_hoc,
  doi_tuong_hoc_vien,
  loai_lop_hoc,
  muc_nang_luc,
  trang_thai_ho_so,
  trang_thai_khao_sat,
} from '@prisma/client';
import {
  DOI_TUONG_LABEL,
  LOAI_LOP_LABEL,
  MUC_NANG_LUC_LABEL,
} from '../../thong-bao/mau-email/mau-email';
import { NHAN_CAP_GIANG_DAY } from '../../bao-cao/util/report-excel.util';
import { tieuDeCotGiaiDoan } from '../../import/util/phan-lop-excel.util';
import { MucThang, nhanMucGoc } from '../../sso/thang-muc.service';
import {
  NguonMucDanhGia,
  THU_TU_MUC,
  mucDanhGiaLamMoc,
  mucHocHieuLuc,
} from './muc-hoc.util';

// Export "Danh sách chia lớp" (2026-10-09) — Excel để Quản trị chia lớp
// ngoài hệ thống rồi nhập lại thẳng qua POST /import/phan_lop_hoc_vien.
// Sheet 1 PHẢI đọc được bởi readPhanLopWorkbook: cột tiêu đề bắt đầu "#" là
// cột tham khảo (bị bỏ qua khi nhập), còn lại đúng tên cột import gốc.

export interface GiaiDoanChiaLop {
  id: string;
  thu_tu: number;
  ten_giai_doan: string;
}

export interface LopChiaLop {
  ten_lop: string;
  loai_lop: loai_lop_hoc;
  muc_nang_luc: muc_nang_luc | null;
  si_so_toi_da: number | null;
}

export interface BaiDauVaoChiaLop {
  trang_thai: trang_thai_khao_sat;
  muc: muc_nang_luc | null;
  muc_goc: string | null;
  diem: number | null;
  diem_toi_da: number | null;
  hoan_thanh_luc: Date | null;
}

export interface DongChiaLop {
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  trang_thai_ho_so: trang_thai_ho_so;
  doi_tuong: doi_tuong_hoc_vien | null;
  cap_giang_day: cap_hoc | null;
  ten_truong: string;
  ten_don_vi_quan_ly: string | null;
  bai_dau_vao: BaiDauVaoChiaLop | null;
  muc_dau_vao: muc_nang_luc | null;
  muc_hoc_chon: muc_nang_luc | null;
  muc_hoc_chon_luc: Date | null;
  ten_cum: string | null;
  phan_lop: { giai_doan_id: string; ten_lop: string; loai_lop: loai_lop_hoc }[];
}

const NEN_HEADER_THAM_KHAO: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE7E6E6' },
};
const NEN_HEADER_NHAP_DUOC: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
};

function ngayVn(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function ngayGioVn(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// Số hiển thị kiểu VN: nguyên thì không có phần thập phân, có thập phân thì dùng dấu phẩy.
function soVn(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}

function nhanKetQuaDauVao(bai: BaiDauVaoChiaLop | null, thang: MucThang[]): string {
  if (!bai) return 'Chưa làm';
  if (bai.trang_thai === 'da_mo') return 'Đã mở';
  if (bai.trang_thai === 'dang_lam') return 'Đang làm';
  return nhanMucGoc(bai.muc_goc, thang) ?? '';
}

function nhanDiem(bai: BaiDauVaoChiaLop | null): string {
  if (!bai || bai.diem === null || bai.diem_toi_da === null) return '';
  return `${soVn(bai.diem)} / ${soVn(bai.diem_toi_da)}`;
}

const NHAN_NGUON_MUC: Record<NguonMucDanhGia, string> = {
  chot: 'Đã chốt',
  khao_sat: 'Từ bài khảo sát',
};

const NHAN_TRANG_THAI_HO_SO_CHUA_DUYET: Record<string, string> = {
  nhap: 'Nháp',
  cho_duyet: 'Chờ duyệt',
  tu_choi: 'Từ chối',
  loi: 'Lỗi',
};

// 2026-10-10: nhân viên không tham gia khảo sát/đánh giá/tập huấn đợt này
// (xem doi-tuong-khao-sat.util.ts#phaiXepLop) — loại hẳn khỏi "Phân lớp" và
// "Tổng hợp theo mức học", dồn về sheet riêng này (kể cả chưa duyệt).
const TEN_SHEET_NHAN_VIEN = 'Nhân viên (không xếp lớp)';

function lopHienTaiNhanVien(
  r: DongTinhToan,
  giaiDoan: GiaiDoanChiaLop[],
): string {
  return giaiDoan
    .map((gd) => {
      const p = r.phan_lop.find((x) => x.giai_doan_id === gd.id);
      return p ? `GĐ${gd.thu_tu}: ${p.ten_lop}` : null;
    })
    .filter((x): x is string => x !== null)
    .join('; ');
}

interface DongTinhToan extends DongChiaLop {
  mocMuc: muc_nang_luc | null;
  nguonMoc: NguonMucDanhGia | null;
  mucHieuLuc: muc_nang_luc | null;
}

function tinhToanDong(r: DongChiaLop): DongTinhToan {
  const { muc: mocMuc, nguon: nguonMoc } = mucDanhGiaLamMoc(
    r.muc_dau_vao,
    r.bai_dau_vao,
  );
  const mucHieuLuc = mucHocHieuLuc(r.muc_hoc_chon, mocMuc);
  return { ...r, mocMuc, nguonMoc, mucHieuLuc };
}

function hangDauSheet1(giaiDoan: GiaiDoanChiaLop[]): string[] {
  return [
    'ma_dinh_danh_moet',
    '# Họ tên',
    '# Trường',
    '# Đơn vị quản lý',
    '# Đối tượng',
    '# Cấp giảng dạy',
    '# Kết quả đánh giá',
    '# Điểm',
    '# Ngày hoàn thành',
    '# Mức đánh giá (mốc)',
    '# Nguồn mức',
    '# Mức học viên chọn',
    '# Thời điểm chọn',
    '# Mức học',
    ...giaiDoan.flatMap((gd) => [
      `# GĐ${gd.thu_tu} hiện tại`,
      tieuDeCotGiaiDoan(gd),
    ]),
    '# Cụm hiện tại',
    'ten_cum',
    'so_dinh_danh_ca_nhan',
  ];
}

function dongSheet1(
  r: DongTinhToan,
  giaiDoan: GiaiDoanChiaLop[],
  thang: MucThang[],
): (string | number)[] {
  return [
    r.ma_dinh_danh_moet ?? '',
    r.ho_ten,
    r.ten_truong,
    r.ten_don_vi_quan_ly ?? '',
    r.doi_tuong ? DOI_TUONG_LABEL[r.doi_tuong] : '',
    r.cap_giang_day ? (NHAN_CAP_GIANG_DAY[r.cap_giang_day] ?? r.cap_giang_day) : '',
    nhanKetQuaDauVao(r.bai_dau_vao, thang),
    nhanDiem(r.bai_dau_vao),
    r.bai_dau_vao?.hoan_thanh_luc ? ngayVn(r.bai_dau_vao.hoan_thanh_luc) : '',
    r.mocMuc ? MUC_NANG_LUC_LABEL[r.mocMuc] : '',
    r.nguonMoc ? NHAN_NGUON_MUC[r.nguonMoc] : '',
    r.muc_hoc_chon ? MUC_NANG_LUC_LABEL[r.muc_hoc_chon] : '',
    r.muc_hoc_chon_luc ? ngayGioVn(r.muc_hoc_chon_luc) : '',
    r.mucHieuLuc ? MUC_NANG_LUC_LABEL[r.mucHieuLuc] : '',
    // Cột GĐ importable để TRỐNG có chủ ý: trống = giữ nguyên khi nhập lại;
    // nhập lại 1 dòng chưa đổi gì không được kích hoạt lại email xếp lớp.
    ...giaiDoan.flatMap((gd) => {
      const hienTai = r.phan_lop.find((p) => p.giai_doan_id === gd.id);
      return [hienTai?.ten_lop ?? '', ''];
    }),
    r.ten_cum ?? '',
    '',
    '',
  ];
}

export async function buildDanhSachChiaLopWorkbook(
  maKhoa: string,
  giaiDoan: GiaiDoanChiaLop[],
  lopHoc: LopChiaLop[],
  dsRow: DongChiaLop[],
  thang: MucThang[],
): Promise<Buffer> {
  const daTinh = dsRow.map(tinhToanDong);
  const nhanVien = daTinh.filter((r) => r.doi_tuong === 'nhan_vien');
  const conLai = daTinh.filter((r) => r.doi_tuong !== 'nhan_vien');
  const daDuyet = conLai.filter((r) => r.trang_thai_ho_so === 'da_duyet');
  const chuaDuyet = conLai.filter((r) => r.trang_thai_ho_so !== 'da_duyet');

  const thuTu = (m: muc_nang_luc | null) => (m ? THU_TU_MUC[m] : 0);
  daDuyet.sort(
    (a, b) =>
      thuTu(b.mucHieuLuc) - thuTu(a.mucHieuLuc) ||
      a.ten_truong.localeCompare(b.ten_truong, 'vi') ||
      a.ho_ten.localeCompare(b.ho_ten, 'vi'),
  );

  const workbook = new ExcelJS.Workbook();

  // ---- Sheet 1: Phân lớp (header dòng 1 để readPhanLopWorkbook đọc được) ----
  const sheet1 = workbook.addWorksheet('Phân lớp');
  const header1 = hangDauSheet1(giaiDoan);
  sheet1.addRow(header1);
  const hangHeader1 = sheet1.getRow(1);
  hangHeader1.font = { bold: true };
  header1.forEach((h, i) => {
    const cell = hangHeader1.getCell(i + 1);
    cell.fill = h.startsWith('#') ? NEN_HEADER_THAM_KHAO : NEN_HEADER_NHAP_DUOC;
  });
  daDuyet.forEach((r) => sheet1.addRow(dongSheet1(r, giaiDoan, thang)));

  // Cột nhập được giữ dạng TEXT (không mất số 0 đầu, không tự đổi "-" thành công thức/ngày).
  const colMaDinhDanh = sheet1.getColumn(1);
  colMaDinhDanh.numFmt = '@';
  header1.forEach((h, i) => {
    if (!h.startsWith('#')) sheet1.getColumn(i + 1).numFmt = '@';
  });

  const doRong1 = header1.map((h) => {
    if (h === 'ma_dinh_danh_moet' || h === 'so_dinh_danh_ca_nhan') return 16;
    if (h === '# Trường' || h === '# Đơn vị quản lý') return 32;
    if (h === '# Họ tên') return 26;
    if (h.startsWith('GĐ')) return 22;
    return 18;
  });
  doRong1.forEach((w, i) => (sheet1.getColumn(i + 1).width = w));
  sheet1.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  sheet1.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header1.length } };

  // ---- Sheet 2: Hướng dẫn ----
  const sheet2 = workbook.addWorksheet('Hướng dẫn');
  const canhBaoNhanVien = (() => {
    if (nhanVien.length === 0) return null;
    const coLop = nhanVien.filter((r) => r.phan_lop.length > 0).length;
    const hau =
      coLop > 0
        ? `, trong đó ${coLop} người đang có lớp — cần gỡ nếu không học`
        : '';
    return `Đã loại ${nhanVien.length} nhân viên khỏi danh sách chia lớp (xem sheet "${TEN_SHEET_NHAN_VIEN}")${hau}.`;
  })();
  const dongHuongDan = [
    'Cách điền:',
    ...(canhBaoNhanVien ? [canhBaoNhanVien] : []),
    '- Ô "GĐ<n> - <tên>": điền ĐÚNG tên lớp hiện có của giai đoạn đó (xem bảng dưới) để gán/đổi lớp.',
    '- Điền "-" để gỡ khỏi lớp của giai đoạn đó; để trống = giữ nguyên lớp hiện tại.',
    '- Cột "ten_cum": điền đúng tên cụm học viên để gán/đổi; để trống = giữ nguyên cụm hiện tại.',
    '- Các cột có tiêu đề bắt đầu bằng "#" chỉ để tham khảo, hệ thống bỏ qua hoàn toàn khi nhập.',
    '- Không đổi tên hoặc xóa tiêu đề các cột còn lại (ma_dinh_danh_moet, so_dinh_danh_ca_nhan, ten_cum, "GĐ<n> - <tên>").',
    '- Lưu file rồi nhập lại qua Nhập dữ liệu → Phân lớp học viên, chọn đúng khóa này.',
    '- Lưu ý: nhập lại 1 dòng đã có lớp TRỰC TIẾP sẽ gửi lại email thông báo lớp cho học viên đó, dù không đổi gì.',
  ];
  dongHuongDan.forEach((line) => sheet2.addRow([line]));
  sheet2.getRow(1).font = { bold: true };
  if (canhBaoNhanVien) {
    const hangCanhBao = sheet2.getRow(2);
    hangCanhBao.font = { bold: true };
    hangCanhBao.getCell(1).fill = NEN_HEADER_NHAP_DUOC;
  }
  sheet2.getColumn(1).width = 100;

  const hangBangLop = dongHuongDan.length + 2;
  const headerBangLop = [
    'Giai đoạn',
    'Tên lớp',
    'Loại lớp',
    'Mức năng lực của lớp',
    'Sĩ số tối đa',
    'Số đã xếp',
  ];
  headerBangLop.forEach((h, i) => {
    sheet2.getCell(hangBangLop, i + 1).value = h;
  });
  sheet2.getRow(hangBangLop).font = { bold: true };
  let hangLop = hangBangLop + 1;
  for (const gd of giaiDoan) {
    for (const lop of lopHoc) {
      const soDaXep = daTinh.filter((r) =>
        r.phan_lop.some((p) => p.giai_doan_id === gd.id && p.ten_lop === lop.ten_lop),
      ).length;
      sheet2.getRow(hangLop).values = [
        `GĐ${gd.thu_tu} – ${gd.ten_giai_doan}`,
        lop.ten_lop,
        LOAI_LOP_LABEL[lop.loai_lop],
        lop.muc_nang_luc ? MUC_NANG_LUC_LABEL[lop.muc_nang_luc] : '',
        lop.si_so_toi_da ?? '',
        soDaXep,
      ];
      hangLop++;
    }
  }
  [22, 26, 20, 20, 14, 12].forEach((w, i) => (sheet2.getColumn(i + 1).width = w));

  // ---- Sheet 3: Tổng hợp theo mức học (trên tập ĐÃ DUYỆT — tập có thể chia lớp) ----
  const sheet3 = workbook.addWorksheet('Tổng hợp theo mức học');
  const header3 = [
    'Mức học',
    'Số học viên',
    ...giaiDoan.map((gd) => `Đã xếp lớp GĐ${gd.thu_tu}`),
  ];
  sheet3.addRow(header3);
  sheet3.getRow(1).font = { bold: true };
  const nhomMuc: { nhan: string; muc: muc_nang_luc | null }[] = [
    { nhan: MUC_NANG_LUC_LABEL.nang_cao, muc: 'nang_cao' },
    { nhan: MUC_NANG_LUC_LABEL.thanh_thao, muc: 'thanh_thao' },
    { nhan: MUC_NANG_LUC_LABEL.co_ban, muc: 'co_ban' },
    { nhan: 'Chưa có mức', muc: null },
  ];
  for (const nhom of nhomMuc) {
    const trongNhom = daDuyet.filter((r) => r.mucHieuLuc === nhom.muc);
    sheet3.addRow([
      nhom.nhan,
      trongNhom.length,
      ...giaiDoan.map(
        (gd) =>
          trongNhom.filter((r) => r.phan_lop.some((p) => p.giai_doan_id === gd.id))
            .length,
      ),
    ]);
  }
  sheet3.addRow([
    'Tổng cộng',
    daDuyet.length,
    ...giaiDoan.map(
      (gd) => daDuyet.filter((r) => r.phan_lop.some((p) => p.giai_doan_id === gd.id)).length,
    ),
  ]);
  sheet3.getRow(sheet3.rowCount).font = { bold: true };
  [20, 14].forEach((w, i) => (sheet3.getColumn(i + 1).width = w));

  // ---- Sheet "Nhân viên (không xếp lớp)" (chỉ thêm khi có) ----
  if (nhanVien.length > 0) {
    const sheetNv = workbook.addWorksheet(TEN_SHEET_NHAN_VIEN);
    sheetNv.addRow([
      'Nhân viên hiện không tham gia khảo sát – đánh giá và tập huấn nên không đưa vào danh sách chia lớp.',
    ]);
    const headerNv = ['STT', 'Họ tên', 'Mã định danh', 'Trường', 'Lớp hiện tại'];
    sheetNv.mergeCells(1, 1, 1, headerNv.length);
    sheetNv.addRow(headerNv);
    sheetNv.getRow(2).font = { bold: true };
    nhanVien
      .sort(
        (a, b) =>
          a.ten_truong.localeCompare(b.ten_truong, 'vi') ||
          a.ho_ten.localeCompare(b.ho_ten, 'vi'),
      )
      .forEach((r, i) => {
        sheetNv.addRow([
          i + 1,
          r.ho_ten,
          r.ma_dinh_danh_moet ?? '',
          r.ten_truong,
          lopHienTaiNhanVien(r, giaiDoan),
        ]);
      });
    [6, 26, 16, 32, 36].forEach((w, i) => (sheetNv.getColumn(i + 1).width = w));
  }

  // ---- Sheet 4: Chưa duyệt (chỉ thêm khi có) ----
  if (chuaDuyet.length > 0) {
    const sheet4 = workbook.addWorksheet('Chưa duyệt');
    sheet4.addRow([
      'Học viên dưới đây CHƯA được duyệt hồ sơ nên chưa thể phân lớp — không có trong sheet "Phân lớp".',
    ]);
    const header4 = ['STT', 'Họ tên', 'Mã định danh', 'Trường', 'Trạng thái hồ sơ'];
    sheet4.mergeCells(1, 1, 1, header4.length);
    sheet4.addRow(header4);
    sheet4.getRow(2).font = { bold: true };
    chuaDuyet
      .sort(
        (a, b) =>
          a.ten_truong.localeCompare(b.ten_truong, 'vi') ||
          a.ho_ten.localeCompare(b.ho_ten, 'vi'),
      )
      .forEach((r, i) => {
        sheet4.addRow([
          i + 1,
          r.ho_ten,
          r.ma_dinh_danh_moet ?? '',
          r.ten_truong,
          NHAN_TRANG_THAI_HO_SO_CHUA_DUYET[r.trang_thai_ho_so] ?? r.trang_thai_ho_so,
        ]);
      });
    [6, 26, 16, 32, 16].forEach((w, i) => (sheet4.getColumn(i + 1).width = w));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Giữ maKhoa làm tham số công khai cho controller build filename.
export function tenFileChiaLop(maKhoa: string): string {
  return `danh-sach-chia-lop-${maKhoa}.xlsx`;
}
