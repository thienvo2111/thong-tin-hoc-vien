import * as ExcelJS from 'exceljs';
import {
  DanhSachHocVienService,
  gopTheoHocVien,
} from './danh-sach-hoc-vien.service';
import {
  COT_DANH_SACH_HOC_VIEN,
  KHONG_AP_DUNG,
} from './danh-sach-hoc-vien-excel.util';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { ThangMucService, THANG_MUC_MAC_DINH } from '../sso/thang-muc.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const user: AuthenticatedUser = {
  id: 'u-1',
  ten_dang_nhap: 'x',
  vai_tro: 'quan_tri',
  don_vi_id: null,
  hoc_vien_id: null,
  phai_doi_mat_khau: false,
  jti: 'jti-1',
  exp: 9999999999,
};

const HOAN_THANH = new Date('2026-10-05T03:00:00Z');

type Phieu = {
  loai: string;
  trang_thai: 'da_mo' | 'dang_lam' | 'hoan_thanh';
  muc_goc: string | null;
  hoan_thanh_luc: Date | null;
};

function dk(
  hvId: string,
  o: {
    ho_ten?: string;
    truong?: string;
    khoa?: string;
    doi_tuong?: string | null;
    dang_nhap?: Date | null;
    co_tai_khoan?: boolean;
    phieu?: Phieu[];
  } = {},
) {
  return {
    hoc_vien_id: hvId,
    khoa: { ten_khoa: o.khoa ?? 'Khóa 1' },
    hoc_vien: {
      ma_dinh_danh_moet: '0123',
      ho_ten: o.ho_ten ?? `HV ${hvId}`,
      ngay_sinh: 5,
      thang_sinh: 3,
      nam_sinh: 1980,
      gioi_tinh: 'nu',
      doi_tuong: o.doi_tuong === undefined ? 'giao_vien' : o.doi_tuong,
      cap_giang_day: 'thcs',
      so_dien_thoai_lien_he: '0900000000',
      email_lien_he: `${hvId}@x.vn`,
      don_vi_cong_tac: {
        ten_don_vi: o.truong ?? 'Trường A',
        don_vi_cha: { ten_don_vi: 'Sở X' },
      },
      nguoi_dung_account:
        o.co_tai_khoan === false
          ? null
          : { dang_nhap_lan_cuoi: o.dang_nhap ?? null },
      ket_qua_khao_sat: o.phieu ?? [],
    },
  };
}

const xong = (loai: string, muc: string | null = null): Phieu => ({
  loai,
  trang_thai: 'hoan_thanh',
  muc_goc: muc,
  hoan_thanh_luc: HOAN_THANH,
});

type Row = Parameters<typeof gopTheoHocVien>[0][number];
const gop = (rows: ReturnType<typeof dk>[]) =>
  gopTheoHocVien(rows as unknown as Row[], THANG_MUC_MAC_DINH);

