import * as ExcelJS from 'exceljs';
import {
  ChatLuongHoSoService,
  tongHopChatLuongHoSo,
} from './chat-luong-ho-so.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DongHoSoHocVien } from './thong-ke.types';

const caller: AuthenticatedUser = {
  id: 'u-1',
  ten_dang_nhap: 'x',
  vai_tro: 'quan_tri',
  don_vi_id: null,
  hoc_vien_id: null,
  phai_doi_mat_khau: false,
  jti: 'jti-1',
  exp: 9999999999,
};

function hv(
  id: string,
  donVi: string,
  ghiDe: Partial<DongHoSoHocVien> = {},
): DongHoSoHocVien {
  return {
    hoc_vien_id: id,
    ho_ten: `HV ${id}`,
    doi_tuong: 'giao_vien',
    cap_giang_day: 'thcs',
    email: `${id}@x.vn`,
    so_dien_thoai: '0900000000',
    don_vi_id: donVi,
    ten_don_vi: `Trường ${donVi}`,
    ten_don_vi_cha: 'Sở A',
    ...ghiDe,
  };
}

describe('tongHopChatLuongHoSo', () => {
  const rows = [
    hv('a', 't1'),
    hv('b', 't1', { doi_tuong: null }),
    hv('c', 't1', { cap_giang_day: null, email: '   ' }),
    hv('d', 't2', { email: null, so_dien_thoai: '' }),
    hv('e', 't2'),
  ];

  it('đếm thiếu từng mục; email/SĐT rỗng hoặc khoảng trắng tính thiếu', () => {
    const kq = tongHopChatLuongHoSo(rows);
    const t1 = kq.theo_truong.find((t) => t.don_vi_id === 't1')!;
    expect(t1).toMatchObject({
      so_hv: 3,
      thieu_doi_tuong: 1,
      thieu_cap: 1,
      thieu_email: 1,
      thieu_sdt: 0,
      du_ho_so: 1,
    });
    expect(t1.ty_le_du).toBeCloseTo(1 / 3);
    const t2 = kq.theo_truong.find((t) => t.don_vi_id === 't2')!;
    expect(t2).toMatchObject({
      so_hv: 2,
      thieu_email: 1,
      thieu_sdt: 1,
      du_ho_so: 1,
      ty_le_du: 0.5,
    });
  });

  it('đủ hồ sơ chỉ khi đủ cả 4 mục', () => {
    const kq = tongHopChatLuongHoSo([
      hv('a', 't1'),
      hv('b', 't1', { so_dien_thoai: ' ' }),
    ]);
    expect(kq.tong.du_ho_so).toBe(1);
  });

  it('tổng bằng tổng các trường; theo_truong sắp theo tên', () => {
    const kq = tongHopChatLuongHoSo([...rows].reverse());
    expect(kq.theo_truong.map((t) => t.don_vi_id)).toEqual(['t1', 't2']);
    for (const k of [
      'so_hv',
      'thieu_doi_tuong',
      'thieu_cap',
      'thieu_email',
      'thieu_sdt',
      'du_ho_so',
    ] as const) {
      expect(kq.theo_truong.reduce((s, t) => s + t[k], 0)).toBe(kq.tong[k]);
    }
    expect(kq.tong.so_hv).toBe(5);
    expect(kq.tong.ty_le_du).toBeCloseTo(2 / 5);
  });

  it('rỗng -> toàn 0, ty_le_du null', () => {
    const kq = tongHopChatLuongHoSo([]);
    expect(kq.tong).toEqual({
      so_hv: 0,
      thieu_doi_tuong: 0,
      thieu_cap: 0,
      thieu_email: 0,
      thieu_sdt: 0,
      du_ho_so: 0,
      ty_le_du: null,
    });
    expect(kq.theo_truong).toEqual([]);
  });
});

