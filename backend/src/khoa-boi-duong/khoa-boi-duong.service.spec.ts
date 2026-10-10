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
import { DiemHocService } from '../diem-hoc/diem-hoc.service';
import { LichHocThayDoiService } from './lich-hoc-thay-doi.service';
import { PhanCongGiangDayService } from '../giang-vien/phan-cong-giang-day.service';
import { ThangMucService } from '../sso/thang-muc.service';

let nhatKy: { ghi: jest.Mock };
let phanCongGiangDay: { xungDotKhiDoiGio: jest.Mock };
let diemHocService: {
  layDiemHocDangHoatDong: jest.Mock;
  canhBaoVuotSoPhong: jest.Mock;
};

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
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    lich_hoc_lop: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    hoc_vien: { findUnique: jest.Mock };
    diem_danh: { findMany: jest.Mock };
    ket_qua_giai_doan: { findMany: jest.Mock };
    nhan_su_thuc_dia: { findMany: jest.Mock };
    ket_qua_khao_sat: { findUnique: jest.Mock };
    cau_hinh_he_thong: { findUnique: jest.Mock };
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
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ id: 'gd-1', hinh_thuc: 'truc_tuyen' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      lich_hoc_lop: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'lich-moi',
          ...data,
        })),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      hoc_vien: { findUnique: jest.fn() },
      // T12 (mo-rong-nls-an-giang.md, 2026-09-30): khoaHocTheoHocVienId (dùng
      // bởi khoaHocCuaToi/khoaHocCuaHocVien) nay truy vấn thêm điểm danh/tiến
      // độ giai đoạn — mặc định rỗng, test nào cần dữ liệu cụ thể tự override.
      diem_danh: { findMany: jest.fn().mockResolvedValue([]) },
      ket_qua_giai_doan: { findMany: jest.fn().mockResolvedValue([]) },
      nhan_su_thuc_dia: { findMany: jest.fn().mockResolvedValue([]) },
      ket_qua_khao_sat: { findUnique: jest.fn().mockResolvedValue(null) },
      cau_hinh_he_thong: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    scopeService = { canAccessDonVi: jest.fn() };
    thongBaoService = {
      guiDangKyHocPhanLop: jest.fn().mockResolvedValue({ chuaCoEmail: false }),
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    phanCongGiangDay = {
      xungDotKhiDoiGio: jest.fn().mockResolvedValue(null),
    };
    diemHocService = {
      layDiemHocDangHoatDong: jest.fn().mockResolvedValue({ id: 'dh-1' }),
      canhBaoVuotSoPhong: jest.fn().mockResolvedValue([]),
    };
    service = new KhoaBoiDuongService(
      prisma as unknown as PrismaService,
      scopeService as unknown as ScopeService,
      thongBaoService as unknown as ThongBaoService,
      nhatKy as unknown as NhatKyService,
      diemHocService as unknown as DiemHocService,
      new LichHocThayDoiService(
        prisma as unknown as PrismaService,
        nhatKy as unknown as NhatKyService,
      ),
      phanCongGiangDay as unknown as PhanCongGiangDayService,
      new ThangMucService(prisma as unknown as PrismaService),
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
          {
            id: 'b-2',
            giai_doan_id: 'gd-2',
            phan_cong: [
              { vai_tro: 'giang_vien', giang_vien: { ho_ten: 'GV Một' } },
            ],
          },
          { id: 'b-3', giai_doan_id: 'gd-3', phan_cong: [] },
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
      // T11: buổi kèm giảng viên (chỉ họ tên + vai trò, không SĐT/email).
      expect(res[0].giai_doan[1].lop?.lich_hoc[0].giang_vien).toEqual([
        { ho_ten: 'GV Một', vai_tro: 'giang_vien' },
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

    it('nhân viên được gán lớp -> cảnh báo "hiện không tham gia tập huấn", không chặn', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) =>
        where.so_dinh_danh_ca_nhan === '123456789012'
          ? { ...hocVienDaDuyet, doi_tuong: 'nhan_vien' }
          : null,
      );
      prisma.lop_hoc.findMany.mockResolvedValue([
        {
          id: 'lop-zoom',
          ten_lop: 'Lớp Zoom',
          loai_lop: 'zoom',
          muc_nang_luc: null,
        },
      ]);
      const { dto, error, canhBao } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', 'gd:2': 'Lớp Zoom' },
        khoa,
      );
      expect(error).toBeUndefined();
      expect(dto).toBeDefined();
      expect(canhBao).toContain('là nhân viên — hiện không tham gia tập huấn');
    });

    it('nhân viên chỉ gỡ lớp ("-") -> KHÔNG cảnh báo', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) =>
        where.so_dinh_danh_ca_nhan === '123456789012'
          ? { ...hocVienDaDuyet, doi_tuong: 'nhan_vien' }
          : null,
      );
      const { canhBao } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', 'gd:2': '-' },
        khoa,
      );
      expect(canhBao).toBeUndefined();
    });

    it('giáo viên được gán lớp -> không có cảnh báo nhân viên', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) =>
        where.so_dinh_danh_ca_nhan === '123456789012'
          ? { ...hocVienDaDuyet, doi_tuong: 'giao_vien' }
          : null,
      );
      prisma.lop_hoc.findMany.mockResolvedValue([
        {
          id: 'lop-zoom',
          ten_lop: 'Lớp Zoom',
          loai_lop: 'zoom',
          muc_nang_luc: null,
        },
      ]);
      const { canhBao } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', 'gd:2': 'Lớp Zoom' },
        khoa,
      );
      expect(canhBao).toBeUndefined();
    });

    it('chưa chốt mức, có bài đánh giá M4 + tự chọn thanh_thao -> cảnh báo theo mức hiệu lực', async () => {
      prisma.lop_hoc.findMany.mockResolvedValue([
        {
          id: 'lop-zoom',
          ten_lop: 'Lớp Zoom',
          loai_lop: 'zoom',
          muc_nang_luc: 'nang_cao',
        },
      ]);
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        muc_dau_vao: null,
        muc_hoc_chon: 'thanh_thao',
      });
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue({
        trang_thai: 'hoan_thanh',
        muc: null,
        muc_goc: 'M4',
      });
      const { canhBao } = await service.resolvePhanLopRow(
        { so_dinh_danh_ca_nhan: '123456789012', 'gd:2': 'Lớp Zoom' },
        khoa,
      );
      expect(canhBao).toContain(
        '"thanh_thao" (học viên tự điều chỉnh từ "nang_cao")',
      );
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

    // Dòng "chỉ mã định danh" (mọi cột GĐ/ten_cum trống) là đúng nội dung các
    // dòng chưa điền trong Excel "Danh sách chia lớp" (2026-10-09) khi nhập
    // lại thẳng — trên học viên ĐÃ GHI DANH (dang_ky_hoc đã tồn tại) không
    // được đụng tới lớp/cụm hiện có, không ghi nhật ký, không gửi lại email.
    it('resolvePhanLopRow + commitPhanLop: dòng chỉ mã định danh trên học viên đã ghi danh -> không đổi gì, không nhật ký, không email', async () => {
      const { dto, error } = await service.resolvePhanLopRow(
        {
          so_dinh_danh_ca_nhan: '123456789012',
          'gd:2': '',
          'gd:3': '',
          ten_cum: '',
        },
        khoa,
      );
      expect(error).toBeUndefined();
      expect(dto).toEqual({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        cum_id: undefined,
        gan: [],
      });

      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        cum_id: 'cum-cu',
        phan_lop_giai_doan: [
          { giai_doan_id: 'gd-2', lop_id: 'lop-zoom', lop: { ten_lop: 'Lớp Zoom' } },
        ],
      });

      const res = await service.commitPhanLop(dto!);

      expect(prisma.dang_ky_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      );
      expect(prisma.phan_lop_giai_doan.upsert).not.toHaveBeenCalled();
      expect(prisma.phan_lop_giai_doan.deleteMany).not.toHaveBeenCalled();
      expect(nhatKy.ghi).not.toHaveBeenCalled();
      expect(thongBaoService.guiDangKyHocPhanLop).not.toHaveBeenCalled();
      expect(res).toEqual({ hocVienChuaCoEmail: false });
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

  // T10 (issue #2): cột ma_diem_hoc / phong của import lop_va_lich_hoc.
  describe('resolveLopVaLichHocRow — điểm học (T10)', () => {
    const khoaFull = { id: 'khoa-1', ma_khoa: 'K1' };
    const gdTrucTiep = {
      id: 'gd-2',
      khoa_id: 'khoa-1',
      thu_tu: 2,
      ten_giai_doan: 'Trực tiếp',
      hinh_thuc: 'truc_tiep',
      thoi_gian_bat_dau: new Date('2026-01-01T00:00:00Z'),
      thoi_gian_ket_thuc: new Date('2026-12-31T00:00:00Z'),
    };
    const dong = {
      ma_khoa: 'K1',
      ten_lop: 'Lớp 1',
      giai_doan_thu_tu: '2',
      buoi_so: '1',
      bat_dau: '01/03/2026 08:00',
      ket_thuc: '01/03/2026 10:00',
    };
    let diemHocMock: { findUnique: jest.Mock };

    beforeEach(() => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaFull);
      prisma.giai_doan_khoa.findUnique.mockResolvedValue(gdTrucTiep);
      prisma.lop_hoc.findUnique.mockResolvedValue(null);
      diemHocMock = { findUnique: jest.fn() };
      (prisma as unknown as { diem_hoc: typeof diemHocMock }).diem_hoc =
        diemHocMock;
    });

    it('buổi mới giai đoạn trực tiếp thiếu ma_diem_hoc → dòng lỗi', async () => {
      const { error } = await service.resolveLopVaLichHocRow(dong);
      expect(error).toContain('ma_diem_hoc');
    });

    it('buổi đã có điểm học, ô ma_diem_hoc trống → giữ (không lỗi)', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue({ id: 'lop-1' });
      prisma.lich_hoc_lop.findUnique.mockResolvedValue({ diem_hoc_id: 'dh-1' });
      const { dto, error } = await service.resolveLopVaLichHocRow(dong);
      expect(error).toBeUndefined();
      expect(dto?.diem_hoc_id).toBeUndefined();
    });

    it('ma_diem_hoc không tồn tại / đã ngưng → dòng lỗi', async () => {
      diemHocMock.findUnique.mockResolvedValueOnce({
        id: 'dh-1',
        trang_thai: 'ngung',
      });
      const { error } = await service.resolveLopVaLichHocRow({
        ...dong,
        ma_diem_hoc: 'AG-01',
      });
      expect(error).toContain('AG-01');
    });

    it('ma_diem_hoc hợp lệ + phong → dto có diem_hoc_id/phong, cảnh báo số phòng nối vào canhBao', async () => {
      diemHocMock.findUnique.mockResolvedValueOnce({
        id: 'dh-1',
        trang_thai: 'active',
      });
      diemHocService.canhBaoVuotSoPhong.mockResolvedValueOnce(['vượt phòng']);
      const { dto, error, canhBao } = await service.resolveLopVaLichHocRow({
        ...dong,
        ma_diem_hoc: 'AG-01',
        phong: ' P.101 ',
      });
      expect(error).toBeUndefined();
      expect(dto).toEqual(
        expect.objectContaining({ diem_hoc_id: 'dh-1', phong: 'P.101' }),
      );
      expect(canhBao).toContain('vượt phòng');
    });
  });

  describe('commitLopVaLichHoc — buổi đã tồn tại đi qua LichHocThayDoiService', () => {
    it('chạy lại y nguyên → không update, không ghi nhật ký', async () => {
      prisma.lop_hoc.upsert.mockResolvedValue({ id: 'lop-1' });
      const cu = {
        id: 'lich-1',
        lop_id: 'lop-1',
        giai_doan_id: 'gd-1',
        buoi_so: 1,
        thoi_gian_bat_dau: new Date('2026-03-01T08:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-03-01T10:00:00Z'),
        dia_diem_hoac_link: null,
        diem_hoc_id: 'dh-1',
        phong: null,
        trang_thai: 'chua_dien_ra',
        cap_nhat_luc: new Date('2026-01-01T00:00:00Z'),
      };
      prisma.lich_hoc_lop.findUnique.mockResolvedValue(cu);
      await service.commitLopVaLichHoc({
        khoa_id: 'khoa-1',
        ten_lop: 'Lớp 1',
        loai_lop: 'truc_tiep',
        giai_doan_id: 'gd-1',
        buoi_so: 1,
        thoi_gian_bat_dau: new Date('2026-03-01T08:00:00Z'),
        thoi_gian_ket_thuc: new Date('2026-03-01T10:00:00Z'),
      } as never);
      expect(prisma.lich_hoc_lop.update).not.toHaveBeenCalled();
      expect(nhatKy.ghi).not.toHaveBeenCalled();
    });
  });

  describe('commitLopVaLichHoc — upsert theo (khoa_id, loai_lop, ten_lop)', () => {
    it('upsert lop_hoc dùng đúng khóa unique 3 trường mới', async () => {
      prisma.lop_hoc.upsert.mockResolvedValue({ id: 'lop-1' });
      const lichHocLop = {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      };
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
        data: expect.objectContaining({
          dia_diem_hoac_link: 'Phòng B',
          cap_nhat_luc: expect.any(Date),
        }),
      });
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({ hanh_dong: 'sua_lich_hoc' }),
      );
    });

    // T10 (issue #2): buổi giai đoạn truc_tiep phải có điểm học.
    it('giai đoạn trực tiếp, buổi cũ chưa có điểm học, sửa giờ không kèm điểm học → 400', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue({
        ...lich1,
        diem_hoc_id: null,
      });
      prisma.giai_doan_khoa.findUniqueOrThrow.mockResolvedValue({
        id: 'gd-1',
        hinh_thuc: 'truc_tiep',
      });
      await expect(
        service.capNhatLichHoc(
          'lop-1',
          'lich-1',
          { thoi_gian_ket_thuc: '2026-03-01T04:00:00Z' } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.lich_hoc_lop.update).not.toHaveBeenCalled();
    });

    it('giai đoạn trực tiếp: gỡ điểm học (diem_hoc_id=null) → 400', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue({
        ...lich1,
        diem_hoc_id: 'dh-1',
      });
      prisma.giai_doan_khoa.findUniqueOrThrow.mockResolvedValue({
        id: 'gd-1',
        hinh_thuc: 'truc_tiep',
      });
      await expect(
        service.capNhatLichHoc(
          'lop-1',
          'lich-1',
          { diem_hoc_id: null } as never,
          truong,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('giai đoạn trực tiếp, buổi cũ chưa có điểm học: chỉ đổi trang_thai vẫn được', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue({
        ...lich1,
        diem_hoc_id: null,
        trang_thai: 'chua_dien_ra',
      });
      prisma.giai_doan_khoa.findUniqueOrThrow.mockResolvedValue({
        id: 'gd-1',
        hinh_thuc: 'truc_tiep',
      });
      prisma.lich_hoc_lop.update.mockResolvedValue({ ...lich1 });
      await service.capNhatLichHoc(
        'lop-1',
        'lich-1',
        { trang_thai: 'ket_thuc' } as never,
        truong,
      );
      expect(prisma.lich_hoc_lop.update).toHaveBeenCalled();
    });

    it('gán điểm học mới → kiểm tra đang hoạt động, trả kèm canh_bao số phòng', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue({
        ...lich1,
        diem_hoc_id: null,
      });
      prisma.giai_doan_khoa.findUniqueOrThrow.mockResolvedValue({
        id: 'gd-1',
        hinh_thuc: 'truc_tiep',
      });
      prisma.lich_hoc_lop.update.mockImplementation(({ data }) => ({
        ...lich1,
        ...data,
      }));
      diemHocService.canhBaoVuotSoPhong.mockResolvedValueOnce(['vượt phòng']);
      const kq = await service.capNhatLichHoc(
        'lop-1',
        'lich-1',
        { diem_hoc_id: 'dh-2', ly_do: 'Đổi trường' } as never,
        truong,
      );
      expect(diemHocService.layDiemHocDangHoatDong).toHaveBeenCalledWith(
        'dh-2',
      );
      expect(kq.canh_bao).toEqual(['vượt phòng']);
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({
          chi_tiet: expect.objectContaining({ ly_do: 'Đổi trường' }),
        }),
      );
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

    // 2026-10-09: chỉ giữ muc_hoc_chon khi vẫn thấp hơn ĐÚNG 1 mức so với mốc mới.
    it.each([
      ['co_ban', 'nang_cao', true], // thấp hơn 2 mức -> reset
      ['thanh_thao', 'thanh_thao', true], // bằng -> reset
      ['thanh_thao', 'co_ban', true], // cao hơn -> reset
      ['thanh_thao', 'nang_cao', false], // thấp hơn 1 mức -> giữ
      ['co_ban', 'thanh_thao', false], // thấp hơn 1 mức -> giữ
    ] as const)(
      'import đầu vào: muc_hoc_chon %s, mốc mới %s -> reset=%s',
      async (mucChon, mucMoi, reset) => {
        prisma.dang_ky_hoc.findUnique.mockResolvedValue({
          muc_dau_vao: null,
          muc_dau_ra: null,
          muc_hoc_chon: mucChon,
          khoa: { ten_khoa: 'Khóa A' },
        });
        await service.commitKetQuaDanhGia({
          hoc_vien_id: 'hv-1',
          khoa_id: 'khoa-1',
          loai: 'dau_vao',
          muc: mucMoi,
        });
        const data = prisma.dang_ky_hoc.update.mock.calls[0][0].data;
        expect(data.muc_dau_vao).toBe(mucMoi);
        if (reset) {
          expect(data).toMatchObject({
            muc_hoc_chon: null,
            muc_hoc_chon_luc: null,
          });
        } else {
          expect(data).not.toHaveProperty('muc_hoc_chon');
        }
      },
    );

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

  // 2026-10-09: chưa chốt muc_dau_vao -> mốc điều chỉnh lấy từ bài khảo sát đầu vào.
  describe('mức đánh giá làm mốc (muc_dau_vao ?? khảo sát)', () => {
    const dangKy = (
      muc_dau_vao: string | null,
      muc_hoc_chon: string | null = null,
    ) => ({
      id: 'dk-1',
      hoc_vien_id: 'hv-1',
      khoa_id: 'khoa-1',
      muc_dau_vao,
      muc_hoc_chon,
      muc_hoc_chon_luc: null,
      khoa: { ten_khoa: 'Khóa A' },
    });
    const bai = (trang_thai: string, muc_goc: string) => ({
      trang_thai,
      muc: null,
      muc_goc,
    });

    it('mucDanhGiaCuaDangKy: đã chốt -> không tra khảo sát', async () => {
      await expect(
        service.mucDanhGiaCuaDangKy({
          hoc_vien_id: 'hv-1',
          muc_dau_vao: 'co_ban',
        }),
      ).resolves.toEqual({ muc: 'co_ban', nguon: 'chot' });
      expect(prisma.ket_qua_khao_sat.findUnique).not.toHaveBeenCalled();
    });

    it('mucDanhGiaCuaDangKy: chưa chốt -> tra bài danh-gia của học viên', async () => {
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('hoan_thanh', 'M3'),
      );
      await expect(
        service.mucDanhGiaCuaDangKy({ hoc_vien_id: 'hv-1', muc_dau_vao: null }),
      ).resolves.toEqual({ muc: 'thanh_thao', nguon: 'khao_sat' });
      expect(prisma.ket_qua_khao_sat.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            hoc_vien_id_loai: { hoc_vien_id: 'hv-1', loai: 'danh-gia' },
          },
        }),
      );
    });

    it('chưa chốt + khảo sát M4 -> chọn thanh_thao được, ghi nhật ký theo mốc', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy(null));
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('hoan_thanh', 'M4'),
      );
      const res = await service.capNhatMucHocDangKy('dk-1', 'thanh_thao');
      expect(res).toMatchObject({
        muc_hoc_chon: 'thanh_thao',
        muc_hoc: 'thanh_thao',
      });
      expect(nhatKy.ghi).toHaveBeenCalledWith(
        expect.objectContaining({
          mo_ta: 'Khóa A: Nâng cao → Thành thạo',
          chi_tiet: {
            khoa_id: 'khoa-1',
            muc_cu: 'nang_cao',
            muc_moi: 'thanh_thao',
          },
        }),
      );
    });

    it('chưa chốt + chọn bằng mốc khảo sát -> lưu NULL', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy(null, 'co_ban'));
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('hoan_thanh', 'M4'),
      );
      const res = await service.capNhatMucHocDangKy('dk-1', 'nang_cao');
      expect(res.muc_hoc_chon).toBeNull();
      expect(prisma.dang_ky_hoc.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ muc_hoc_chon: null }),
        }),
      );
    });

    it('khảo sát M3 + chọn nang_cao -> ValidationException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy(null));
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('hoan_thanh', 'M3'),
      );
      await expect(
        service.capNhatMucHocDangKy('dk-1', 'nang_cao'),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('bài chưa hoàn thành -> "Chưa có kết quả đánh giá đầu vào"', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy(null));
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('dang_lam', 'M4'),
      );
      await expect(
        service.capNhatMucHocDangKy('dk-1', 'co_ban'),
      ).rejects.toMatchObject({
        response: {
          error: { message: 'Chưa có kết quả đánh giá đầu vào' },
        },
      });
    });

    it('khoaHocCuaToi trả muc_danh_gia + nguon_muc_danh_gia', async () => {
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        {
          id: 'dk-1',
          hoc_vien_id: 'hv-1',
          muc_dau_vao: null,
          khoa: { id: 'khoa-1', giai_doan: [] },
          cum: null,
          phan_lop_giai_doan: [],
        },
        {
          id: 'dk-2',
          hoc_vien_id: 'hv-1',
          muc_dau_vao: 'co_ban',
          khoa: { id: 'khoa-2', giai_doan: [] },
          cum: null,
          phan_lop_giai_doan: [],
        },
      ]);
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('hoan_thanh', 'M4'),
      );
      const res = await service.khoaHocCuaToi({
        ...truong,
        vai_tro: 'hoc_vien',
        hoc_vien_id: 'hv-1',
      });
      expect(res.map((r) => [r.muc_danh_gia, r.nguon_muc_danh_gia])).toEqual([
        ['nang_cao', 'khao_sat'],
        ['co_ban', 'chot'],
      ]);
      expect(prisma.ket_qua_khao_sat.findUnique).toHaveBeenCalledTimes(1);
      // Mã/nhãn gốc chỉ trả khi mốc lấy từ khảo sát.
      expect(res[0]).toMatchObject({
        muc_goc_danh_gia: 'M4',
        nhan_muc_goc_danh_gia: 'M4 – Nâng cao',
      });
      expect(res[1]).toMatchObject({
        muc_goc_danh_gia: null,
        nhan_muc_goc_danh_gia: null,
      });
    });

    it('khảo sát M1: xếp lớp co_ban nhưng giữ mã/nhãn "M1 – Chưa đạt" theo thang cấu hình', async () => {
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        {
          id: 'dk-1',
          hoc_vien_id: 'hv-1',
          muc_dau_vao: null,
          khoa: { id: 'khoa-1', giai_doan: [] },
          cum: null,
          phan_lop_giai_doan: [],
        },
      ]);
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        bai('hoan_thanh', 'M1'),
      );
      const res = await service.khoaHocCuaToi({
        ...truong,
        vai_tro: 'hoc_vien',
        hoc_vien_id: 'hv-1',
      });
      expect(res[0]).toMatchObject({
        muc_danh_gia: 'co_ban',
        nguon_muc_danh_gia: 'khao_sat',
        muc_goc_danh_gia: 'M1',
        nhan_muc_goc_danh_gia: 'M1 – Chưa đạt',
      });
    });
  });
});
