import 'reflect-metadata';
import * as ExcelJS from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MucNlsService, tongHopMucNls } from './muc-nls.service';
import { MucNlsQueryDto } from './dto/thong-ke-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ThangMucService } from '../sso/thang-muc.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DongHocVienMuc } from './thong-ke.types';

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

const THANG = [
  { ma: 'M1', nhan: 'Chưa đạt' },
  { ma: 'M2', nhan: 'Cơ bản' },
  { ma: 'M3', nhan: 'Thành thạo' },
  { ma: 'M4', nhan: 'Nâng cao' },
];

function hv(
  id: string,
  donVi: string,
  ghiDe: Partial<DongHocVienMuc> = {},
): DongHocVienMuc {
  return {
    hoc_vien_id: id,
    ho_ten: `HV ${id}`,
    doi_tuong: 'giao_vien',
    cap_giang_day: 'thcs',
    don_vi_id: donVi,
    ten_don_vi: `Trường ${donVi}`,
    ten_don_vi_cha: 'Sở A',
    da_lam: true,
    muc_goc: 'M2',
    hoan_thanh_luc: new Date('2026-10-05T17:30:00Z'), // 06/10/2026 00:30 giờ VN
    ...ghiDe,
  };
}

type Dem = {
  so_hv: number;
  da_lam: number;
  chua_xep_muc: number;
  theo_muc: { ma: string; so_luong: number }[];
};
const soLuong = (d: Dem) =>
  Object.fromEntries(d.theo_muc.map((m) => [m.ma, m.so_luong]));
const cong = (ds: Dem[]) =>
  ds.reduce(
    (s, d) => ({
      so_hv: s.so_hv + d.so_hv,
      da_lam: s.da_lam + d.da_lam,
      chua_xep_muc: s.chua_xep_muc + d.chua_xep_muc,
    }),
    { so_hv: 0, da_lam: 0, chua_xep_muc: 0 },
  );

