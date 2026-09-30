import { KhoaBoiDuongService } from './khoa-boi-duong.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

// QĐ10 (mo-rong-nls-an-giang.md, 2026-09-30): test cho phần tách 3 loại lớp
// độc lập (dang_ky_hoc_lop) + cụm học viên (cum_hoc_vien) trong
// KhoaBoiDuongService. File spec MỚI hoàn toàn — service này trước đó chưa
// có unit test riêng (chỉ có e2e), theo đúng pattern mock Prisma của
// hoc-vien.service.spec.ts/thong-bao.service.spec.ts (object jest.fn() thô,
// không dùng @nestjs/testing).
describe('KhoaBoiDuongService', () => {
  let service: KhoaBoiDuongService;
  let prisma: {
    khoa_boi_duong: { findUnique: jest.Mock };
    lop_hoc: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      upsert: jest.Mock;
    };
    cum_hoc_vien: {
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
    dang_ky_hoc_lop: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
    };
    giai_doan_khoa: { findUnique: jest.Mock; update: jest.Mock };
    lich_hoc_lop: { findUnique: jest.Mock; update: jest.Mock };
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
  const truongKhac: AuthenticatedUser = {
    ...truong,
    id: 'nd-truong-2',
    don_vi_id: 'dv-truong-khac',
  };
  const quanTri: AuthenticatedUser = {
    ...truong,
    id: 'nd-qt-1',
    vai_tro: 'quan_tri',
    don_vi_id: null,
  };

  const khoa1 = { id: 'khoa-1', don_vi_to_chuc_id: 'dv-truong-1' };

  beforeEach(() => {
    prisma = {
      khoa_boi_duong: { findUnique: jest.fn() },
      lop_hoc: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      cum_hoc_vien: {
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
      dang_ky_hoc_lop: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      giai_doan_khoa: { findUnique: jest.fn(), update: jest.fn() },
      lich_hoc_lop: { findUnique: jest.fn(), update: jest.fn() },
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
    service = new KhoaBoiDuongService(
      prisma as unknown as PrismaService,
      scopeService as unknown as ScopeService,
      thongBaoService as unknown as ThongBaoService,
    );
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

    it('không phải chủ khóa -> ForbiddenAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      await expect(
        service.themLop(
          'khoa-1',
          { loai_lop: 'truc_tiep', ten_lop: 'Lớp 1' } as never,
          truongKhac,
        ),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('quan_tri tạo lớp thay cho bất kỳ khóa nào (superuser override)', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.create.mockResolvedValue({ id: 'lop-1' });

      await service.themLop(
        'khoa-1',
        { loai_lop: 'vle', ten_lop: 'Lớp VLE 1' } as never,
        quanTri,
      );

      expect(prisma.lop_hoc.create).toHaveBeenCalled();
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

  describe('capNhatLopDangKy', () => {
    const dangKy1 = {
      id: 'dk-1',
      khoa_id: 'khoa-1',
      trang_thai: 'da_duyet',
      khoa: khoa1,
    };

    it('lop hợp lệ (đúng khóa + đúng loai_lop) -> upsert dang_ky_hoc_lop + chuyển trang_thai da_phan_lop', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.lop_hoc.findUnique.mockResolvedValue({
        id: 'lop-1',
        khoa_id: 'khoa-1',
        loai_lop: 'zoom',
      });
      prisma.dang_ky_hoc_lop.upsert.mockResolvedValue({
        id: 'dkl-1',
        loai_lop: 'zoom',
        lop_id: 'lop-1',
      });

      await service.capNhatLopDangKy(
        'dk-1',
        { loai_lop: 'zoom', lop_id: 'lop-1' },
        truong,
      );

      expect(prisma.dang_ky_hoc_lop.upsert).toHaveBeenCalledWith({
        where: {
          dang_ky_hoc_id_loai_lop: { dang_ky_hoc_id: 'dk-1', loai_lop: 'zoom' },
        },
        create: { dang_ky_hoc_id: 'dk-1', lop_id: 'lop-1', loai_lop: 'zoom' },
        update: { lop_id: 'lop-1' },
      });
      expect(prisma.dang_ky_hoc.update).toHaveBeenCalledWith({
        where: { id: 'dk-1' },
        data: { trang_thai: 'da_phan_lop' },
      });
    });

    it('đã da_phan_lop từ trước -> không update lại trang_thai', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        ...dangKy1,
        trang_thai: 'da_phan_lop',
      });
      prisma.lop_hoc.findUnique.mockResolvedValue({
        id: 'lop-1',
        khoa_id: 'khoa-1',
        loai_lop: 'truc_tiep',
      });
      prisma.dang_ky_hoc_lop.upsert.mockResolvedValue({});

      await service.capNhatLopDangKy(
        'dk-1',
        { loai_lop: 'truc_tiep', lop_id: 'lop-1' },
        truong,
      );

      expect(prisma.dang_ky_hoc.update).not.toHaveBeenCalled();
    });

    it('lop thuộc khóa khác -> ValidationException, không upsert', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.lop_hoc.findUnique.mockResolvedValue({
        id: 'lop-x',
        khoa_id: 'khoa-khac',
        loai_lop: 'zoom',
      });

      await expect(
        service.capNhatLopDangKy(
          'dk-1',
          { loai_lop: 'zoom', lop_id: 'lop-x' },
          truong,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.dang_ky_hoc_lop.upsert).not.toHaveBeenCalled();
    });

    it('loai_lop không khớp lop_hoc.loai_lop thực tế -> ValidationException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.lop_hoc.findUnique.mockResolvedValue({
        id: 'lop-1',
        khoa_id: 'khoa-1',
        loai_lop: 'vle',
      });

      await expect(
        service.capNhatLopDangKy(
          'dk-1',
          { loai_lop: 'zoom', lop_id: 'lop-1' },
          truong,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('lop_id không tồn tại -> ValidationException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.lop_hoc.findUnique.mockResolvedValue(null);

      await expect(
        service.capNhatLopDangKy(
          'dk-1',
          { loai_lop: 'zoom', lop_id: 'khong-ton-tai' },
          truong,
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('không phải chủ khóa -> ForbiddenAppException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      await expect(
        service.capNhatLopDangKy(
          'dk-1',
          { loai_lop: 'zoom', lop_id: 'lop-1' },
          truongKhac,
        ),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('không tìm thấy đăng ký học -> NotFoundAppException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(null);
      await expect(
        service.capNhatLopDangKy(
          'dk-x',
          { loai_lop: 'zoom', lop_id: 'lop-1' },
          truong,
        ),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('xoaLopDangKy', () => {
    it('xóa thành công', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        khoa_id: 'khoa-1',
        khoa: khoa1,
      });
      prisma.dang_ky_hoc_lop.deleteMany.mockResolvedValue({ count: 1 });

      const res = await service.xoaLopDangKy('dk-1', 'zoom', truong);

      expect(prisma.dang_ky_hoc_lop.deleteMany).toHaveBeenCalledWith({
        where: { dang_ky_hoc_id: 'dk-1', loai_lop: 'zoom' },
      });
      expect(res).toEqual({ da_xoa: true });
    });

    it('chưa gán lớp loại này -> NotFoundAppException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue({
        id: 'dk-1',
        khoa_id: 'khoa-1',
        khoa: khoa1,
      });
      prisma.dang_ky_hoc_lop.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.xoaLopDangKy('dk-1', 'vle', truong),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('capNhatCumDangKy', () => {
    const dangKy1 = { id: 'dk-1', khoa_id: 'khoa-1', khoa: khoa1 };

    it('gán cụm hợp lệ (cùng khóa)', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({
        id: 'cum-1',
        khoa_id: 'khoa-1',
      });
      prisma.dang_ky_hoc.update.mockResolvedValue({});

      await service.capNhatCumDangKy('dk-1', { cum_id: 'cum-1' }, truong);

      expect(prisma.dang_ky_hoc.update).toHaveBeenCalledWith({
        where: { id: 'dk-1' },
        data: { cum_id: 'cum-1' },
      });
    });

    it('cum_id=null -> gỡ gán cụm', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.dang_ky_hoc.update.mockResolvedValue({});

      await service.capNhatCumDangKy('dk-1', { cum_id: null }, truong);

      expect(prisma.cum_hoc_vien.findUnique).not.toHaveBeenCalled();
      expect(prisma.dang_ky_hoc.update).toHaveBeenCalledWith({
        where: { id: 'dk-1' },
        data: { cum_id: null },
      });
    });

    it('cụm thuộc khóa khác -> ValidationException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({
        id: 'cum-x',
        khoa_id: 'khoa-khac',
      });

      await expect(
        service.capNhatCumDangKy('dk-1', { cum_id: 'cum-x' }, truong),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('cum_id không tồn tại -> ValidationException', async () => {
      prisma.dang_ky_hoc.findUnique.mockResolvedValue(dangKy1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue(null);

      await expect(
        service.capNhatCumDangKy('dk-1', { cum_id: 'khong-ton-tai' }, truong),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('khoaHocCuaToi', () => {
    it('tách dang_ky_hoc_lop thành lop_truc_tiep/lop_zoom/lop_vle + cum', async () => {
      const lopTT = { id: 'lop-tt', ten_lop: 'Lớp TT' };
      const lopZoom = { id: 'lop-zoom', ten_lop: 'Lớp Zoom' };
      prisma.dang_ky_hoc.findMany.mockResolvedValue([
        {
          id: 'dk-1',
          hoc_vien_id: 'hv-1',
          khoa: { id: 'khoa-1' },
          cum: { id: 'cum-1', ten_cum: 'Cụm A' },
          dang_ky_hoc_lop: [
            { loai_lop: 'truc_tiep', lop: lopTT },
            { loai_lop: 'zoom', lop: lopZoom },
          ],
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
        lop_truc_tiep: lopTT,
        lop_zoom: lopZoom,
        lop_vle: null,
        cum: { id: 'cum-1', ten_cum: 'Cụm A' },
      });
      // dang_ky_hoc_lop (mảng nội bộ) không nên lọt ra response cuối.
      expect(res[0]).not.toHaveProperty('dang_ky_hoc_lop');
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
          khoa: { id: 'khoa-1' },
          cum: null,
          dang_ky_hoc_lop: [{ loai_lop: 'truc_tiep', lop: lopTT }],
        },
      ]);

      const res = await service.khoaHocCuaHocVien('hv-1', truong);

      expect(scopeService.canAccessDonVi).toHaveBeenCalledWith(
        truong,
        'dv-truong-1',
      );
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({
        id: 'dk-1',
        lop_truc_tiep: lopTT,
        lop_zoom: null,
        lop_vle: null,
        cum: null,
      });
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

  describe('resolvePhanLopRow + commitPhanLop', () => {
    const hocVienDaDuyet = { id: 'hv-1', trang_thai: 'da_duyet' };
    const khoaFull = { id: 'khoa-1', ma_khoa: 'K1' };

    beforeEach(() => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) => {
        if (where.so_dinh_danh_ca_nhan === '123456789012')
          return hocVienDaDuyet;
        return null;
      });
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoaFull);
    });

    it('resolve cả 3 loại lớp + cụm cùng lúc', async () => {
      prisma.lop_hoc.findUnique.mockImplementation(({ where }) => {
        const k = where.khoa_id_loai_lop_ten_lop;
        if (k.loai_lop === 'truc_tiep' && k.ten_lop === 'Lớp TT')
          return { id: 'lop-tt', muc_nang_luc: null };
        if (k.loai_lop === 'zoom' && k.ten_lop === 'Lớp Zoom')
          return { id: 'lop-zoom', muc_nang_luc: null };
        if (k.loai_lop === 'vle' && k.ten_lop === 'Lớp VLE')
          return { id: 'lop-vle', muc_nang_luc: null };
        return null;
      });
      prisma.cum_hoc_vien.findUnique.mockResolvedValue({ id: 'cum-1' });

      const { dto, error } = await service.resolvePhanLopRow({
        so_dinh_danh_ca_nhan: '123456789012',
        ma_khoa: 'K1',
        ten_lop: 'Lớp TT',
        ten_lop_zoom: 'Lớp Zoom',
        ten_lop_vle: 'Lớp VLE',
        ten_cum: 'Cụm A',
      });

      expect(error).toBeUndefined();
      expect(dto).toEqual({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        lop_truc_tiep_id: 'lop-tt',
        lop_zoom_id: 'lop-zoom',
        lop_vle_id: 'lop-vle',
        cum_id: 'cum-1',
      });
    });

    it('không tìm thấy lớp zoom -> lỗi rõ ràng, không lẫn với lớp trực tiếp', async () => {
      prisma.lop_hoc.findUnique.mockImplementation(({ where }) => {
        const k = where.khoa_id_loai_lop_ten_lop;
        if (k.loai_lop === 'truc_tiep') return { id: 'lop-tt' };
        return null;
      });

      const { error, dto } = await service.resolvePhanLopRow({
        so_dinh_danh_ca_nhan: '123456789012',
        ma_khoa: 'K1',
        ten_lop: 'Lớp TT',
        ten_lop_zoom: 'Lớp Zoom Không Tồn Tại',
      });

      expect(dto).toBeUndefined();
      expect(error).toContain('Zoom');
    });

    it('không tìm thấy cụm -> lỗi rõ ràng', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(null);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue(null);

      const { error } = await service.resolvePhanLopRow({
        so_dinh_danh_ca_nhan: '123456789012',
        ma_khoa: 'K1',
        ten_cum: 'Cụm Không Tồn Tại',
      });

      expect(error).toContain('cụm học viên');
    });

    it('commitPhanLop: gán cả truc_tiep + zoom -> upsert dang_ky_hoc_lop 2 lần, trang_thai da_phan_lop, gửi email (chỉ vì có truc_tiep)', async () => {
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.dang_ky_hoc_lop.upsert.mockResolvedValue({});

      const res = await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        lop_truc_tiep_id: 'lop-tt',
        lop_zoom_id: 'lop-zoom',
      });

      expect(prisma.dang_ky_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ trang_thai: 'da_phan_lop' }),
        }),
      );
      expect(prisma.dang_ky_hoc_lop.upsert).toHaveBeenCalledTimes(2);
      expect(thongBaoService.guiDangKyHocPhanLop).toHaveBeenCalledWith('dk-1');
      expect(res).toEqual({ hocVienChuaCoEmail: false });
    });

    it('commitPhanLop: chỉ gán cụm (không lớp nào) -> không gọi dang_ky_hoc_lop.upsert, không gửi email, trang_thai mặc định da_duyet', async () => {
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });

      const res = await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        cum_id: 'cum-1',
      });

      expect(prisma.dang_ky_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            trang_thai: 'da_duyet',
            cum_id: 'cum-1',
          }),
        }),
      );
      expect(prisma.dang_ky_hoc_lop.upsert).not.toHaveBeenCalled();
      expect(thongBaoService.guiDangKyHocPhanLop).not.toHaveBeenCalled();
      expect(res).toEqual({ hocVienChuaCoEmail: false });
    });

    it('commitPhanLop: chỉ gán zoom (không truc_tiep) -> vẫn da_phan_lop nhưng KHÔNG gửi email', async () => {
      prisma.dang_ky_hoc.upsert.mockResolvedValue({ id: 'dk-1' });
      prisma.dang_ky_hoc_lop.upsert.mockResolvedValue({});

      const res = await service.commitPhanLop({
        hoc_vien_id: 'hv-1',
        khoa_id: 'khoa-1',
        lop_zoom_id: 'lop-zoom',
      });

      expect(prisma.dang_ky_hoc.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ trang_thai: 'da_phan_lop' }),
        }),
      );
      expect(thongBaoService.guiDangKyHocPhanLop).not.toHaveBeenCalled();
      expect(res).toEqual({ hocVienChuaCoEmail: false });
    });
  });

  describe('resolveLopVaLichHocRow — loai_lop (QĐ10)', () => {
    const khoaFull = { id: 'khoa-1', ma_khoa: 'K1' };
    const giaiDoan1 = { id: 'gd-1', khoa_id: 'khoa-1', thu_tu: 1 };

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

    it('không phải chủ khóa -> ForbiddenAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.giai_doan_khoa.findUnique.mockResolvedValue(giaiDoan1);

      await expect(
        service.capNhatGiaiDoan(
          'khoa-1',
          'gd-1',
          { ten_giai_doan: 'X' } as never,
          truongKhac,
        ),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
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
      prisma.dang_ky_hoc_lop.count.mockResolvedValue(3);
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

    it('không phải chủ khóa -> ForbiddenAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1);

      await expect(
        service.capNhatLop(
          'khoa-1',
          'lop-1',
          { ten_lop: 'X' } as never,
          truongKhac,
        ),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
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

    it('không phải chủ khóa -> ForbiddenAppException', async () => {
      prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa1);
      prisma.cum_hoc_vien.findUnique.mockResolvedValue(cum1);

      await expect(
        service.capNhatCum(
          'khoa-1',
          'cum-1',
          { ten_cum: 'X' } as never,
          truongKhac,
        ),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
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

    it('không phải chủ khóa -> ForbiddenAppException', async () => {
      prisma.lop_hoc.findUnique.mockResolvedValue(lop1ConKhoa);
      prisma.lich_hoc_lop.findUnique.mockResolvedValue(lich1);

      await expect(
        service.capNhatLichHoc(
          'lop-1',
          'lich-1',
          { dia_diem_hoac_link: 'X' } as never,
          truongKhac,
        ),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
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
});
