import { KhoaBoiDuongService, taoBoNhoPhanLop } from './khoa-boi-duong.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';

let nhatKy: { ghi: jest.Mock };

// QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30) + phân lớp theo giai đoạn (spec
// 2026-10-02): test cho phân lớp (phan_lop_giai_doan) + cụm học viên trong
// KhoaBoiDuongService. File spec MỚI hoàn toàn — service này trước đó chưa
// có unit test riêng (chỉ có e2e), theo đúng pattern mock Prisma của
// hoc-vien.service.spec.ts/thong-bao.service.spec.ts (object jest.fn() thô,
// không dùng @nestjs/testing).
describe('KhoaBoiDuongService', () => {
  let service: KhoaBoiDuongService;
  let prisma: {
    khoa_boi_duong: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    don_vi_cong_tac: { findUnique: jest.Mock };
    lop_hoc: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    cum_hoc_vien: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    dang_ky_hoc: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    phan_lop_giai_doan: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      groupBy: jest.Mock;
    };
    giai_doan_khoa: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    lich_hoc_lop: {
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    hoc_vien: { findUnique: jest.Mock };
    diem_danh: { findMany: jest.Mock };
    ket_qua_giai_doan: { findMany: jest.Mock };
  };
  let scopeService: { canAccessDonVi: jest.Mock };
  let thongBaoService: { guiDangKyHocPhanLop: jest.Mock };

  const truong: AuthenticatedUser = {
    id: 'nd-truong-1',
    ten_dang_nhap: 'truong1',
    vai_tro: 'truong',
    don_vi_id: 'dv-truong-1',
    hoc_vien_id: null,
    phai_doi_mat_khau: false,
    jti: 'jti-1',
    exp: 0,
  };
  const khoa1 = { id: 'khoa-1', don_vi_dat_hang_id: 'dv-truong-1' };

  beforeEach(() => {
    prisma = {
      khoa_boi_duong: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      don_vi_cong_tac: { findUnique: jest.fn() },
      lop_hoc: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      cum_hoc_vien: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      dang_ky_hoc: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      phan_lop_giai_doan: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      giai_doan_khoa: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      lich_hoc_lop: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      hoc_vien: { findUnique: jest.fn() },
      // T12 (mo-rong-nls-an-giang.md, 2026-09-30): khoaHocTheoHocVienId (dùng
      // bởi khoaHocCuaToi/khoaHocCuaHocVien) nay truy vấn thêm điểm danh/tiến
      // độ giai đoạn — mặc định rỗng, test nào cần dữ liệu cụ thể tự override.
      diem_danh: { findMany: jest.fn().mockResolvedValue([]) },
      ket_qua_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
    };
    scopeService = { canAccessDonVi: jest.fn() };
    thongBaoService = {
      guiDangKyHocPhanLop: jest.fn().mockResolvedValue({ chuaCoEmail: false }),
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    service = new KhoaBoiDuongService(
      prisma as unknown as PrismaService,
      scopeService as unknown as ScopeService,
      thongBaoService as unknown as ThongBaoService,
      nhatKy as unknown as NhatKyService,
    );
  });

  // D1/D2/D6 (2026-10-03-don-vi-dat-hang): chỉ quan_tri tạo khóa, luôn
  // da_duyet ngay — validateDonViDatHang() dùng chung với capNhatKhoa.
  describe('taoKhoa', () => {
    const quanTri: AuthenticatedUser = {
      id: 'nd-qt-1',
      ten_dang_nhap: 'qt1',
      vai_tro: 'quan_tri',
      don_vi_id: null,
      hoc_vien_id: null,
      phai_doi_mat_khau: false,
      jti: 'jti-qt',
      exp: 0,
    };
    const donViSoGddt = {
      id: 'dv-so-1',
      loai_don_vi: 'so_gddt',
      trang_thai: 'active',
    };
    const dtoHopLe = {
      ma_khoa: 'K1',
      ten_khoa: 'Khóa 1',
      thoi_gian_bat_dau: '2026-01-01',
      thoi_gian_ket_thuc: '2026-01-31',
      don_vi_dat_hang_id: 'dv-so-1',
    };

    async function layFieldsLoi(
      promise: Promise<unknown>,
    ): Promise<{ field: string; message: string }[]> {
      try {
        await promise;
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationException);
        const body = (e as ValidationException).getResponse() as {
          error: { fields: { field: string; message: string }[] };
        };
        return body.error.fields;
      }
      throw new Error('Không throw như mong đợi');
    }

    it('thiếu don_vi_dat_hang_id -> field Bắt buộc', async () => {
      const fields = await layFieldsLoi(
        service.taoKhoa(
          { ...dtoHopLe, don_vi_dat_hang_id: undefined } as never,
          quanTri,
        ),
      );
      expect(fields).toContainEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Bắt buộc',
      });
      expect(prisma.don_vi_cong_tac.findUnique).not.toHaveBeenCalled();
    });

    it('don_vi_dat_hang_id không tồn tại -> field Không hợp lệ', async () => {
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue(null);
      const fields = await layFieldsLoi(
        service.taoKhoa(dtoHopLe as never, quanTri),
      );
      expect(fields).toContainEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Không hợp lệ',
      });
    });

    it('don_vi_dat_hang_id ngừng hoạt động -> Không hợp lệ', async () => {
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        ...donViSoGddt,
        trang_thai: 'ngung',
      });
      const fields = await layFieldsLoi(
        service.taoKhoa(dtoHopLe as never, quanTri),
      );
      expect(fields).toContainEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Không hợp lệ',
      });
    });

    it('don_vi_dat_hang_id loại phong_vhxh -> Sai loại đơn vị', async () => {
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        id: 'dv-phong-1',
        loai_don_vi: 'phong_vhxh',
        trang_thai: 'active',
      });
      const fields = await layFieldsLoi(
        service.taoKhoa(dtoHopLe as never, quanTri),
      );
      expect(fields).toContainEqual({
        field: 'don_vi_dat_hang_id',
        message: 'Sai loại đơn vị',
      });
    });

    it.each(['so_gddt', 'truong', 'khac'])(
      'don_vi_dat_hang_id loại %s -> tạo khóa da_duyet ngay',
      async (loai) => {
        prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
          id: 'dv-1',
          loai_don_vi: loai,
          trang_thai: 'active',
        });
        prisma.khoa_boi_duong.create.mockResolvedValue({ id: 'khoa-1' });

        await service.taoKhoa(dtoHopLe as never, quanTri);

        expect(prisma.khoa_boi_duong.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            don_vi_dat_hang_id: 'dv-1',
            trang_thai: 'da_duyet',
            nguoi_duyet_id: quanTri.id,
            cap_duyet_thuc_te: 'quan_tri',
            ngay_duyet: expect.any(Date),
          }),
        });
      },
    );
  });

  describe('capNhatKhoa', () => {
    const quanTri: AuthenticatedUser = {
      id: 'nd-qt-1',
      ten_dang_nhap: 'qt1',
      vai_tro: 'quan_tri',
      don_vi_id: null,
      hoc_vien_id: null,
      phai_doi_mat_khau: false,
      jti: 'jti-qt',
      exp: 0,
    };
    const khoaDaDuyet = {
      id: 'khoa-1',
      don_vi_dat_hang_id: 'dv-truong-1',
      trang_thai: 'da_duyet',
      thoi_gian_bat_dau: new Date('2026-01-01'),
      thoi_gian_ket_thuc: new Date('2026-01-31'),
    };

    it('không truyền don_vi_dat_hang_id -> giữ nguyên, không tra đơn vị', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaDaDuyet);
      prisma.khoa_boi_duong.update.mockResolvedValue(khoaDaDuyet);

      await service.capNhatKhoa(
        'khoa-1',
        { ten_khoa: 'Tên mới' } as never,
        quanTri,
      );

      expect(prisma.don_vi_cong_tac.findUnique).not.toHaveBeenCalled();
      expect(prisma.khoa_boi_duong.update).toHaveBeenCalledWith({
        where: { id: 'khoa-1' },
        data: expect.objectContaining({ don_vi_dat_hang_id: undefined }),
      });
    });

    it('khóa đã da_duyet vẫn sửa được (D6: mọi trạng thái)', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaDaDuyet);
      prisma.khoa_boi_duong.update.mockResolvedValue(khoaDaDuyet);

      await expect(
        service.capNhatKhoa(
          'khoa-1',
          { ten_khoa: 'Tên mới' } as never,
          quanTri,
        ),
      ).resolves.toBeDefined();
    });

    it('đổi don_vi_dat_hang_id sang Sở khác -> validate + update', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaDaDuyet);
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        id: 'dv-so-2',
        loai_don_vi: 'so_gddt',
        trang_thai: 'active',
      });
      prisma.khoa_boi_duong.update.mockResolvedValue(khoaDaDuyet);

      await service.capNhatKhoa(
        'khoa-1',
        { don_vi_dat_hang_id: 'dv-so-2' } as never,
        quanTri,
      );

      expect(prisma.khoa_boi_duong.update).toHaveBeenCalledWith({
        where: { id: 'khoa-1' },
        data: expect.objectContaining({ don_vi_dat_hang_id: 'dv-so-2' }),
      });
    });

    it('đổi don_vi_dat_hang_id sang phong_vhxh -> ValidationException, không update', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaDaDuyet);
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        id: 'dv-phong-1',
        loai_don_vi: 'phong_vhxh',
        trang_thai: 'active',
      });

      await expect(
        service.capNhatKhoa(
          'khoa-1',
          { don_vi_dat_hang_id: 'dv-phong-1' } as never,
          quanTri,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.khoa_boi_duong.update).not.toHaveBeenCalled();
    });
  });

  describe('themLop', () => {
    it('tạo lớp với đúng loai_lop truyền vào', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.create.mockResolvedValue({ id: 'lop-1' });

      await service.themLop(
        'khoa-1',
        { loai_lop: 'zoom', ten_lop: 'Lớp Zoom 1' } as never,
        truong,
      );

      expect(prisma.lop_hoc.create).toHaveBeenCalledWith({
        data: {
          khoa_id: 'khoa-1',
          loai_lop: 'zoom',
          ten_lop: 'Lớp Zoom 1',
          si_so_toi_da: undefined,
        },
      });
    });
  });

  describe('themCum', () => {
    it('tạo cụm học viên thuộc khóa', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.cum_hoc_vien.create.mockResolvedValue({ id: 'cum-1' });

      const res = await service.themCum(
        'khoa-1',
        { ten_cum: 'Cụm A', link_zalo: 'https://zalo.me/g/abc' } as never,
        truong,
      );

      expect(prisma.cum_hoc_vien.create).toHaveBeenCalledWith({
        data: {
          khoa_id: 'khoa-1',
          ten_cum: 'Cụm A',
          link_zalo: 'https://zalo.me/g/abc',
          ghi_chu: undefined,
        },
      });
      expect(res).toEqual({ id: 'cum-1' });
    });
  });

  describe('khoaHocCuaToi', () => {
    it('trả giai_doan[] theo giai đoạn active: lớp được gán (chỉ buổi của GĐ đó) hoặc null + cum', async () => {
      const gd = (id: string, thu_tu: number) => ({
        id,
        thu_tu,
        ten_giai_doan: `GĐ ${thu_tu}`,
        hinh_thuc: 'truc_tuyen',
        link_hoac_dia_diem: null,
        huong_dan: null,
      });
      const lopZoom = {
        id: 'lop-zoom',
        ten_lop: 'Lớp Zoom',
        lich_hoc: [
          { id: 'b-2', giai_doan_id: 'gd-2' },
          { id: 'b-3', giai_doan_id: 'gd-3' },
        ],
      };
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        {
          id: 'dk-1',
          hoc_vien_id: 'hv-1',
          khoa: { id: 'khoa-1', giai_doan: [gd('gd-1', 1), gd('gd-2', 2)] },
          cum: { id: 'cum-1', ten_cum: 'Cụm A' },
          phan_lop_giai_doan: [{ giai_doan_id: 'gd-2', lop: lopZoom }],
        },
      ]);

      const res = await service.khoaHocCuaToi({
        ...truong,
        vai_tro: 'hoc_vien',
        hoc_vien_id: 'hv-1',
      });

      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        id: 'dk-1',
        khoa: { id: 'khoa-1' },
        cum: { id: 'cum-1', ten_cum: 'Cụm A' },
      });
      expect(res[0].giai_doan.map((g) => g.lop?.id ?? null)).toEqual([
        null,
        'lop-zoom',
      ]);
      expect(res[0].giai_doan[1].lop?.lich_hoc.map((b) => b.id)).toEqual([
        'b-2',
      ]);
      // mảng nội bộ không lọt ra response cuối.
      expect(res[0]).not.toHaveProperty('phan_lop_giai_doan');
      expect(res[0].khoa).not.toHaveProperty('giai_doan');
    });

    it('không có hoc_vien_id -> ForbiddenAppException', async () => {
      await expect(
        service.khoaHocCuaToi({
          ...truong,
          vai_tro: 'hoc_vien',
          hoc_vien_id: null,
        }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });
  });

  // Thêm 2026-09-30 (QĐ10): GET /hoc-vien/{id}/khoa-hoc — cùng dữ liệu như
  // khoaHocCuaToi ở trên nhưng hocVienId truyền qua param + kiểm tra quyền
  // qua canAccessDonVi (giống HocVienService.findOne) thay vì lấy từ token.
  describe('khoaHocCuaHocVien', () => {
    it('trong phạm vi quyền -> trả cùng cấu trúc như khoaHocCuaToi', async () => {
      const lopTT = { id: 'lop-tt', ten_lop: 'Lớp TT' };
      prisma.hoc_vien.findUnique.mockResolvedValue({
        id: 'hv-1',
        don_vi_cong_tac_id: 'dv-truong-1',
      });
      scopeService.canAccessDonVi.mockResolvedValue(true);
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        {
          id: 'dk-1',
          hoc_vien_id: 'hv-1',
          khoa: {
            id: 'khoa-1',
            giai_doan: [{ id: 'gd-4', thu_tu: 4, ten_giai_doan: 'Trực tiếp' }],
          },
          cum: null,
          phan_lop_giai_doan: [
            { giai_doan_id: 'gd-4', lop: { ...lopTT, lich_hoc: [] } },
          ],
        },
      ]);

      const res = await service.khoaHocCuaHocVien('hv-1', truong);

      expect(scopeService.canAccessDonVi).toHaveBeenCalledWith(
        truong,
        'dv-truong-1',
      );
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ id: 'dk-1', cum: null });
      expect(res[0].giai_doan[0].lop).toMatchObject(lopTT);
    });

    it('ngoài phạm vi quyền -> ForbiddenAppException, không đọc dang_ky_hoc', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        id: 'hv-1',
        don_vi_cong_tac_id: 'dv-truong-khac',
      });
      scopeService.canAccessDonVi.mockResolvedValue(false);

      await expect(
        service.khoaHocCuaHocVien('hv-1', truong),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
      expect(prisma.dang_ky_hoc.findMany).not.toHaveBeenCalled();
    });

    it('không tìm thấy hồ sơ học viên -> NotFoundAppException', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);

      await expect(
        service.khoaHocCuaHocVien('hv-khong-ton-tai', truong),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('resolvePhanLopRow + commitPhanLop (theo giai đoạn)', () => {
    const hocVienDaDuyet = { id: 'hv-1', trang_thai: 'da_duyet' };
    const khoa = { id: 'khoa-1', ma_khoa: 'K1' };
    const gd2 = {
      id: 'gd-2',
      thu_tu: 2,
      ten_giai_doan: 'Zoom',
      hinh_thuc: 'truc_tuyen' as const,
    };
    const gd3 = {
      id: 'gd-3',
      thu_tu: 3,
      ten_giai_doan: 'VLE',
      hinh_thuc: 'truc_tuyen' as const,
    };

    beforeEach(() => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) => {
        if (where.so_dinh_danh_ca_nhan === '123456789012')
          return hocVienDaDuyet;
        return null;
      });
      prisma.giai_doan_khoa.findMany.mockResolvedValue([gd2, gd3]);
    });

    it('ô tên lớp -> gán, ô "-" -> gỡ, cột vắng/ô trống -> không có trong gan; kèm cụm', async () => {
      prisma.lop_hoc.findMany.mockResolvedValue([
        {
          id: 'lop-zoom',
          ten_lop: 'Lớp Zoom',
          loai_lop: 'zoom',
          muc_nang_luc: null,
        },
      ]);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({ id: 'cum-1' });

      const { dto, error, canhBao } = await service.resolvePhanLopRow(
        {
          so_dinh_danh_ca_nhan: '123456789012',
          'gd:2': 'Lớp Zoom',
          'gd:3': '-',
          ten_cum: 'Cụm A',
        },
        khoa,
      );

      expect(error).toBeUndefined();
      expect(canhBao).toBeUndefined();
      expect(dto).toEqual({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        cum_id: 'cum-1',
        gan: [
          { giai_doan_id: 'gd-2', lop_id: 'lop-zoom' },
          { giai_doan_id: 'gd-3', lop_id: null },
        ],
      });
    });

    it('không tìm thấy lớp -> lỗi ghi rõ GĐ và tên lớp', async () => {
      prisma.lop_hoc.findMany.mockResolvedValue([]);
      const { error, dto } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', 'gd:2': 'Lớp Ma' },
        khoa,
      );
      expect(dto).toBeUndefined();
      expect(error).toContain('GĐ2');
      expect(error).toContain('Lớp Ma');
    });

    // Hiệu năng (~9.000 học viên/lượt): giai đoạn truyền sẵn từ ImportService,
    // tra lớp theo tên + đếm buổi (lớp, GĐ) nhớ lại trong cả lượt import.
    it('dùng chung bộ nhớ lượt import: không query lại giai đoạn; mỗi tên lớp và mỗi (lớp, GĐ) chỉ tra 1 lần', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) => ({
        id: `hv-${where.so_dinh_danh_ca_nhan}`,
        trang_thai: 'da_duyet',
      }));
      prisma.lop_hoc.findMany.mockResolvedValue([
        {
          id: 'lop-zoom',
          ten_lop: 'Lớp Zoom',
          loai_lop: 'zoom',
          muc_nang_luc: null,
        },
      ]);
      const boNho = taoBoNhoPhanLop();
      const khoaCoGiaiDoan = { ...khoa, giai_doan: [gd2, gd3] };

      for (const sdd of ['111111111111', '222222222222', '333333333333']) {
        const { error, dto } = await service.resolvePhanLopRow(
          { so_dinh_danh_ca_nhan: sdd, 'gd:2': 'Lớp Zoom' },
          khoaCoGiaiDoan,
          undefined,
          boNho,
        );
        expect(error).toBeUndefined();
        expect(dto?.gan).toEqual([
          { giai_doan_id: 'gd-2', lop_id: 'lop-zoom' },
        ]);
      }
      expect(prisma.giai_doan_khoa.findMany).not.toHaveBeenCalled();
      expect(prisma.lop_hoc.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.lich_hoc_lop.count).toHaveBeenCalledTimes(1);
    });

    it('tên cụm dạng NFD (Excel trên Mac) -> tra theo NFC, vẫn khớp cụm', async () => {
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({ id: 'cum-1' });
      const { dto, error } = await service.resolvePhanLopRow(
        {
          so_dinh_danh_ca_nhan: '123456789012',
          ten_cum: 'Cụm Long Xuyên'.normalize('NFD'),
        },
        khoa,
      );
      expect(error).toBeUndefined();
      expect(dto?.cum_id).toBe('cum-1');
      expect(prisma.cum_hoc_vien.findUnique).toHaveBeenCalledWith({
        where: {
          khoa_id_ten_cum: {
            khoa_id: 'khoa-1',
            ten_cum: 'Cụm Long Xuyên'.normalize('NFC'),
          },
        },
      });
    });

    it('không tìm thấy cụm -> lỗi rõ ràng', async () => {
      prisma.cum_hoc_vien.findUnique.mockResolvedValue(null);
      const { error } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', ten_cum: 'Cụm Không Tồn Tại' },
        khoa,
      );
      expect(error).toContain('cụm học viên');
    });

    it('mức năng lực lớp khác mức đầu vào -> cảnh báo, không chặn', async () => {
      prisma.lop_hoc.findMany.mockResolvedValue([
        {
          id: 'lop-zoom',
          ten_lop: 'Lớp Zoom',
          loai_lop: 'zoom',
          muc_nang_luc: 'nang_cao',
        },
      ]);
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        muc_dau_vao: 'co_ban',
      });
      const { dto, canhBao } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', 'gd:2': 'Lớp Zoom' },
        khoa,
      );
      expect(dto).toBeDefined();
      expect(canhBao).toContain('co_ban');
      expect(canhBao).toContain('nang_cao');
    });

    it('commitPhanLop: gán lớp trực tiếp -> upsert phan_lop_giai_doan, da_phan_lop, gửi email', async () => {
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.lop_hoc.count.mockResolvedValue(1);

      const res = await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        gan: [
          { giai_doan_id: 'gd-4', lop_id: 'lop-tt' },
          { giai_doan_id: 'gd-2', lop_id: 'lop-zoom' },
        ],
      });

      expect(prisma.dang_ky_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ trang_thai: 'da_phan_lop' }),
        }),
      );
      expect(prisma.phan_lop_giai_doan.upsert).toHaveBeenCalledTimes(2);
      expect(thongBaoService.guiDangKyHocPhanLop).toHaveBeenCalledWith('dk-1');
      expect(res).toEqual({ hocVienChuaCoEmail: false });
    });

    it('commitPhanLop: chỉ gán cụm -> không đụng phan_lop_giai_doan, không email, mặc định da_duyet', async () => {
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });

      const res = await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        cum_id: 'cum-1',
        gan: [],
      });

      expect(prisma.dang_ky_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trang_thai: 'da_duyet',
            cum_id: 'cum-1',
          }),
        }),
      );
      expect(prisma.phan_lop_giai_doan.upsert).not.toHaveBeenCalled();
      expect(thongBaoService.guiDangKyHocPhanLop).not.toHaveBeenCalled();
      expect(res).toEqual({ hocVienChuaCoEmail: false });
    });

    it('commitPhanLop: chỉ gán zoom + gỡ 1 GĐ -> da_phan_lop, deleteMany GĐ bị gỡ, KHÔNG email', async () => {
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.lop_hoc.count.mockResolvedValue(0);

      await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        gan: [
          { giai_doan_id: 'gd-2', lop_id: 'lop-zoom' },
          { giai_doan_id: 'gd-3', lop_id: null },
        ],
      });

      expect(prisma.phan_lop_giai_doan.deleteMany).toHaveBeenCalledWith({
        where: { dang_ky_hoc_id: 'dk-1', giai_doan_id: 'gd-3' },
      });
      expect(thongBaoService.guiDangKyHocPhanLop).not.toHaveBeenCalled();
    });
  });

  describe('resolveLopVaLichHocRow — loai_lop (QĐ10)', () => {
    const khoaFull = { id: 'khoa-1', ma_khoa: 'K1' };
    // Đủ field cho canhBaoBuoiHocGiaiDoan (ngày + hình thức của giai đoạn).
    const giaiDoan1 = {
      id: 'gd-1',
      khoa_id: 'khoa-1',
      thu_tu: 1,
      ten_giai_doan: 'Giai đoạn 1',
      hinh_thuc: 'truc_tuyen',
      thoi_gian_bat_dau: new Date('2026-01-01T00:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-12-31T00:00:00Z'),
    };

    beforeEach(() => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaFull);
      prisma.giai_doan_khoa.findUnique.mockResolvedValue(giaiDoan1);
    });

    it('không truyền loai_lop -> mặc định truc_tiep', async () => {
      const { dto, error } = await service.resolveLopVaLichHocRow({
        ma_khoa: 'K1',
        ten_lop: 'Lớp 1',
        giai_doan_thu_tu: '1',
        buoi_so: '1',
        bat_dau: '01/03/2026 08:00',
        ket_thuc: '01/03/2026 10:00',
      });
      expect(error).toBeUndefined();
      expect(dto?.loai_lop).toBe('truc_tiep');
    });

    it('loai_lop="zoom" -> giữ nguyên giá trị', async () => {
      const { dto, error } = await service.resolveLopVaLichHocRow({
        ma_khoa: 'K1',
        ten_lop: 'Lớp Zoom 1',
        loai_lop: 'zoom',
        giai_doan_thu_tu: '1',
        buoi_so: '1',
        bat_dau: '01/03/2026 08:00',
        ket_thuc: '01/03/2026 10:00',
      });
      expect(error).toBeUndefined();
      expect(dto?.loai_lop).toBe('zoom');
    });

    it('loai_lop sai giá trị -> lỗi rõ ràng', async () => {
      const { error } = await service.resolveLopVaLichHocRow({
        ma_khoa: 'K1',
        ten_lop: 'Lớp X',
        loai_lop: 'khong_hop_le',
        giai_doan_thu_tu: '1',
        buoi_so: '1',
        bat_dau: '01/03/2026 08:00',
        ket_thuc: '01/03/2026 10:00',
      });
      expect(error).toContain('loai_lop');
    });
  });

  describe('commitLopVaLichHoc — upsert theo (khoa_id, loai_lop, ten_lop)', () => {
    it('upsert lop_hoc dùng đúng khóa unique 3 trường mới', async () => {
      prisma.lop_hoc.upsert.mockResolvedValue({ id: 'lop-1' });
      const lichHocLop = { upsert: jest.fn().mockResolvedValue({}) };
      (prisma as unknown as { lich_hoc_lop: typeof lichHocLop }).lich_hoc_lop =
        lichHocLop;

      await service.commitLopVaLichHoc({
        khoa_id: 'khoa-1',
        ten_lop: 'Lớp Zoom 1',
        loai_lop: 'zoom',
        giai_doan_id: 'gd-1',
        buoi_so: 1,
        thoi_gian_bat_dau: new Date('2026-03-01T08:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-03-01T10:00:00Z'),
      } as never);

      expect(prisma.lop_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            khoa_id_loai_lop_ten_lop: {
              khoa_id: 'khoa-1',
              loai_lop: 'zoom',
              ten_lop: 'Lớp Zoom 1',
            },
          },
          create: expect.objectContaining({ loai_lop: 'zoom' }),
        }),
      );
    });
  });

  // Thêm 2026-09-30: PATCH giai-đoạn/lớp/lịch/cụm (sửa, không xóa cứng).
  describe('capNhatGiaiDoan', () => {
    const giaiDoan1 = {
      id: 'gd-1',
      khoa_id: 'khoa-1',
      thu_tu: 1,
      thoi_gian_bat_dau: new Date('2026-03-01T00:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-03-05T00:00:00Z'),
    };

    it('sửa thành công', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.giai_doan_khoa.findUnique.mockResolvedValue(giaiDoan1);
      prisma.giai_doan_khoa.update.mockResolvedValue({
        ...giaiDoan1,
        ten_giai_doan: 'Giai đoạn 1 (sửa)',
      });

      await service.capNhatGiaiDoan(
        'khoa-1',
        'gd-1',
        { ten_giai_doan: 'Giai đoạn 1 (sửa)' } as never,
        truong,
      );

      expect(prisma.giai_doan_khoa.update).toHaveBeenCalledWith({
        where: { id: 'gd-1' },
        data: {
          thu_tu: undefined,
          ten_giai_doan: 'Giai đoạn 1 (sửa)',
          hinh_thuc: undefined,
          thoi_gian_bat_dau: undefined,
          thoi_gian_ket_thuc: undefined,
          trang_thai: undefined,
        },
      });
    });

    it('body rỗng -> ValidationException, không gọi update', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.giai_doan_khoa.findUnique.mockResolvedValue(giaiDoan1);

      await expect(
        service.capNhatGiaiDoan('khoa-1', 'gd-1', {} as never, truong),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.giai_doan_khoa.update).not.toHaveBeenCalled();
    });

    it('giai đoạn không thuộc khóa trên URL -> NotFoundAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.giai_doan_khoa.findUnique.mockResolvedValue({
        ...giaiDoan1,
        khoa_id: 'khoa-khac',
      });

      await expect(
        service.capNhatGiaiDoan(
          'khoa-1',
          'gd-1',
          { ten_giai_doan: 'X' } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('capNhatLop', () => {
    const lop1 = {
      id: 'lop-1',
      khoa_id: 'khoa-1',
      loai_lop: 'truc_tiep',
      ten_lop: 'Lớp 1',
    };

    it('sửa thành công, không đổi loai_lop -> không có canh_bao', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1);
      prisma.lop_hoc.update.mockResolvedValue({
        ...lop1,
        ten_lop: 'Lớp 1 (sửa)',
      });

      const res = await service.capNhatLop(
        'khoa-1',
        'lop-1',
        { ten_lop: 'Lớp 1 (sửa)' } as never,
        truong,
      );

      expect(res).not.toHaveProperty('canh_bao');
    });

    it('đổi loai_lop khi lớp đang có đăng ký -> vẫn cho phép, kèm canh_bao', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1);
      // 3 đăng ký khác nhau đang được phân vào lớp (groupBy theo đăng ký).
      prisma.phan_lop_giai_doan.groupBy.mockResolvedValue([
        { dang_ky_hoc_id: 'dk-1' },
        { dang_ky_hoc_id: 'dk-2' },
        { dang_ky_hoc_id: 'dk-3' },
      ]);
      prisma.lop_hoc.update.mockResolvedValue({ ...lop1, loai_lop: 'zoom' });

      const res = await service.capNhatLop(
        'khoa-1',
        'lop-1',
        { loai_lop: 'zoom' } as never,
        truong,
      );

      expect(prisma.lop_hoc.update).toHaveBeenCalled();
      expect(res).toHaveProperty('canh_bao');
      expect((res as { canh_bao: string }).canh_bao).toContain('3');
    });

    it('body rỗng -> ValidationException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1);

      await expect(
        service.capNhatLop('khoa-1', 'lop-1', {} as never, truong),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.lop_hoc.update).not.toHaveBeenCalled();
    });

    it('lớp không thuộc khóa trên URL -> NotFoundAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.findUnique.mockResolvedValue({
        ...lop1,
        khoa_id: 'khoa-khac',
      });

      await expect(
        service.capNhatLop(
          'khoa-1',
          'lop-1',
          { ten_lop: 'X' } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('capNhatCum', () => {
    const cum1 = { id: 'cum-1', khoa_id: 'khoa-1', ten_cum: 'Cụm A' };

    it('sửa thành công', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue(cum1);
      prisma.cum_hoc_vien.update.mockResolvedValue({
        ...cum1,
        ten_cum: 'Cụm A (sửa)',
      });

      await service.capNhatCum(
        'khoa-1',
        'cum-1',
        { ten_cum: 'Cụm A (sửa)' } as never,
        truong,
      );

      expect(prisma.cum_hoc_vien.update).toHaveBeenCalledWith({
        where: { id: 'cum-1' },
        data: {
          ten_cum: 'Cụm A (sửa)',
          link_zalo: undefined,
          ghi_chu: undefined,
          trang_thai: undefined,
        },
      });
    });

    it('body rỗng -> ValidationException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue(cum1);

      await expect(
        service.capNhatCum('khoa-1', 'cum-1', {} as never, truong),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.cum_hoc_vien.update).not.toHaveBeenCalled();
    });

    it('cụm không thuộc khóa trên URL -> NotFoundAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({
        ...cum1,
        khoa_id: 'khoa-khac',
      });

      await expect(
        service.capNhatCum(
          'khoa-1',
          'cum-1',
          { ten_cum: 'X' } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('capNhatLichHoc', () => {
    const lop1ConKhoa = { id: 'lop-1', khoa_id: 'khoa-1', khoa: khoa1 };
    const lich1 = {
      id: 'lich-1',
      lop_id: 'lop-1',
      giai_doan_id: 'gd-1',
      buoi_so: 1,
      thoi_gian_bat_dau: new Date('2026-03-01T01:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-03-01T03:00:00Z'),
    };

    it('sửa thành công', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue(lich1);
      prisma.lich_hoc_lop.update.mockResolvedValue({
        ...lich1,
        dia_diem_hoac_link: 'Phòng B',
      });

      await service.capNhatLichHoc(
        'lop-1',
        'lich-1',
        { dia_diem_hoac_link: 'Phòng B' } as never,
        truong,
      );

      expect(prisma.lich_hoc_lop.update).toHaveBeenCalledWith({
        where: { id: 'lich-1' },
        data: {
          thoi_gian_bat_dau: undefined,
          thoi_gian_ket_thuc: undefined,
          dia_diem_hoac_link: 'Phòng B',
          buoi_so: undefined,
          trang_thai: undefined,
        },
      });
    });

    it('body rỗng -> ValidationException', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue(lich1);

      await expect(
        service.capNhatLichHoc('lop-1', 'lich-1', {} as never, truong),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.lich_hoc_lop.update).not.toHaveBeenCalled();
    });

    it('lịch không thuộc lớp trên URL -> NotFoundAppException', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue({
        ...lich1,
        lop_id: 'lop-khac',
      });

      await expect(
        service.capNhatLichHoc(
          'lop-1',
          'lich-1',
          { dia_diem_hoac_link: 'X' } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });

    it('thời gian kết thúc <= bắt đầu (sau khi hợp nhất với dữ liệu cũ) -> ValidationException', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue(lich1);

      await expect(
        service.capNhatLichHoc(
          'lop-1',
          'lich-1',
          { thoi_gian_ket_thuc: '2026-03-01T00:30:00Z' } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.lich_hoc_lop.update).not.toHaveBeenCalled();
    });
  });

  describe('nhật ký kết quả / phân lớp (2026-10-04)', () => {
    const gd2 = {
      id: 'gd-2',
      khoa_id: 'khoa-1',
      thu_tu: 2,
      ten_giai_doan: 'Zoom',
    };

    it('nhập kết quả đánh giá đổi mức -> ghi cũ → mới', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        muc_dau_vao: null,
        muc_dau_ra: null,
        khoa: { ten_khoa: 'Khóa A' },
      });
      await service.commitKetQuaDanhGia({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        loai: 'dau_vao',
        muc: 'co_ban',
      });
      expect(nhatKy.ghi).toHaveBeenCalledWith({
        hanh_dong: 'cap_nhat_muc_danh_gia',
        hoc_vien_id: 'hv-1',
        mo_ta: 'Khóa A — Đầu vào: (chưa có) → Cơ bản (nhập file)',
      });
    });

    it('nhập lại cùng mức -> không ghi (tránh log rác khi chạy lại file)', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        muc_dau_vao: 'co_ban',
        muc_dau_ra: null,
        khoa: { ten_khoa: 'Khóa A' },
      });
      await service.commitKetQuaDanhGia({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        loai: 'dau_vao',
        muc: 'co_ban',
      });
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });

    it('nhập file phân lớp đổi lớp -> ghi lớp cũ → lớp mới', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        cum_id: null,
        phan_lop_giai_doan: [
          {
            giai_doan_id: 'gd-2',
            lop_id: 'lop-cu',
            lop: { ten_lop: 'Lớp cũ' },
          },
        ],
      });
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.khoa_boi_duong.findUnique.mockResolvedValue({
        ten_khoa: 'Khóa A',
      });
      prisma.giai_doan_khoa.findMany.mockResolvedValue([gd2]);
      prisma.lop_hoc.findMany.mockResolvedValue([
        { id: 'lop-moi', ten_lop: 'Lớp mới' },
      ]);
      prisma.lop_hoc.count.mockResolvedValue(0);

      await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        gan: [{ giai_doan_id: 'gd-2', lop_id: 'lop-moi' }],
      });
      expect(nhatKy.ghi).toHaveBeenCalledWith({
        hanh_dong: 'phan_lop',
        hoc_vien_id: 'hv-1',
        mo_ta: 'Khóa A — GĐ2 "Zoom": Lớp cũ → Lớp mới (nhập file)',
      });
    });

    it('nhập file phân lớp không đổi gì -> không ghi', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        cum_id: 'cum-1',
        phan_lop_giai_doan: [
          {
            giai_doan_id: 'gd-2',
            lop_id: 'lop-cu',
            lop: { ten_lop: 'Lớp cũ' },
          },
        ],
      });
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.lop_hoc.count.mockResolvedValue(0);
      await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        cum_id: 'cum-1',
        gan: [{ giai_doan_id: 'gd-2', lop_id: 'lop-cu' }],
      });
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });

    it('gỡ lớp thủ công -> ghi lớp cũ → (gỡ lớp)', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        khoa: { ten_khoa: 'Khóa A' },
      });
      prisma.giai_doan_khoa.findUnique.mockResolvedValue(gd2);
      prisma.phan_lop_giai_doan.findUnique.mockResolvedValue({
        lop_id: 'lop-cu',
        lop: { ten_lop: 'Lớp cũ' },
      });

      await service.ganLopGiaiDoan('dk-1', 'gd-2', null, {} as never);
      expect(nhatKy.ghi).toHaveBeenCalledWith({
        hanh_dong: 'phan_lop',
        hoc_vien_id: 'hv-1',
        mo_ta: 'Khóa A — GĐ2 "Zoom": Lớp cũ → (gỡ lớp)',
      });
    });

    it('cập nhật kết quả khóa học -> ghi cũ → mới', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        hoc_vien_id: 'hv-1',
        ket_qua: 'dang_hoc',
        khoa: { ten_khoa: 'Khóa A', don_vi_dat_hang_id: null },
      });
      scopeService.canAccessDonVi.mockResolvedValue(true);
      prisma.dang_ky_hoc.update.mockResolvedValue({ ket_qua: 'dat' });
      (
        thongBaoService as unknown as Record<string, jest.Mock>
      ).guiDangKyHocKetQua = jest.fn();

      await service.capNhatKetQua('dk-1', { ket_qua: 'dat' }, {} as never);
      expect(nhatKy.ghi).toHaveBeenCalledWith({
        hanh_dong: 'cap_nhat_ket_qua_hoc',
        hoc_vien_id: 'hv-1',
        mo_ta: 'Khóa A: Đang học → Đạt',
      });
    });
  });
});
