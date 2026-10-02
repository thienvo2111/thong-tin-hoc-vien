import { BaoCaoService } from './bao-cao.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
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

describe('BaoCaoService.tongQuan', () => {
  let service: BaoCaoService;
  let prisma: {
    dang_ky_hoc: { findMany: jest.Mock };
    phan_lop_giai_doan: { findMany: jest.Mock };
    nguoi_dung: { count: jest.Mock };
    lich_su_thay_doi_ho_so: { findMany: jest.Mock };
  };
  let scopeService: {
    getAccessibleDonViIds: jest.Mock;
    canAccessDonVi: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      phan_lop_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
      nguoi_dung: { count: jest.fn().mockResolvedValue(0) },
      lich_su_thay_doi_ho_so: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scopeService = {
      getAccessibleDonViIds: jest.fn(),
      canAccessDonVi: jest.fn(),
    };
    service = new BaoCaoService(
      prisma as unknown as PrismaService,
      scopeService as unknown as ScopeService,
      {} as HocVienService,
    );
  });

  it('đếm đúng tổng học viên tham gia + đã đăng nhập + đã chỉnh sửa hồ sơ (theo tập hoc_vien phân biệt)', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1', muc_dau_vao: 'co_ban', muc_dau_ra: null },
      { hoc_vien_id: 'hv-2', muc_dau_vao: null, muc_dau_ra: 'nang_cao' },
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
    scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
    prisma.dang_ky_hoc.findMany.mockResolvedValue([]);

    const result = await service.tongQuan({}, caller());

    expect(result.tong_hoc_vien_tham_gia).toBe(0);
    expect(result.da_dang_nhap).toBe(0);
    expect(result.da_chinh_sua_ho_so).toBe(0);
    expect(prisma.nguoi_dung.count).not.toHaveBeenCalled();
    expect(prisma.lich_su_thay_doi_ho_so.findMany).not.toHaveBeenCalled();
  });

  it('khảo sát đầu vào/đầu ra đếm đúng theo mức năng lực', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1', muc_dau_vao: 'co_ban', muc_dau_ra: 'nang_cao' },
      { hoc_vien_id: 'hv-2', muc_dau_vao: 'thanh_thao', muc_dau_ra: null },
      { hoc_vien_id: 'hv-3', muc_dau_vao: null, muc_dau_ra: null },
    ]);

    const result = await service.tongQuan({}, caller());

    expect(result.khao_sat.dau_vao).toEqual({
      da_lam: 2,
      co_ban: 1,
      thanh_thao: 1,
      nang_cao: 0,
    });
    expect(result.khao_sat.dau_ra).toEqual({
      da_lam: 1,
      co_ban: 0,
      thanh_thao: 0,
      nang_cao: 1,
    });
  });

  it('kết quả theo hình thức nhóm đúng theo loai_lop + ket_qua, bỏ qua ket_qua NULL', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      { hoc_vien_id: 'hv-1', muc_dau_vao: null, muc_dau_ra: null },
    ]);
    // Phân lớp theo giai đoạn: dk-4 học VLE ở 2 giai đoạn -> chỉ đếm 1 lần.
    const pl = (dk: string, loai: string, ket_qua: string | null) => ({
      dang_ky_hoc_id: dk,
      lop: { loai_lop: loai },
      dang_ky_hoc: { ket_qua },
    });
    prisma.phan_lop_giai_doan.findMany.mockResolvedValue([
      pl('dk-1', 'truc_tiep', 'dat'),
      pl('dk-2', 'truc_tiep', 'dang_hoc'),
      pl('dk-3', 'zoom', 'khong_dat'),
      pl('dk-4', 'vle', 'vang'),
      pl('dk-4', 'vle', 'vang'),
      pl('dk-5', 'vle', null),
    ]);

    const result = await service.tongQuan({}, caller());

    expect(result.ket_qua_theo_hinh_thuc).toEqual([
      { loai_lop: 'truc_tiep', dang_hoc: 1, dat: 1, khong_dat: 0, vang: 0 },
      { loai_lop: 'zoom', dang_hoc: 0, dat: 0, khong_dat: 1, vang: 0 },
      { loai_lop: 'vle', dang_hoc: 0, dat: 0, khong_dat: 0, vang: 1 },
    ]);
  });

  it('lọc đúng theo khoa_id/don_vi_cong_tac_id/khoảng thời gian (quan_tri, don_vi bất kỳ)', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
    scopeService.canAccessDonVi.mockResolvedValue(true);

    await service.tongQuan(
      {
        khoa_id: 'khoa-1',
        don_vi_cong_tac_id: 'dv-1',
        tu_ngay: '2026-01-01',
        den_ngay: '2026-01-31',
      },
      caller(),
    );

    expect(prisma.dang_ky_hoc.findMany).toHaveBeenCalledWith({
      where: {
        hoc_vien: { don_vi_cong_tac_id: 'dv-1' },
        khoa_id: 'khoa-1',
        ngay_dang_ky: {
          gte: new Date('2026-01-01'),
          lte: new Date('2026-01-31'),
        },
      },
      select: { hoc_vien_id: true, muc_dau_vao: true, muc_dau_ra: true },
    });
  });

  it('phạm vi truong: chỉ lọc trong don_vi_id của chính mình', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue(['dv-1']);

    await service.tongQuan(
      {},
      caller({ vai_tro: 'truong', don_vi_id: 'dv-1' }),
    );

    expect(prisma.dang_ky_hoc.findMany).toHaveBeenCalledWith({
      where: { hoc_vien: { don_vi_cong_tac_id: { in: ['dv-1'] } } },
      select: { hoc_vien_id: true, muc_dau_vao: true, muc_dau_ra: true },
    });
  });

  it('scope rỗng (truong chưa gán don_vi): trả kết quả rỗng, không truy vấn DB', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue([]);

    const result = await service.tongQuan(
      {},
      caller({ vai_tro: 'truong', don_vi_id: null }),
    );

    expect(result.tong_hoc_vien_tham_gia).toBe(0);
    expect(result.ket_qua_theo_hinh_thuc).toHaveLength(3);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('don_vi_cong_tac_id ngoài phạm vi quyền -> 403, không lộ dữ liệu đơn vị khác', async () => {
    scopeService.getAccessibleDonViIds.mockResolvedValue(['dv-1']);
    scopeService.canAccessDonVi.mockResolvedValue(false);

    await expect(
      service.tongQuan(
        { don_vi_cong_tac_id: 'dv-2' },
        caller({ vai_tro: 'truong', don_vi_id: 'dv-1' }),
      ),
    ).rejects.toThrow(ForbiddenAppException);
    expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });
});
