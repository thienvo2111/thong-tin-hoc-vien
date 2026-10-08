import * as ExcelJS from 'exceljs';
import { BieuMauService, tongHopDangKyTruyCap } from './bieu-mau.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThongKeScopeService } from './thong-ke-scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DongHocVienBieuMau } from './thong-ke.types';

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

function dong(
  id: string,
  donVi: string,
  doiTuong: string | null,
  cap: string | null,
  daTruyCap: boolean,
): DongHocVienBieuMau {
  return {
    hoc_vien_id: id,
    doi_tuong: doiTuong,
    cap_giang_day: cap,
    don_vi_id: donVi,
    ten_don_vi: `Trường ${donVi}`,
    ten_don_vi_cha: 'Sở A',
    da_truy_cap: daTruyCap,
  };
}

describe('tongHopDangKyTruyCap', () => {
  const rows = [
    dong('a', 't1', 'giao_vien', 'thcs', true),
    dong('b', 't1', 'giao_vien', 'thcs', false),
    dong('c', 't1', 'can_bo_quan_ly', 'thpt', true),
    dong('d', 't2', null, null, false),
    dong('e', 't2', 'nhan_vien', 'trung_cap_nghe', true),
  ];

  it('null đối tượng/cấp -> chua_xac_dinh', () => {
    const kq = tongHopDangKyTruyCap(rows);
    expect(kq.ma_tran.chua_xac_dinh.chua_xac_dinh).toEqual({ dk: 1, tc: 0 });
    expect(kq.ma_tran.giao_vien.thcs).toEqual({ dk: 2, tc: 1 });
    expect(kq.ma_tran.nhan_vien.trung_cap_nghe).toEqual({ dk: 1, tc: 1 });
  });

  it('tổng, ma trận và tổng theo trường khớp nhau; tc <= dk', () => {
    const kq = tongHopDangKyTruyCap(rows);
    expect(kq.tong).toEqual({ dk: 5, tc: 3 });
    let dk = 0;
    let tc = 0;
    for (const dt of Object.values(kq.ma_tran)) {
      for (const o of Object.values(dt)) {
        expect(o.tc).toBeLessThanOrEqual(o.dk);
        dk += o.dk;
        tc += o.tc;
      }
    }
    expect({ dk, tc }).toEqual(kq.tong);
    expect(kq.theo_truong.reduce((s, t) => s + t.tong.dk, 0)).toBe(5);
    for (const t of kq.theo_truong) {
      const sumDt = Object.values(t.theo_doi_tuong).reduce(
        (s, o) => s + o.dk,
        0,
      );
      const sumCap = Object.values(t.theo_cap).reduce((s, o) => s + o.dk, 0);
      expect(sumDt).toBe(t.tong.dk);
      expect(sumCap).toBe(t.tong.dk);
    }
  });

  it('theo trường: sắp theo tên cha rồi tên đơn vị, đủ khóa 0', () => {
    const kq = tongHopDangKyTruyCap([...rows].reverse());
    expect(kq.theo_truong.map((t) => t.don_vi_id)).toEqual(['t1', 't2']);
    expect(kq.theo_truong[0].tong).toEqual({ dk: 3, tc: 2 });
    expect(kq.theo_truong[0].theo_doi_tuong.nhan_vien).toEqual({
      dk: 0,
      tc: 0,
    });
  });

  it('rỗng -> toàn số 0', () => {
    const kq = tongHopDangKyTruyCap([]);
    expect(kq.tong).toEqual({ dk: 0, tc: 0 });
    expect(kq.theo_truong).toEqual([]);
  });
});

describe('BieuMauService', () => {
  let service: BieuMauService;
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
    service = new BieuMauService(
      prisma as unknown as PrismaService,
      scope as unknown as ThongKeScopeService,
    );
  });

  async function doc(buf: Buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    return wb;
  }

  const dkRow = (hv: string, dangNhap: boolean) => ({
    hoc_vien_id: hv,
    hoc_vien: {
      doi_tuong: 'giao_vien',
      cap_giang_day: 'thcs',
      don_vi_cong_tac_id: 't1',
      don_vi_cong_tac: {
        ten_don_vi: 'Trường t1',
        don_vi_cha: { ten_don_vi: 'Sở A' },
      },
      nguoi_dung_account: { dang_nhap_lan_cuoi: dangNhap ? new Date() : null },
    },
  });

  function hangTongCong(s: ExcelJS.Worksheet): ExcelJS.Row {
    let hang: ExcelJS.Row | undefined;
    s.eachRow((r) => {
      if (r.getCell(1).value === 'Tổng cộng') hang = r;
    });
    return hang!;
  }

  it('rong -> workbook 3 sheet số 0, không truy vấn', async () => {
    scope.resolve.mockResolvedValue({
      where: { id: { in: [] } },
      rong: true,
      khoaIds: [],
    });
    const wb = await doc(await service.xuatDangKyTruyCap(caller, {}));
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Tổng hợp',
      'Theo đối tượng',
      'Theo cấp',
    ]);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    const hang = hangTongCong(wb.getWorksheet('Tổng hợp')!);
    expect(hang.getCell(2).value).toBe(0);
  });

  it('rong: không tra cứu tên khóa/đơn vị/cụm, tiêu đề dùng nhãn chung', async () => {
    scope.resolve.mockResolvedValue({
      where: { id: { in: [] } },
      rong: true,
      khoaIds: [],
    });
    const wb = await doc(
      await service.xuatDangKyTruyCap(caller, {
        khoa_id: 'k',
        don_vi_id: 'd',
        cum_id: 'c',
        doi_tuong: 'giao_vien',
      }),
    );
    expect(prisma.khoa_boi_duong.findUnique).not.toHaveBeenCalled();
    expect(prisma.don_vi_cong_tac.findUnique).not.toHaveBeenCalled();
    expect(prisma.cum_hoc_vien.findUnique).not.toHaveBeenCalled();
    const s = wb.getWorksheet('Tổng hợp')!;
    expect(s.getCell('A2').value).toBe('Khóa: Tất cả khóa');
    expect(s.getCell('A3').value).toBe(
      'Phạm vi: Toàn bộ phạm vi tài khoản · Đối tượng: Giáo viên',
    );
  });

  it('khử trùng HV học 2 khóa (đếm 1) và dùng đúng where', async () => {
    const where = { khoa_id: 'k' };
    scope.resolve.mockResolvedValue({ where, rong: false, khoaIds: ['k'] });
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      dkRow('a', true),
      dkRow('a', true),
      dkRow('b', false),
    ]);
    prisma.khoa_boi_duong.findUnique.mockResolvedValue({ ten_khoa: 'Khóa X' });
    const wb = await doc(
      await service.xuatDangKyTruyCap(caller, { khoa_id: 'k' }),
    );
    expect(prisma.dang_ky_hoc.findMany.mock.calls[0][0].where).toBe(where);
    const s = wb.getWorksheet('Tổng hợp')!;
    expect(s.getCell('A2').value).toBe('Khóa: Khóa X');
    const hang = hangTongCong(s);
    const cuoi = s.columnCount;
    expect(hang.getCell(cuoi - 2).value).toBe(2);
    expect(hang.getCell(cuoi - 1).value).toBe(1);
    expect(hang.getCell(cuoi).value).toBe(50);
  });
});