describe('tongHopMucNls', () => {
  const rows = [
    hv('a', 't1', { muc_goc: 'M1' }),
    hv('b', 't1', { muc_goc: 'M2' }),
    hv('c', 't1', { muc_goc: 'M2' }),
    hv('d', 't1', { muc_goc: 'M9' }), // ngoài thang
    hv('e', 't1', { muc_goc: null }), // không có mức
    hv('f', 't1', { da_lam: false, muc_goc: null, hoan_thanh_luc: null }),
    hv('g', 't2', { muc_goc: 'M4', doi_tuong: null, cap_giang_day: null }),
    hv('h', 't2', {
      da_lam: false,
      muc_goc: null,
      hoan_thanh_luc: null,
      doi_tuong: 'can_bo_quan_ly',
      cap_giang_day: 'thpt',
    }),
  ];

  it('đếm theo mức theo thứ tự thang; mức ngoài thang/null -> chưa xếp mức', () => {
    const kq = tongHopMucNls(rows, THANG);
    const t1 = kq.theo_truong.find((t) => t.don_vi_id === 't1')!;
    expect(t1).toMatchObject({
      so_hv: 6,
      da_lam: 5,
      chua_lam: 1,
      chua_xep_muc: 2,
    });
    expect(t1.theo_muc.map((m) => m.ma)).toEqual(['M1', 'M2', 'M3', 'M4']);
    expect(t1.theo_muc.map((m) => m.nhan)).toEqual(THANG.map((m) => m.nhan));
    expect(soLuong(t1)).toEqual({ M1: 1, M2: 2, M3: 0, M4: 0 });
  });

  it('tổng = tổng theo trường = tổng theo đối tượng = tổng theo cấp', () => {
    const kq = tongHopMucNls(rows, THANG);
    expect(kq.tong).toMatchObject({
      so_hv: 8,
      da_lam: 6,
      chua_lam: 2,
      chua_xep_muc: 2,
    });
    const mong = {
      so_hv: kq.tong.so_hv,
      da_lam: kq.tong.da_lam,
      chua_xep_muc: kq.tong.chua_xep_muc,
    };
    expect(cong(kq.theo_truong)).toEqual(mong);
    expect(cong(Object.values(kq.theo_doi_tuong))).toEqual(mong);
    expect(cong(Object.values(kq.theo_cap))).toEqual(mong);
    for (const ma of ['M1', 'M2', 'M3', 'M4']) {
      const t = (ds: Dem[]) => ds.reduce((s, d) => s + soLuong(d)[ma], 0);
      expect(t(kq.theo_truong)).toBe(soLuong(kq.tong)[ma]);
      expect(t(Object.values(kq.theo_doi_tuong))).toBe(soLuong(kq.tong)[ma]);
      expect(t(Object.values(kq.theo_cap))).toBe(soLuong(kq.tong)[ma]);
    }
  });

  it('nhóm Chưa xác định cho đối tượng/cấp null; nhan_vien tách riêng', () => {
    const kq = tongHopMucNls(rows, THANG);
    expect(kq.theo_doi_tuong.chua_xac_dinh.so_hv).toBe(1);
    expect(kq.theo_doi_tuong.giao_vien.so_hv).toBe(6);
    expect(kq.theo_doi_tuong.can_bo_quan_ly.chua_lam).toBe(1);
    expect(kq.theo_doi_tuong.nhan_vien.so_hv).toBe(0);
    expect(kq.theo_cap.chua_xac_dinh.so_hv).toBe(1);
    expect(kq.theo_cap.thpt.so_hv).toBe(1);
    expect(kq.theo_cap.thcs.so_hv).toBe(6);
  });

  it('theo_truong sắp theo tên (vi)', () => {
    const kq = tongHopMucNls([...rows].reverse(), THANG);
    expect(kq.theo_truong.map((t) => t.don_vi_id)).toEqual(['t1', 't2']);
  });

  it('thang tùy biến 3 mức vẫn đúng cột; mã cũ ngoài thang thành chưa xếp mức', () => {
    const thang3 = [
      { ma: 'A', nhan: 'Thấp' },
      { ma: 'B', nhan: 'Vừa' },
      { ma: 'C', nhan: 'Cao' },
    ];
    const kq = tongHopMucNls(
      [hv('a', 't1', { muc_goc: 'B' }), hv('b', 't1', { muc_goc: 'M4' })],
      thang3,
    );
    expect(kq.thang).toEqual(thang3);
    expect(kq.tong.theo_muc).toEqual([
      { ma: 'A', nhan: 'Thấp', so_luong: 0 },
      { ma: 'B', nhan: 'Vừa', so_luong: 1 },
      { ma: 'C', nhan: 'Cao', so_luong: 0 },
    ]);
    expect(kq.tong.chua_xep_muc).toBe(1);
  });

  it('rỗng -> toàn 0 nhưng vẫn đủ cột mức', () => {
    const kq = tongHopMucNls([], THANG);
    expect(kq.tong).toMatchObject({ so_hv: 0, da_lam: 0, chua_lam: 0 });
    expect(kq.tong.theo_muc).toHaveLength(4);
    expect(kq.theo_truong).toEqual([]);
  });
});

describe('MucNlsQueryDto', () => {
  const kiemTra = (loai?: unknown) =>
    validate(
      plainToInstance(MucNlsQueryDto, loai === undefined ? {} : { loai }),
    );

  it('chấp nhận dau_vao, dau_ra và bỏ trống', async () => {
    expect(await kiemTra('dau_vao')).toHaveLength(0);
    expect(await kiemTra('dau_ra')).toHaveLength(0);
    expect(await kiemTra()).toHaveLength(0);
  });

  it('loai khác -> lỗi', async () => {
    const loi = await kiemTra('xyz');
    expect(loi).toHaveLength(1);
    expect(loi[0].property).toBe('loai');
  });
});

