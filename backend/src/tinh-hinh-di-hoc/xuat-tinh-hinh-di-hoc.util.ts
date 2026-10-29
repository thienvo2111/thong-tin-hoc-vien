import * as ExcelJS from 'exceljs';
import { TongDiHoc } from '../ho-tro-hoc-vien/diem-danh-lop-buoi.util';

// ADR 0010 T2: file xuất Tình hình đi học — đủ mọi dòng khớp bộ lọc (không
// phân trang). Không có ngày sinh/CCCD; mã MOET để dạng văn bản (giữ số 0 đầu).

export interface DongXuatDiHoc {
  ho_ten: string;
  ma_dinh_danh_moet: string | null;
  don_vi_cong_tac_ten: string;
  /** Xã/phường (địa bàn) và tỉnh/thành của trường. */
  don_vi_xa: string;
  don_vi_tinh: string | null;
  cum: string | null;
  lop_theo_giai_doan: { thu_tu: number; ten_lop: string }[];
  tong: TongDiHoc;
}

export const COT_TINH_HINH_DI_HOC = [
  'STT',
  'Họ tên',
  'Mã MOET',
  'Trường',
  'Xã/phường (trường)',
  'Tỉnh/thành (trường)',
  'Cụm',
  'Lớp',
  'Có mặt / đã diễn ra',
  'Vắng',
  'Vắng có phép',
  'Đã báo vắng',
  'Chưa điểm danh',
];

/** "GĐ1: Zoom 01; GĐ2: Trực tiếp 03" — lớp gốc theo thứ tự giai đoạn. */
export function oLopTheoGiaiDoan(
  ds: { thu_tu: number; ten_lop: string }[],
): string {
  return ds.map((l) => `GĐ${l.thu_tu}: ${l.ten_lop}`).join('; ');
}

export async function buildTinhHinhDiHocWorkbook(
  tieuDe: string,
  dong: DongXuatDiHoc[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tình hình đi học');
  ws.addRow([tieuDe]).font = { bold: true, size: 12 };
  ws.addRow(COT_TINH_HINH_DI_HOC).font = { bold: true };
  dong.forEach((h, i) =>
    ws.addRow([
      i + 1,
      h.ho_ten,
      h.ma_dinh_danh_moet ?? '',
      h.don_vi_cong_tac_ten,
      h.don_vi_xa,
      h.don_vi_tinh ?? '',
      h.cum ?? '',
      oLopTheoGiaiDoan(h.lop_theo_giai_doan),
      `${h.tong.co_mat}/${h.tong.da_dien_ra}`,
      h.tong.vang,
      h.tong.vang_co_phep,
      h.tong.da_bao_vang,
      h.tong.chua_diem_danh,
    ]),
  );
  ws.columns.forEach((c) => (c.width = 14));
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).numFmt = '@';
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 36;
  ws.getColumn(5).width = 24;
  ws.getColumn(6).width = 20;
  ws.getColumn(8).width = 36;
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
