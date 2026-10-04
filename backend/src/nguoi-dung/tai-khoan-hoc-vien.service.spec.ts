import { TaiKhoanHocVienService } from './tai-khoan-hoc-vien.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

describe('TaiKhoanHocVienService', () => {
  let service: TaiKhoanHocVienService;
  let prisma: {
    nguoi_dung: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const view = { id: 'nd-1', ten_dang_nhap: 'hv1', trang_thai: 'active' };

  beforeEach(() => {
    prisma = {
      nguoi_dung: {
        findMany: jest.fn().mockResolvedValue([view]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(view),
      },
    };
    service = new TaiKhoanHocVienService(prisma as unknown as PrismaService);
  });

  const findManyArgs = () => prisma.nguoi_dung.findMany.mock.calls[0][0];
  const updateArgs = () => prisma.nguoi_dung.update.mock.calls[0][0];

  describe('danhSach', () => {
    it('mặc định page=1, page_size=20, sắp created_at desc rồi id; trả {data,total,page,page_size}', async () => {
      const res = await service.danhSach({});
      expect(res).toEqual({ data: [view], total: 1, page: 1, page_size: 20 });
      const args = findManyArgs();
      expect(args.skip).toBe(0);
      expect(args.take).toBe(20);
      expect(args.orderBy).toEqual([{ created_at: 'desc' }, { id: 'asc' }]);
    });

    it('phân trang: page=3, page_size=10 -> skip 20', async () => {
      const res = await service.danhSach({ page: 3, page_size: 10 });
      expect(findManyArgs()).toMatchObject({ skip: 20, take: 10 });
      expect(res).toMatchObject({ page: 3, page_size: 10 });
    });

    it('page_size vượt 100 bị chặn về 100', async () => {
      const res = await service.danhSach({ page_size: 200 });
      expect(findManyArgs().take).toBe(100);
      expect(res.page_size).toBe(100);
    });

    it('chỉ lấy vai_tro hoc_vien; count dùng cùng where', async () => {
      await service.danhSach({});
      expect(findManyArgs().where).toEqual({ vai_tro: 'hoc_vien' });
      expect(prisma.nguoi_dung.count).toHaveBeenCalledWith({
        where: { vai_tro: 'hoc_vien' },
      });
    });

    it('select tường minh, không có mat_khau_hash', async () => {
      await service.danhSach({});
      const select = findManyArgs().select;
      expect(select).toBeDefined();
      expect(JSON.stringify(select)).not.toContain('mat_khau_hash');
      expect(select.hoc_vien.select.don_vi_cong_tac).toEqual({
        select: { id: true, ten_don_vi: true },
      });
    });

    it('lọc trang_thai', async () => {
      await service.danhSach({ trang_thai: 'ngung' });
      expect(findManyArgs().where).toEqual({
        vai_tro: 'hoc_vien',
        trang_thai: 'ngung',
      });
    });

    it('tinh_trang=tam_khoa -> khoa_den > now', async () => {
      const now = new Date('2026-10-04T08:00:00Z');
      await service.danhSach({ tinh_trang: 'tam_khoa' }, now);
      expect(findManyArgs().where).toEqual({
        vai_tro: 'hoc_vien',
        khoa_den: { gt: now },
      });
    });

    it('tinh_trang=chua_dang_nhap -> dang_nhap_lan_cuoi null', async () => {
      await service.danhSach({ tinh_trang: 'chua_dang_nhap' });
      expect(findManyArgs().where).toEqual({
        vai_tro: 'hoc_vien',
        dang_nhap_lan_cuoi: null,
      });
    });

    it('tinh_trang=phai_doi_mat_khau -> phai_doi_mat_khau true', async () => {
      await service.danhSach({ tinh_trang: 'phai_doi_mat_khau' });
      expect(findManyArgs().where).toEqual({
        vai_tro: 'hoc_vien',
        phai_doi_mat_khau: true,
      });
    });

    it('q được trim, OR theo tên đăng nhập/họ tên (insensitive), CCCD, SĐT', async () => {
      await service.danhSach({ q: '  0901  ' });
      expect(findManyArgs().where).toEqual({
        vai_tro: 'hoc_vien',
        OR: [
          { ten_dang_nhap: { contains: '0901', mode: 'insensitive' } },
          { hoc_vien: { ho_ten: { contains: '0901', mode: 'insensitive' } } },
          { hoc_vien: { so_dinh_danh_ca_nhan: { contains: '0901' } } },
          { hoc_vien: { so_dien_thoai_lien_he: { contains: '0901' } } },
        ],
      });
    });

    it('q chỉ có khoảng trắng -> bỏ qua', async () => {
      await service.danhSach({ q: '   ' });
      expect(findManyArgs().where).toEqual({ vai_tro: 'hoc_vien' });
    });

    it('kết hợp trang_thai + tinh_trang + q', async () => {
      await service.danhSach({
        trang_thai: 'active',
        tinh_trang: 'chua_dang_nhap',
        q: 'an',
      });
      const where = findManyArgs().where;
      expect(where).toMatchObject({
        vai_tro: 'hoc_vien',
        trang_thai: 'active',
        dang_nhap_lan_cuoi: null,
      });
      expect(where.OR).toHaveLength(4);
    });
  });

  describe('doiTrangThai', () => {
    it('khóa (ngung) -> chỉ đổi trang_thai, select không có mat_khau_hash', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'nd-1', vai_tro: 'hoc_vien' });
      const res = await service.doiTrangThai('nd-1', { trang_thai: 'ngung' });
      expect(res).toBe(view);
      expect(updateArgs().where).toEqual({ id: 'nd-1' });
      expect(updateArgs().data).toEqual({ trang_thai: 'ngung' });
      expect(JSON.stringify(updateArgs().select)).not.toContain('mat_khau_hash');
    });

    it('mở lại (active) -> reset so_lan_dang_nhap_sai và khoa_den', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'nd-1', vai_tro: 'hoc_vien' });
      await service.doiTrangThai('nd-1', { trang_thai: 'active' });
      expect(updateArgs().data).toEqual({
        trang_thai: 'active',
        so_lan_dang_nhap_sai: 0,
        khoa_den: null,
      });
    });

    it('không tìm thấy -> NotFoundAppException, không update', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue(null);
      await expect(
        service.doiTrangThai('x', { trang_thai: 'ngung' }),
      ).rejects.toBeInstanceOf(NotFoundAppException);
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });

    it('không phải học viên -> ValidationException (400), không update', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'nd-2', vai_tro: 'truong' });
      await expect(
        service.doiTrangThai('nd-2', { trang_thai: 'ngung' }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });
  });

  describe('moKhoaTam', () => {
    it('xóa khoa_den, reset bộ đếm, không đụng mật khẩu/trạng thái', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'nd-1', vai_tro: 'hoc_vien' });
      const res = await service.moKhoaTam('nd-1');
      expect(res).toBe(view);
      expect(updateArgs().data).toEqual({ khoa_den: null, so_lan_dang_nhap_sai: 0 });
      expect(JSON.stringify(updateArgs().select)).not.toContain('mat_khau_hash');
    });

    it('không tìm thấy -> NotFoundAppException', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue(null);
      await expect(service.moKhoaTam('x')).rejects.toBeInstanceOf(
        NotFoundAppException,
      );
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });

    it('không phải học viên -> ValidationException', async () => {
      prisma.nguoi_dung.findUnique.mockResolvedValue({ id: 'nd-2', vai_tro: 'quan_tri' });
      await expect(service.moKhoaTam('nd-2')).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(prisma.nguoi_dung.update).not.toHaveBeenCalled();
    });
  });
});
