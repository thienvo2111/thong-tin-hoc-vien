import { BaoCaoService } from './bao-cao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { ThongKeScopeService } from '../thong-ke/thong-ke-scope.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { ThangMucService } from '../sso/thang-muc.service';
import { ForbiddenAppException } from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

function caller(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'u-1',
    ten_dang_nhap: 'admin',
    vai_tro: 'quan_tri',
    don_vi_id: null,
    hoc_vien_id: null,
    phai_doi_mat_khau: false,
    jti: 'jti-1',
    exp: 9999999999,
    ...overrides,
  };
}

const THANG_MAC_DINH = [
  { ma: 'M1', nhan: 'Chưa đạt' },
  { ma: 'M2', nhan: 'Cơ bản' },
  { ma: 'M3', nhan: 'Thành thạo' },
  { ma: 'M4', nhan: 'Nâng cao' },
];

function thangMucRong() {
  return THANG_MAC_DINH.map((m) => ({ ...m, so_luong: 0 }));
}

const PHAM_VI_TAT_CA = { where: {}, rong: false, khoaIds: 'ALL' as const };

describe('BaoCaoService.tongQuan', () => {
  let service: BaoCaoService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    diem_danh: { groupBy: jest.Mock };
    lich_hoc_lop: { findMany: jest.Mock };
    nguoi_dung: { count: jest.Mock };
    lich_su_thay_doi_ho_so: { findMany: jest.Mock };
    ket_qua_khao_sat: { findMany: jest.Mock };
  };
  let thongKeScope: { resolve: jest.Mock };
  let thangMucService: { thang: jest.Mock };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      diem_danh: { groupBy: jest.fn().mockResolvedValue([]) },
      lich_hoc_lop: { findMany: jest.fn().mockResolvedValue([]) },
      nguoi_dung: { count: jest.fn().mockResolvedValue(0) },
      lich_su_thay_doi_ho_so: { findMany: jest.fn().mockResolvedValue([]) },
      ket_qua_khao_sat: { findMany: jest.fn().mockResolvedValue([]) },
    };
    thongKeScope = {
      resolve: jest.fn().mockResolvedValue(PHAM_VI_TAT_CA),
    };
    thangMucService = { thang: jest.fn().mockResolvedValue(THANG_MAC_DINH) };
    service = new BaoCaoService(
      prisma as unknown as PrismaService,
      {} as ScopeService,
      {} as HocVienService,
      thangMucService as unknown as ThangMucService,
      thongKeScope as unknown as ThongKeScopeService,
    );
  });

  it('đếm đúng tổng học viên tham gia + đã đăng nhập + đã chỉnh sửa hồ sơ (theo tập hoc_vien phân biệt)', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1' },
      { hoc_vien_id: 'hv-2' },
    ]);
    prisma.nguoi_dung.count.mockResolvedValue(1);
    prisma.lich_su_thay_doi_ho_so.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1' },
    ]);

    const result = await service.tongQuan({}, caller());

    expect(result.tong_hoc_vien_tham_gia).toBe(2);
    expect(result.da_dang_nhap).toBe(1);
    expect(result.da_chinh_sua_ho_so).toBe(1);
    expect(prisma.nguoi_dung.count).toHaveBeenCalledWith({
      where: {
        vai_tro: 'hoc_vien',
        hoc_vien_id: { in: ['hv-1', 'hv-2'] },
        dang_nhap_lan_cuoi: { not: null },
      },
    });
  });

  it('không có dang_ky_hoc nào khớp -> không gọi nguoi_dung.count/lich_su_thay_doi_ho_so.findMany', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([]);

    const result = await service.tongQuan({}, caller());

    expect(result.tong_hoc_vien_tham_gia).toBe(0);
    expect(result.da_dang_nhap).toBe(0);
    expect(result.da_chinh_sua_ho_so).toBe(0);
    expect(prisma.nguoi_dung.count).not.toHaveBeenCalled();
    expect(prisma.lich_su_thay_doi_ho_so.findMany).not.toHaveBeenCalled();
  });

  // Sửa 2026-10-07: portal KHÔNG quy đổi muc_goc -> muc (quyết định
  // 2026-10-05) — mức đếm thẳng theo muc_goc, thứ tự theo thang quản trị.
  it('khảo sát đầu vào/đầu ra đếm theo muc_goc của ket_qua_khao_sat (hoàn thành), đúng thứ tự thang', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1' },
      { hoc_vien_id: 'hv-2' },
      { hoc_vien_id: 'hv-3' },
      { hoc_vien_id: 'hv-4' },
    ]);
    prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
      // hv-1: chỉ làm phiếu khảo sát kĩ năng số -> KHÔNG tính đầu vào/đầu ra
      { hoc_vien_id: 'hv-1', loai: 'khao-sat', muc_goc: 'M1' },
      // hv-2: đánh giá + đầu ra đều có mức
      { hoc_vien_id: 'hv-2', loai: 'danh-gia', muc_goc: 'M2' },
      { hoc_vien_id: 'hv-2', loai: 'dau-ra', muc_goc: 'M4' },
      // hv-3: đánh giá đã nộp nhưng chưa có mức -> chưa xếp mức
      { hoc_vien_id: 'hv-3', loai: 'danh-gia', muc_goc: null },
    ]);

    const result = await service.tongQuan({}, caller());

    expect(prisma.ket_qua_khao_sat.findMany).toHaveBeenCalledWith({
      where: {
        hoc_vien_id: { in: ['hv-1', 'hv-2', 'hv-3', 'hv-4'] },
        trang_thai: 'hoan_thanh',
      },
      select: { hoc_vien_id: true, loai: true, muc_goc: true },
    });
    expect(result.khao_sat.dau_vao).toEqual({
      da_lam: 2,
      theo_muc: [
        { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
        { ma: 'M2', nhan: 'Cơ bản', so_luong: 1 },
        { ma: 'M3', nhan: 'Thành thạo', so_luong: 0 },
        { ma: 'M4', nhan: 'Nâng cao', so_luong: 0 },
      ],
      chua_xep_muc: 1,
    });
    expect(result.khao_sat.dau_ra).toEqual({
      da_lam: 1,
      theo_muc: [
        { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
        { ma: 'M2', nhan: 'Cơ bản', so_luong: 0 },
        { ma: 'M3', nhan: 'Thành thạo', so_luong: 0 },
        { ma: 'M4', nhan: 'Nâng cao', so_luong: 1 },
      ],
      chua_xep_muc: 0,
    });
  });

  it('mã muc_goc không có trong thang -> nối cuối theo_muc, nhãn = chính mã đó', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([{ hoc_vien_id: 'hv-1' }]);
    prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1', loai: 'danh-gia', muc_goc: 'X9' },
    ]);

    const result = await service.tongQuan({}, caller());

    expect(result.khao_sat.dau_vao.theo_muc).toEqual([
      ...thangMucRong(),
      { ma: 'X9', nhan: 'X9', so_luong: 1 },
    ]);
  });

  // Sửa 2026-10-07: thay "Kết quả theo hình thức" (dang_ky_hoc_lop, đã bỏ)
  // bằng tình hình tham gia học THEO ĐIỂM DANH thật, nhóm theo giai đoạn.
  it('tham_gia_hoc: nhóm điểm danh theo giai đoạn; so_buoi = số buổi có ít nhất 1 lượt điểm danh', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([{ hoc_vien_id: 'hv-1' }]);
    // gd-1 (K-001): 2 buổi (lh-1, lh-2); gd-2 (K-001): 1 buổi (lh-3).
    prisma.diem_danh.groupBy.mockResolvedValue([
      { lich_hoc_id: 'lh-1', trang_thai: 'co_mat', _count: { _all: 2 } },
      { lich_hoc_id: 'lh-1', trang_thai: 'vang', _count: { _all: 1 } },
      { lich_hoc_id: 'lh-2', trang_thai: 'co_mat', _count: { _all: 3 } },
      { lich_hoc_id: 'lh-3', trang_thai: 'vang_co_phep', _count: { _all: 1 } },
    ]);
    prisma.lich_hoc_lop.findMany.mockResolvedValue([
      {
        id: 'lh-1',
        giai_doan: {
          id: 'gd-1',
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp',
          khoa: { ma_khoa: 'K-001' },
        },
      },
      {
        id: 'lh-2',
        giai_doan: {
          id: 'gd-1',
          thu_tu: 1,
          ten_giai_doan: 'Trực tiếp',
          khoa: { ma_khoa: 'K-001' },
        },
      },
      {
        id: 'lh-3',
        giai_doan: {
          id: 'gd-2',
          thu_tu: 2,
          ten_giai_doan: 'Zoom',
          khoa: { ma_khoa: 'K-001' },
        },
      },
    ]);

    const result = await service.tongQuan({}, caller());

    expect(result.tham_gia_hoc).toEqual([
      {
        giai_doan_id: 'gd-1',
        ma_khoa: 'K-001',
        thu_tu: 1,
        ten_giai_doan: 'Trực tiếp',
        so_buoi: 2,
        co_mat: 5,
        vang_co_phep: 0,
        vang: 1,
      },
      {
        giai_doan_id: 'gd-2',
        ma_khoa: 'K-001',
        thu_tu: 2,
        ten_giai_doan: 'Zoom',
        so_buoi: 1,
        co_mat: 0,
        vang_co_phep: 1,
        vang: 0,
      },
    ]);
  });

  it('không có lượt điểm danh nào -> tham_gia_hoc rỗng, không truy vấn lich_hoc_lop', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([{ hoc_vien_id: 'hv-1' }]);
    prisma.diem_danh.groupBy.mockResolvedValue([]);

    const result = await service.tongQuan({}, caller());

    expect(result.tham_gia_hoc).toEqual([]);
    expect(prisma.lich_hoc_lop.findMany).not.toHaveBeenCalled();
  });

  it('gọi resolve với khoa_id + don_vi_id (map từ don_vi_cong_tac_id); lọc ngày AND với where của phạm vi', async () => {
    thongKeScope.resolve.mockResolvedValue({
      where: { khoa_id: { in: ['khoa-1'] } },
      rong: false,
      khoaIds: ['khoa-1'],
    });
    const user = caller();

    await service.tongQuan(
      {
        khoa_id: 'khoa-1',
        don_vi_cong_tac_id: 'dv-1',
        tu_ngay: '2026-01-01',
        den_ngay: '2026-01-31',
      },
      user,
    );

    expect(thongKeScope.resolve).toHaveBeenCalledWith(user, {
      khoa_id: 'khoa-1',
      don_vi_id: 'dv-1',
    });
    expect(prisma.dang_ky_hoc.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { khoa_id: { in: ['khoa-1'] } },
          {
            ngay_dang_ky: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          },
        ],
      },
      select: { hoc_vien_id: true },
    });
  });

  it('không lọc ngày -> chỉ where của phạm vi', async () => {
    const where = { khoa_id: { in: ['khoa-1'] } };
    thongKeScope.resolve.mockResolvedValue({
      where,
      rong: false,
      khoaIds: ['khoa-1'],
    });

    await service.tongQuan(
      {},
      caller({ vai_tro: 'truong', don_vi_id: 'dv-1' }),
    );

    expect(prisma.dang_ky_hoc.findMany).toHaveBeenCalledWith({
      where: { AND: [where] },
      select: { hoc_vien_id: true },
    });
  });

  it('phạm vi rỗng: trả kết quả rỗng, không truy vấn DB', async () => {
    thongKeScope.resolve.mockResolvedValue({
      where: { id: { in: [] } },
      rong: true,
      khoaIds: [],
    });

    const result = await service.tongQuan(
      {},
      caller({ vai_tro: 'truong', don_vi_id: null }),
    );

    expect(result.tong_hoc_vien_tham_gia).toBe(0);
    expect(result.tham_gia_hoc).toEqual([]);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('resolve ném 403 (ngoài phạm vi) -> lan ra, không truy vấn DB', async () => {
    thongKeScope.resolve.mockRejectedValue(
      new ForbiddenAppException('Ngoài phạm vi'),
    );

    await expect(
      service.tongQuan(
        { don_vi_cong_tac_id: 'dv-2' },
        caller({ vai_tro: 'truong', don_vi_id: 'dv-1' }),
      ),
    ).rejects.toThrow(ForbiddenAppException);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });
});