describe('MucNlsService', () => {
  let service: MucNlsService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    don_vi_cong_tac: { findUnique: jest.Mock };
    cum_hoc_vien: { findUnique: jest.Mock };
  };
  let scope: { resolve: jest.Mock };
  let thangMuc: { thang: jest.Mock };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      khoa_boi_duong: { findUnique: jest.fn() },
      don_vi_cong_tac: { findUnique: jest.fn() },
      cum_hoc_vien: { findUnique: jest.fn() },
    };
    scope = { resolve: jest.fn() };
    thangMuc = { thang: jest.fn().mockResolvedValue(THANG) };
    service = new MucNlsService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
      thangMuc as unknown as ThangMucService,
    );
  });

  const dkRow = (id: string, ghiDe: Partial<DongHocVienMuc> = {}) => {
    const r = hv(id, 't1', ghiDe);
    return {
      hoc_vien_id: id,
      hoc_vien: {
        ho_ten: r.ho_ten,
        doi_tuong: r.doi_tuong,
        cap_giang_day: r.cap_giang_day,
        don_vi_cong_tac_id: r.don_vi_id,
        don_vi_cong_tac: {
          ten_don_vi: r.ten_don_vi,
          don_vi_cha: { ten_don_vi: 'Sở A' },
        },
        ket_qua_khao_sat: r.da_lam
          ? [{ muc_goc: r.muc_goc, hoan_thanh_luc: r.hoan_thanh_luc }]
          : [],
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
    expect(kq.loai).toBe('dau_vao');
    expect(kq.tong.so_hv).toBe(0);
    expect(kq.theo_truong).toEqual([]);
    expect(kq.thang).toEqual(THANG);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('khử trùng HV học 2 khóa, dùng đúng where, mặc định phiếu danh-gia', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      dkRow('a'),
      dkRow('a'),
      dkRow('b', { da_lam: false }),
    ]);
    const kq = await service.danhSach(caller, { khoa_id: 'k' });
    const arg = prisma.dang_ky_hoc.findMany.mock.calls[0][0];
    expect(arg.where).toBe(phamVi.where);
    const ks = arg.select.hoc_vien.select.ket_qua_khao_sat;
    expect(ks.where).toEqual({ loai: 'danh-gia', trang_thai: 'hoan_thanh' });
    expect(arg.select.hoc_vien.select.ho_ten).toBeUndefined();
    expect(kq.tong).toMatchObject({ so_hv: 2, da_lam: 1, chua_lam: 1 });
  });

  it('loai=dau_ra truy vấn phiếu dau-ra', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    const kq = await service.danhSach(caller, { loai: 'dau_ra' });
    const ks =
      prisma.dang_ky_hoc.findMany.mock.calls[0][0].select.hoc_vien.select
        .ket_qua_khao_sat;
    expect(ks.where).toEqual({ loai: 'dau-ra', trang_thai: 'hoan_thanh' });
    expect(kq.loai).toBe('dau_ra');
  });

  it('kết quả danh sách không chứa họ tên HV', async () => {
    scope.resolve.mockResolvedValue(phamVi);
    prisma.dang_ky_hoc.findMany.mockResolvedValue([dkRow('a')]);
    const kq = await service.danhSach(caller, {});
    expect(JSON.stringify(kq)).not.toContain('HV a');
  });

  it('xuatExcel rong: không truy vấn, không tra cứu tên, nhãn chung, đủ 4 sheet', async () => {
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
    expect(wb.worksheets).toHaveLength(4);
    const s = wb.getWorksheet('Tổng hợp')!;
    expect(s.getCell('A2').value).toBe('Khóa: Tất cả khóa');
    expect(s.getCell('A3').value).toBe(
      'Phạm vi: Toàn bộ phạm vi tài khoản · Đối tượng: Giáo viên',
    );
  });

  describe('xuatExcel có dữ liệu', () => {
    let wb: ExcelJS.Workbook;
    const cot = (s: ExcelJS.Worksheet, c: number) => {
      const kq: ExcelJS.CellValue[] = [];
      s.eachRow((r) => kq.push(r.getCell(c).value));
      return kq;
    };
    const tenHv = (s: ExcelJS.Worksheet) =>
      cot(s, 2).filter((v) => typeof v === 'string' && v.startsWith('HV '));

    beforeEach(async () => {
      scope.resolve.mockResolvedValue(phamVi);
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ten_khoa: 'Khóa X',
      });
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        dkRow('a', { muc_goc: 'M1' }),
        dkRow('b', { muc_goc: 'M2' }),
        dkRow('c', { muc_goc: null, doi_tuong: null, cap_giang_day: null }),
        dkRow('c', { muc_goc: null, doi_tuong: null, cap_giang_day: null }),
        dkRow('d', { da_lam: false, muc_goc: null, hoan_thanh_luc: null }),
      ]);
      wb = await doc(await service.xuatExcel(caller, { khoa_id: 'k' }));
    });

    it('4 sheet đúng tên và thứ tự; tiêu đề dòng 1 theo loai', async () => {
      expect(wb.worksheets.map((s) => s.name)).toEqual([
        'Tổng hợp',
        'Theo trường',
        'Danh sách học viên',
        'Chưa làm',
      ]);
      for (const s of wb.worksheets) {
        expect(s.getCell('A1').value).toBe(
          'BÁO CÁO KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC SỐ ĐẦU VÀO THEO MỨC',
        );
      }
      expect(wb.getWorksheet('Tổng hợp')!.getCell('A2').value).toBe(
        'Khóa: Khóa X',
      );
      const ra = await doc(await service.xuatExcel(caller, { loai: 'dau_ra' }));
      expect(ra.getWorksheet('Tổng hợp')!.getCell('A1').value).toBe(
        'BÁO CÁO KẾT QUẢ ĐÁNH GIÁ NĂNG LỰC SỐ ĐẦU RA THEO MỨC',
      );
    });

    it('Tổng hợp: 2 bảng có tên in đậm, dòng Tổng cộng, nhãn đối tượng/cấp', () => {
      const s = wb.getWorksheet('Tổng hợp')!;
      const cotA = cot(s, 1);
      expect(cotA).toEqual(
        expect.arrayContaining([
          'Theo đối tượng',
          'Giáo viên',
          'Cán bộ quản lý',
          'Nhân viên',
          'Chưa xác định',
          'Theo cấp giảng dạy',
          'Mầm non',
          'Trung cấp nghề',
        ]),
      );
      expect(cotA.filter((v) => v === 'Tổng cộng')).toHaveLength(2);
      let dongTen: ExcelJS.Row | undefined;
      let tong: ExcelJS.Row | undefined;
      s.eachRow((r) => {
        if (r.getCell(1).value === 'Theo đối tượng') dongTen = r;
        if (!tong && r.getCell(1).value === 'Tổng cộng') tong = r;
      });
      expect(dongTen!.getCell(1).font?.bold).toBe(true);
      // Số HV 4; Đã làm 3 (75%); Chưa làm 1 (25%).
      expect([2, 3, 4, 5, 6].map((c) => tong!.getCell(c).value)).toEqual([
        4, 3, 75, 1, 25,
      ]);
    });

    it('Theo trường: header, dòng trường và Tổng cộng, % đúng mẫu', () => {
      const s = wb.getWorksheet('Theo trường')!;
      expect([1, 2, 3, 4].map((c) => s.getRow(6).getCell(c).value)).toEqual([
        'STT',
        'Trường',
        'Đơn vị quản lý',
        'Số HV',
      ]);
      const dong = s.getRow(8);
      expect(dong.getCell(2).value).toBe('Trường t1');
      // Số HV 4; Đã làm 3 (75); Chưa làm 1 (25); M1 1; M2 1 (33,3 mỗi mức); M3 0; M4 0; Chưa xếp mức 1.
      expect(
        Array.from({ length: 15 }, (_, i) => dong.getCell(i + 4).value),
      ).toEqual([4, 3, 75, 1, 25, 1, 33.3, 1, 33.3, 0, 0, 0, 0, 1, 33.3]);
      const tong = s.getRow(9);
      expect(tong.getCell(1).value).toBe('Tổng cộng');
      expect(tong.getCell(4).value).toBe(4);
    });

    it('Danh sách học viên: chỉ HV đã làm, nhãn mức, ngày giờ VN', () => {
      const s = wb.getWorksheet('Danh sách học viên')!;
      expect(tenHv(s)).toEqual(['HV a', 'HV b', 'HV c']);
      expect(s.getRow(6).getCell(7).value).toBe('Mức');
      expect(s.getRow(6).getCell(8).value).toBe('Ngày hoàn thành');
      expect(s.getRow(7).getCell(7).value).toBe('Chưa đạt');
      expect(s.getRow(9).getCell(7).value).toBe('Chưa xếp mức');
      expect(s.getRow(7).getCell(8).value).toBe('06/10/2026');
    });

    it('Chưa làm: chỉ HV chưa làm', () => {
      const s = wb.getWorksheet('Chưa làm')!;
      expect(tenHv(s)).toEqual(['HV d']);
    });
  });
});