describe('ChatLuongHoSoService', () => {
  let service: ChatLuongHoSoService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    don_vi_cong_tac: { findUnique: jest.Mock };
    cum_hoc_vien: { findUnique: jest.Mock };
  };
  let scope: { resolve: jest.Mock };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      khoa_boi_duong: { findUnique: jest.fn() },
      don_vi_cong_tac: { findUnique: jest.fn() },
      cum_hoc_vien: { findUnique: jest.fn() },
    };
    scope = { resolve: jest.fn() };
    service = new ChatLuongHoSoService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
    );
  });

  const dkRow = (id: string, ghiDe: Partial<DongHoSoHocVien> = {}) => {
    const r = hv(id, 't1', ghiDe);
    return {
      hoc_vien_id: id,
      hoc_vien: {
        id,
        ho_ten: r.ho_ten,
        doi_tuong: r.doi_tuong,
        cap_giang_day: r.cap_giang_day,
        email_lien_he: r.email,
        so_dien_thoai_lien_he: r.so_dien_thoai,
        don_vi_cong_tac_id: r.don_vi_id,
        don_vi_cong_tac: {
          ten_don_vi: r.ten_don_vi,
          don_vi_cha: { ten_don_vi: 'Sở A' },
        },
      },
    };
  };

  async function doc(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb;
  }

  const phamVi = { where: { khoa_id: 'k' }, rong: false, khoaIds: ['k'] };
  const rongVi = { where: { id: { in: [] } }, rong: true, khoaIds: [] };

  it('rong -> tong 0, theo_truong [], không truy vấn', async () => {
    scope.resolve.mockResolvedValue(rongVi);
    const kq = await service.danhSach(caller, {});
    expect(kq.tong.so_hv).toBe(0);
    expect(kq.tong.ty_le_du).toBeNull();
    expect(kq.theo_truong).toEqual([]);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('khử trùng HV học 2 khóa và dùng đúng where', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      dkRow('a'),
      dkRow('a'),
      dkRow('b', { doi_tuong: null }),
    ]);
    const kq = await service.danhSach(caller, { khoa_id: 'k' });
    expect(prisma.dang_ky_hoc.findMany.mock.calls[0][0].where).toBe(
      phamVi.where,
    );
    expect(kq.tong).toMatchObject({
      so_hv: 2,
      thieu_doi_tuong: 1,
      du_ho_so: 1,
    });
  });

  it('xuatExcel rong: không truy vấn, không tra cứu tên, nhãn chung', async () => {
    scope.resolve.mockResolvedValue(rongVi);
    const wb = await doc(
      await service.xuatExcel(caller, {
        khoa_id: 'k',
        don_vi_id: 'd',
        cum_id: 'c',
        doi_tuong: 'giao_vien',
      }),
    );
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    expect(prisma.khoa_boi_duong.findUnique).not.toHaveBeenCalled();
    expect(prisma.don_vi_cong_tac.findUnique).not.toHaveBeenCalled();
    expect(prisma.cum_hoc_vien.findUnique).not.toHaveBeenCalled();
    const s = wb.getWorksheet('Theo trường')!;
    expect(s.getCell('A1').value).toBe('BÁO CÁO CHẤT LƯỢNG HỒ SƠ HỌC VIÊN');
    expect(s.getCell('A2').value).toBe('Khóa: Tất cả khóa');
    expect(s.getCell('A3').value).toBe(
      'Phạm vi: Toàn bộ phạm vi tài khoản · Đối tượng: Giáo viên',
    );
  });

  describe('xuatExcel có dữ liệu', () => {
    let wb: ExcelJS.Workbook;
    beforeEach(async () => {
      scope.resolve.mockResolvedValue(phamVi);
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ten_khoa: 'Khóa X',
      });
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        dkRow('a'),
        dkRow('b', { doi_tuong: null, cap_giang_day: null }),
        dkRow('c', { email: '  ', so_dien_thoai: null }),
        dkRow('c', { email: '  ', so_dien_thoai: null }),
      ]);
      wb = await doc(await service.xuatExcel(caller, { khoa_id: 'k' }));
    });

    it('2 sheet đúng tên, tiêu đề và cột', () => {
      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Theo trường',
        'Cần bổ sung',
      ]);
      const s = wb.getWorksheet('Theo trường')!;
      expect(s.getCell('A2').value).toBe('Khóa: Khóa X');
      const cot = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
        (c) => s.getRow(6).getCell(c).value,
      );
      expect(cot).toEqual([
        'STT',
        'Trường',
        'Đơn vị quản lý',
        'Số HV',
        'Thiếu đối tượng',
        'Thiếu cấp giảng dạy',
        'Thiếu email',
        'Thiếu SĐT',
        'Đủ hồ sơ',
        'Tỷ lệ đủ (%)',
      ]);
    });

    it('dòng trường và Tổng cộng đúng số', () => {
      const s = wb.getWorksheet('Theo trường')!;
      const dong = s.getRow(7);
      expect(dong.getCell(2).value).toBe('Trường t1');
      expect([4, 5, 6, 7, 8, 9, 10].map((c) => dong.getCell(c).value)).toEqual([
        3, 1, 1, 1, 1, 1, 33.3,
      ]);
      const tong = s.getRow(8);
      expect(tong.getCell(1).value).toBe('Tổng cộng');
      expect(tong.getCell(4).value).toBe(3);
      expect(tong.getCell(9).value).toBe(1);
      expect(tong.getCell(10).value).toBe(33.3);
    });

    it('sheet Cần bổ sung: chỉ HV thiếu, cột Còn thiếu đúng chuỗi', () => {
      const s = wb.getWorksheet('Cần bổ sung')!;
      expect(s.getRow(6).getCell(9).value).toBe('Còn thiếu');
      const dong: Record<string, ExcelJS.CellValue> = {};
      s.eachRow((r, so) => {
        if (so >= 7) dong[String(r.getCell(2).value)] = r.getCell(9).value;
      });
      expect(dong).toEqual({
        'HV b': 'Đối tượng; Cấp giảng dạy',
        'HV c': 'Email; SĐT',
      });
    });

    it('nhãn đối tượng/cấp tiếng Việt hoặc trống', () => {
      const s = wb.getWorksheet('Cần bổ sung')!;
      const tim = (ten: string) => {
        let kq: ExcelJS.Row | undefined;
        s.eachRow((r, so) => {
          if (so >= 7 && r.getCell(2).value === ten) kq = r;
        });
        return kq!;
      };
      expect(tim('HV b').getCell(5).value ?? '').toBe('');
      expect(tim('HV b').getCell(6).value ?? '').toBe('');
      expect(tim('HV c').getCell(5).value).toBe('Giáo viên');
      expect(tim('HV c').getCell(6).value).toBe('THCS');
    });
  });
});