describe('gopTheoHocVien', () => {
  it('học viên ở nhiều khóa -> 1 dòng, khóa nối, không lặp', () => {
    const r = gop([
      dk('a', { khoa: 'Khóa 1' }),
      dk('a', { khoa: 'Khóa 2' }),
      dk('a', { khoa: 'Khóa 1' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].ten_khoa).toEqual(['Khóa 1', 'Khóa 2']);
  });

  it('đủ dữ liệu cơ bản: họ tên, ngày sinh, đơn vị, đối tượng, SĐT, email', () => {
    const [d] = gop([dk('a')]);
    expect(d).toMatchObject({
      ho_ten: 'HV a',
      ngay_sinh: 5,
      thang_sinh: 3,
      nam_sinh: 1980,
      ten_don_vi: 'Trường A',
      ten_don_vi_cha: 'Sở X',
      doi_tuong: 'giao_vien',
      so_dien_thoai: '0900000000',
      email: 'a@x.vn',
    });
  });

  it('đã làm cả 2 phiếu -> da_lam + nhãn mức + thời điểm hoàn thành', () => {
    const [d] = gop([
      dk('a', { phieu: [xong('khao-sat'), xong('danh-gia', 'M3')] }),
    ]);
    expect(d.ky_nang_so).toBe('da_lam');
    expect(d.danh_gia_nls).toBe('da_lam');
    expect(d.muc_danh_gia).toBe('M3 – Thành thạo');
    expect(d.danh_gia_hoan_thanh_luc).toEqual(HOAN_THANH);
  });

  it('chưa có phiếu -> chua_lam; mở nhưng chưa làm -> chua_lam; đang làm -> dang_lam', () => {
    const [d] = gop([
      dk('a', {
        phieu: [
          {
            loai: 'khao-sat',
            trang_thai: 'da_mo',
            muc_goc: null,
            hoan_thanh_luc: null,
          },
          {
            loai: 'danh-gia',
            trang_thai: 'dang_lam',
            muc_goc: null,
            hoan_thanh_luc: null,
          },
        ],
      }),
    ]);
    expect(d.ky_nang_so).toBe('chua_lam');
    expect(d.danh_gia_nls).toBe('dang_lam');
    expect(d.muc_danh_gia).toBeNull();
    const [e] = gop([dk('b')]);
    expect(e.ky_nang_so).toBe('chua_lam');
    expect(e.danh_gia_nls).toBe('chua_lam');
  });

  it('nhân viên -> null (không áp dụng), kể cả khi có phiếu', () => {
    const [d] = gop([
      dk('a', { doi_tuong: 'nhan_vien', phieu: [xong('danh-gia', 'M2')] }),
    ]);
    expect(d.ky_nang_so).toBeNull();
    expect(d.danh_gia_nls).toBeNull();
    expect(d.muc_danh_gia).toBeNull();
  });

  it('chưa khai đối tượng (null) -> vẫn tính phải làm', () => {
    const [d] = gop([dk('a', { doi_tuong: null })]);
    expect(d.ky_nang_so).toBe('chua_lam');
    expect(d.danh_gia_nls).toBe('chua_lam');
  });

  it('truy cập: không tài khoản / chưa đăng nhập -> null; đã đăng nhập -> ngày', () => {
    const luc = new Date('2026-10-01T01:00:00Z');
    const r = gop([
      dk('a', { co_tai_khoan: false }),
      dk('b', { dang_nhap: null }),
      dk('c', { dang_nhap: luc }),
    ]);
    const theo = Object.fromEntries(r.map((d) => [d.email, d]));
    expect(theo['a@x.vn'].dang_nhap_lan_cuoi).toBeNull();
    expect(theo['b@x.vn'].dang_nhap_lan_cuoi).toBeNull();
    expect(theo['c@x.vn'].dang_nhap_lan_cuoi).toEqual(luc);
  });

  it('sắp xếp theo đơn vị rồi họ tên (tiếng Việt)', () => {
    const r = gop([
      dk('a', { truong: 'Trường B', ho_ten: 'An' }),
      dk('b', { truong: 'Trường A', ho_ten: 'Bình' }),
      dk('c', { truong: 'Trường A', ho_ten: 'Ánh' }),
    ]);
    expect(r.map((d) => d.ho_ten)).toEqual(['Ánh', 'Bình', 'An']);
  });

  it('danh sách rỗng -> []', () => {
    expect(gop([])).toEqual([]);
  });
});

describe('DanhSachHocVienService.xuatExcel', () => {
  let service: DanhSachHocVienService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    don_vi_cong_tac: { findUnique: jest.Mock; findMany: jest.Mock };
    cum_hoc_vien: { findUnique: jest.Mock };
  };
  let scope: { resolve: jest.Mock };
  let nhatKy: { ghi: jest.Mock };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      khoa_boi_duong: { findUnique: jest.fn().mockResolvedValue(null) },
      don_vi_cong_tac: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cum_hoc_vien: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    scope = {
      resolve: jest
        .fn()
        .mockResolvedValue({
          where: { SCOPE: 1 },
          rong: false,
          khoaIds: 'ALL',
        }),
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    service = new DanhSachHocVienService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
      {
        thang: jest.fn().mockResolvedValue(THANG_MUC_MAC_DINH),
      } as unknown as ThangMucService,
      nhatKy as unknown as NhatKyService,
    );
  });

  async function docSheet(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb.worksheets[0];
  }

  function timHangHeader(sheet: ExcelJS.Worksheet): number {
    for (let r = 1; r <= sheet.rowCount; r++) {
      if (sheet.getRow(r).getCell(1).value === 'STT') return r;
    }
    throw new Error('không thấy header');
  }

  it('lọc theo phạm vi thống kê, không phân trang; header đủ cột yêu cầu', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dk('a'), dk('b')]);
    const buf = await service.xuatExcel(user, { khoa_id: undefined });
    const arg = prisma.dang_ky_hoc.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ SCOPE: 1 });
    expect(arg.skip).toBeUndefined();
    expect(arg.take).toBeUndefined();

    const sheet = await docSheet(buf);
    const h = timHangHeader(sheet);
    const header = (sheet.getRow(h).values as unknown[]).slice(1);
    expect(header).toEqual(COT_DANH_SACH_HOC_VIEN);
    for (const cot of [
      'Họ tên',
      'Ngày sinh',
      'Đơn vị công tác',
      'Đối tượng',
      'Số điện thoại',
      'Email',
      'Truy cập hệ thống',
      'KS kĩ năng số (đầu vào)',
      'Đánh giá NLS đầu vào',
      'Kết quả đánh giá NLS',
    ]) {
      expect(header).toContain(cot);
    }
    expect(sheet.rowCount).toBe(h + 2);
  });

  it('dòng nhân viên ghi "Không áp dụng", không phải "Chưa làm"', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      dk('a', { doi_tuong: 'nhan_vien', ho_ten: 'NV' }),
      dk('b', { ho_ten: 'GV', phieu: [xong('danh-gia', 'M4')] }),
    ]);
    const sheet = await docSheet(await service.xuatExcel(user, {}));
    const h = timHangHeader(sheet);
    const cot = (ten: string) => COT_DANH_SACH_HOC_VIEN.indexOf(ten) + 1;
    const theoTen = new Map<string, ExcelJS.Row>();
    for (let r = h + 1; r <= sheet.rowCount; r++) {
      theoTen.set(
        String(sheet.getRow(r).getCell(cot('Họ tên')).value),
        sheet.getRow(r),
      );
    }
    const nv = theoTen.get('NV')!;
    expect(nv.getCell(cot('Đối tượng')).value).toBe('Nhân viên');
    expect(nv.getCell(cot('KS kĩ năng số (đầu vào)')).value).toBe(
      KHONG_AP_DUNG,
    );
    expect(nv.getCell(cot('Đánh giá NLS đầu vào')).value).toBe(KHONG_AP_DUNG);
    expect(nv.getCell(cot('Kết quả đánh giá NLS')).value).toBe(KHONG_AP_DUNG);
    expect(nv.getCell(cot('Truy cập hệ thống')).value).toBe('Chưa truy cập');
    const gv = theoTen.get('GV')!;
    expect(gv.getCell(cot('KS kĩ năng số (đầu vào)')).value).toBe('Chưa làm');
    expect(gv.getCell(cot('Đánh giá NLS đầu vào')).value).toBe('Đã làm');
    expect(gv.getCell(cot('Kết quả đánh giá NLS')).value).toBe('M4 – Nâng cao');
    expect(gv.getCell(cot('Ngày sinh')).value).toBe('05/03/1980');
  });

  it('phạm vi rỗng -> không truy vấn đăng ký, file chỉ có header', async () => {
    scope.resolve.mockResolvedValue({ where: {}, rong: true, khoaIds: [] });
    const sheet = await docSheet(await service.xuatExcel(user, {}));
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    expect(sheet.rowCount).toBe(timHangHeader(sheet));
  });

  it('nhiều trường -> tiêu đề nêu số đơn vị; ghi nhật ký kèm don_vi_ids', async () => {
    const T1 = '00000000-0000-4000-8000-0000000000a1';
    const T2 = '00000000-0000-4000-8000-0000000000a2';
    prisma.don_vi_cong_tac.findMany.mockResolvedValue([
      { ten_don_vi: 'Trường A' },
      { ten_don_vi: 'Trường B' },
    ]);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dk('a')]);
    const sheet = await docSheet(
      await service.xuatExcel(user, { don_vi_ids: [T1, T2] }),
    );
    expect(String(sheet.getRow(2).getCell(1).value)).toContain(
      '2 đơn vị: Trường A; Trường B',
    );
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'xuat_danh_sach_hoc_vien_tong_hop',
        chi_tiet: expect.objectContaining({ don_vi_ids: [T1, T2], so_dong: 1 }),
      }),
    );
  });

  it('lỗi phân quyền từ scope được ném ra, không ghi nhật ký', async () => {
    scope.resolve.mockRejectedValue(new Error('403'));
    await expect(service.xuatExcel(user, {})).rejects.toThrow('403');
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });
});
