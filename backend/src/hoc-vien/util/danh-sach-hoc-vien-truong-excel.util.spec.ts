import * as ExcelJS from 'exceljs';
import {
  COT_DANH_SACH_HOC_VIEN_TRUONG,
  DongHocVienTruong,
  buildDanhSachHocVienTruongWorkbook,
} from './danh-sach-hoc-vien-truong-excel.util';

async function docSheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook.worksheets[0];
}

function giaTriHang(sheet: ExcelJS.Worksheet, r: number): unknown[] {
  return (sheet.getRow(r).values as unknown[]).slice(1);
}

const HANG_HEADER = 6;

function dong(over: Partial<DongHocVienTruong> = {}): DongHocVienTruong {
  return {
    ma_dinh_danh_moet: '0012345678',
    ho_ten: 'Nguyễn Văn An',
    ngay_sinh: 5,
    thang_sinh: 3,
    nam_sinh: 1985,
    gioi_tinh: 'nam',
    so_dinh_danh_ca_nhan: '012345678901',
    chuc_vu: 'Giáo viên',
    doi_tuong: 'giao_vien',
    cap_giang_day: 'tieu_hoc',
    mon_giang_day: 'Toán',
    chuyen_mon: ['Sư phạm Toán', 'Tin học'],
    so_dien_thoai_lien_he: '0912345678',
    email_lien_he: 'an@example.com',
    nguon_tao: 'import_moet',
    trang_thai: 'da_duyet',
    day_du: true,
    thieu: [],
    ten_dang_nhap: '0012345678',
    dang_nhap_lan_cuoi: new Date('2026-10-08T03:05:00Z'),
    ...over,
  };
}

const moTa = {
  ten_truong: 'Trường Tiểu học Nguyễn Trãi',
  ten_don_vi_quan_ly: 'Phòng VHXH Long Xuyên',
  thoi_diem_xuat: new Date('2026-10-09T01:30:00Z'),
};

describe('buildDanhSachHocVienTruongWorkbook', () => {
  it('header đúng thứ tự cột, sheet "Danh sách học viên", có autofilter + đóng băng', async () => {
    const sheet = await docSheet(
      await buildDanhSachHocVienTruongWorkbook(moTa, [dong()]),
    );
    expect(sheet.name).toBe('Danh sách học viên');
    expect(giaTriHang(sheet, HANG_HEADER)).toEqual([
      'STT',
      'Mã định danh MOET',
      'Họ tên',
      'Ngày sinh',
      'Giới tính',
      'Số CCCD',
      'Chức vụ',
      'Đối tượng',
      'Cấp giảng dạy',
      'Môn giảng dạy',
      'Chuyên môn',
      'Số điện thoại',
      'Email',
      'Nguồn tạo',
      'Trạng thái hồ sơ',
      'Hồ sơ đầy đủ',
      'Còn thiếu',
      'Tên đăng nhập',
      'Đăng nhập lần cuối',
    ]);
    expect(COT_DANH_SACH_HOC_VIEN_TRUONG).toHaveLength(19);
    expect(sheet.getCell(HANG_HEADER, 1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({
      state: 'frozen',
      ySplit: HANG_HEADER,
    });
    expect(sheet.autoFilter).toBeTruthy();
  });

  it('dòng tiêu đề có tên trường, đơn vị quản lý, thời điểm xuất (giờ VN), tổng số', async () => {
    const sheet = await docSheet(
      await buildDanhSachHocVienTruongWorkbook(moTa, [dong(), dong()]),
    );
    expect(sheet.getCell(1, 1).value).toBe(
      'DANH SÁCH HỌC VIÊN — Trường Tiểu học Nguyễn Trãi',
    );
    expect(sheet.getCell(2, 1).value).toBe(
      'Đơn vị quản lý: Phòng VHXH Long Xuyên',
    );
    expect(sheet.getCell(3, 1).value).toBe('Thời điểm xuất: 09/10/2026 08:30');
    expect(sheet.getCell(4, 1).value).toBe('Tổng số: 2');
  });

  it('giữ số 0 đầu của mã MOET, CCCD, SĐT dưới dạng chuỗi + định dạng Text', async () => {
    const sheet = await docSheet(
      await buildDanhSachHocVienTruongWorkbook(moTa, [dong()]),
    );
    const r = HANG_HEADER + 1;
    expect(sheet.getCell(r, 2).value).toBe('0012345678');
    expect(sheet.getCell(r, 6).value).toBe('012345678901');
    expect(sheet.getCell(r, 12).value).toBe('0912345678');
    expect(sheet.getCell(r, 2).numFmt).toBe('@');
    expect(sheet.getCell(r, 6).numFmt).toBe('@');
    expect(sheet.getCell(r, 12).numFmt).toBe('@');
  });

  it('ngày sinh dd/mm/yyyy có số 0 đầu; nhãn đối tượng/cấp/nguồn/trạng thái; đăng nhập lần cuối giờ VN', async () => {
    const sheet = await docSheet(
      await buildDanhSachHocVienTruongWorkbook(moTa, [dong()]),
    );
    expect(giaTriHang(sheet, HANG_HEADER + 1)).toEqual([
      1,
      '0012345678',
      'Nguyễn Văn An',
      '05/03/1985',
      'Nam',
      '012345678901',
      'Giáo viên',
      'Giáo viên',
      'Tiểu học',
      'Toán',
      'Sư phạm Toán; Tin học',
      '0912345678',
      'an@example.com',
      'Import MOET',
      'Đã duyệt',
      'Có',
      '',
      '0012345678',
      '08/10/2026 10:05',
    ]);
  });

  it('hồ sơ chưa đầy đủ -> "Chưa" + nối danh sách thiếu; giá trị null -> ô trống', async () => {
    const sheet = await docSheet(
      await buildDanhSachHocVienTruongWorkbook(moTa, [
        dong({
          day_du: false,
          thieu: ['Thiếu email', 'Chưa chọn đối tượng'],
          doi_tuong: null,
          nguon_tao: 'tu_dang_ky',
          ten_dang_nhap: null,
          dang_nhap_lan_cuoi: null,
        }),
      ]),
    );
    const r = HANG_HEADER + 1;
    expect(sheet.getCell(r, 8).value).toBe('');
    expect(sheet.getCell(r, 14).value).toBe('Tự đăng ký');
    expect(sheet.getCell(r, 16).value).toBe('Chưa');
    expect(sheet.getCell(r, 17).value).toBe('Thiếu email; Chưa chọn đối tượng');
    expect(sheet.getCell(r, 18).value).toBe('');
    expect(sheet.getCell(r, 19).value).toBe('');
  });

  it('danh sách rỗng -> "Tổng số: 0", không có dòng dữ liệu; thiếu đơn vị quản lý -> để trống', async () => {
    const sheet = await docSheet(
      await buildDanhSachHocVienTruongWorkbook(
        { ...moTa, ten_don_vi_quan_ly: null },
        [],
      ),
    );
    expect(sheet.getCell(2, 1).value).toBe('Đơn vị quản lý: ');
    expect(sheet.getCell(4, 1).value).toBe('Tổng số: 0');
    expect(sheet.actualRowCount).toBe(5); // 4 dòng tiêu đề + header
    expect(sheet.getRow(HANG_HEADER + 1).hasValues).toBe(false);
  });
});
