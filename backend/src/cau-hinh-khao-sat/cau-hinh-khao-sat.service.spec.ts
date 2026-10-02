import {
  CauHinhKhaoSatService,
  KHOA_CAU_HINH_KHAO_SAT,
} from './cau-hinh-khao-sat.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { CauHinhKhaoSatDto } from './dto/cau-hinh-khao-sat.dto';

describe('CauHinhKhaoSatService', () => {
  let service: CauHinhKhaoSatService;
  let prisma: {
    cau_hinh_he_thong: { findUnique: jest.Mock; upsert: jest.Mock };
    cau_hinh_khao_sat_khoa: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    dang_ky_hoc: { findFirst: jest.Mock };
    khoa_boi_duong: { findUnique: jest.Mock };
    dia_danh: { findUnique: jest.Mock };
  };

  const hopLe = (): CauHinhKhaoSatDto => ({
    che_do_hoc_vien: 'khao_sat',
    danh_gia_dau_vao_trong_cong: false,
    hien_khao_sat: true,
    kenh_danh_gia: 'vle',
    phieu: [
      {
        ten: '  Phiếu khảo sát kĩ năng số ',
        mo_ta: 'Mô tả',
        lien_ket: [{ nhan: 'Mở phiếu', url: ' https://forms.gle/abc ' }],
      },
    ],
  });

  beforeEach(() => {
    prisma = {
      cau_hinh_he_thong: { findUnique: jest.fn(), upsert: jest.fn() },
      cau_hinh_khao_sat_khoa: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      // Mặc định học viên chưa ghi danh khóa nào có cấu hình riêng -> cấu hình chung.
      dang_ky_hoc: { findFirst: jest.fn().mockResolvedValue(null) },
      khoa_boi_duong: { findUnique: jest.fn() },
      dia_danh: { findUnique: jest.fn() },
    };
    service = new CauHinhKhaoSatService(prisma as unknown as PrismaService);
  });

  describe('layCauHinh', () => {
    it('chưa lưu lần nào -> cau_hinh null (frontend dùng mặc định)', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue(null);
      await expect(service.layCauHinh()).resolves.toEqual({
        cau_hinh: null,
        cap_nhat_luc: null,
        pham_vi: { loai: 'chung' },
      });
      expect(prisma.cau_hinh_he_thong.findUnique).toHaveBeenCalledWith({
        where: { khoa: KHOA_CAU_HINH_KHAO_SAT },
      });
    });

    it('đã lưu -> trả gia_tri + cap_nhat_luc', async () => {
      const luc = new Date('2026-10-02T03:00:00.000Z');
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        khoa: KHOA_CAU_HINH_KHAO_SAT,
        gia_tri: { che_do_hoc_vien: 'dang_nhap' },
        cap_nhat_luc: luc,
      });
      const kq = await service.layCauHinh();
      expect(kq.cau_hinh).toEqual({ che_do_hoc_vien: 'dang_nhap' });
      expect(kq.cap_nhat_luc).toBe(luc);
    });
  });

  describe('layKenhDanhGia', () => {
    it('chưa lưu cấu hình -> vle (giữ hành vi cũ)', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue(null);
      await expect(service.layKenhDanhGia('hv-1')).resolves.toBe('vle');
    });

    it('cấu hình lưu trước khi có trường kenh_danh_gia -> vle', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { che_do_hoc_vien: 'dang_nhap' },
        cap_nhat_luc: new Date(),
      });
      await expect(service.layKenhDanhGia('hv-1')).resolves.toBe('vle');
    });

    it('đã chọn sso -> sso', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { kenh_danh_gia: 'sso' },
        cap_nhat_luc: new Date(),
      });
      await expect(service.layKenhDanhGia('hv-1')).resolves.toBe('sso');
    });
  });

  describe('khaoSatDauRaDangMo', () => {
    it('chưa lưu / cấu hình cũ không có cờ -> chưa mở', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue(null);
      await expect(service.khaoSatDauRaDangMo('hv-1')).resolves.toBe(false);
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { kenh_danh_gia: 'sso' },
        cap_nhat_luc: new Date(),
      });
      await expect(service.khaoSatDauRaDangMo('hv-1')).resolves.toBe(false);
    });

    it('đã bật -> mở', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { khao_sat_dau_ra_mo: true },
        cap_nhat_luc: new Date(),
      });
      await expect(service.khaoSatDauRaDangMo('hv-1')).resolves.toBe(true);
    });
  });

  describe('luuCauHinh', () => {
    it('không gửi khao_sat_dau_ra_mo -> lưu false; gửi true -> lưu true', async () => {
      prisma.cau_hinh_he_thong.upsert.mockResolvedValue({
        cap_nhat_luc: new Date(),
      });
      await service.luuCauHinh(hopLe(), 'qt-1');
      expect(
        prisma.cau_hinh_he_thong.upsert.mock.calls[0][0].update.gia_tri
          .khao_sat_dau_ra_mo,
      ).toBe(false);

      await service.luuCauHinh(
        { ...hopLe(), khao_sat_dau_ra_mo: true },
        'qt-1',
      );
      expect(
        prisma.cau_hinh_he_thong.upsert.mock.calls[1][0].update.gia_tri
          .khao_sat_dau_ra_mo,
      ).toBe(true);
    });

    it('hợp lệ -> upsert theo khóa, trim chuỗi, ghi người cập nhật', async () => {
      const luc = new Date();
      prisma.cau_hinh_he_thong.upsert.mockResolvedValue({ cap_nhat_luc: luc });

      const kq = await service.luuCauHinh(hopLe(), 'qt-1');

      const arg = prisma.cau_hinh_he_thong.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ khoa: KHOA_CAU_HINH_KHAO_SAT });
      expect(arg.create.cap_nhat_boi).toBe('qt-1');
      expect(arg.update.cap_nhat_boi).toBe('qt-1');
      expect(arg.update.gia_tri.phieu[0]).toEqual({
        ten: 'Phiếu khảo sát kĩ năng số',
        mo_ta: 'Mô tả',
        lien_ket: [{ nhan: 'Mở phiếu', url: 'https://forms.gle/abc' }],
      });
      expect(kq.cau_hinh?.che_do_hoc_vien).toBe('khao_sat');
      expect(kq.cap_nhat_luc).toBe(luc);
    });

    it('giữ đúng thứ tự phiếu (thứ tự làm tuần tự)', async () => {
      prisma.cau_hinh_he_thong.upsert.mockResolvedValue({
        cap_nhat_luc: new Date(),
      });
      const dto = hopLe();
      dto.phieu.push({
        ten: 'Phiếu 2',
        mo_ta: '',
        lien_ket: [{ nhan: 'Mở', url: '' }],
      });
      const kq = await service.luuCauHinh(dto, 'qt-1');
      expect(kq.cau_hinh?.phieu.map((p) => p.ten)).toEqual([
        'Phiếu khảo sát kĩ năng số',
        'Phiếu 2',
      ]);
    });

    it('chế độ khao_sat nhưng tắt khối khảo sát -> ValidationException, không ghi', async () => {
      const dto = { ...hopLe(), hien_khao_sat: false };
      await expect(service.luuCauHinh(dto, 'qt-1')).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(prisma.cau_hinh_he_thong.upsert).not.toHaveBeenCalled();
    });

    it('bật khối khảo sát mà không có phiếu -> ValidationException', async () => {
      const dto = {
        ...hopLe(),
        che_do_hoc_vien: 'dang_nhap' as const,
        phieu: [],
      };
      await expect(service.luuCauHinh(dto, 'qt-1')).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('chế độ dang_nhap + tắt khảo sát + không phiếu -> hợp lệ', async () => {
      prisma.cau_hinh_he_thong.upsert.mockResolvedValue({
        cap_nhat_luc: new Date(),
      });
      const dto: CauHinhKhaoSatDto = {
        che_do_hoc_vien: 'dang_nhap',
        danh_gia_dau_vao_trong_cong: true,
        hien_khao_sat: false,
        kenh_danh_gia: 'sso',
        phieu: [],
      };
      await expect(service.luuCauHinh(dto, 'qt-1')).resolves.toMatchObject({
        cau_hinh: dto,
      });
    });
  });

  describe('cấu hình theo khóa (2026-10-02)', () => {
    const khoa = {
      id: 'k-ag',
      ma_khoa: '2026-AG-NLS',
      ten_khoa: 'NLS An Giang',
    };
    const rowKhoa = (gia_tri: object) => ({
      khoa_id: 'k-ag',
      tinh_id: 't-ag',
      gia_tri,
      cap_nhat_luc: new Date('2026-10-02T03:00:00.000Z'),
      khoa,
      tinh: { id: 't-ag', ten: 'An Giang' },
    });

    describe('layChoHocVien', () => {
      it('đã ghi danh khóa có cấu hình riêng -> dùng cấu hình khóa, kèm phạm vi', async () => {
        prisma.dang_ky_hoc.findFirst.mockResolvedValue({ khoa_id: 'k-ag' });
        prisma.cau_hinh_khao_sat_khoa.findUnique.mockResolvedValue(
          rowKhoa({ kenh_danh_gia: 'sso' }),
        );
        const kq = await service.layChoHocVien('hv-1');
        expect(kq.cau_hinh).toEqual({ kenh_danh_gia: 'sso' });
        expect(kq.pham_vi).toEqual({
          loai: 'khoa',
          khoa_id: 'k-ag',
          ma_khoa: '2026-AG-NLS',
          ten_khoa: 'NLS An Giang',
          tinh_id: 't-ag',
          ten_tinh: 'An Giang',
        });
        expect(prisma.cau_hinh_he_thong.findUnique).not.toHaveBeenCalled();
      });

      it('chỉ xét khóa ĐÃ DUYỆT có cấu hình riêng; nhiều khóa -> khóa duyệt gần nhất', async () => {
        await service.layChoHocVien('hv-1');
        const arg = prisma.dang_ky_hoc.findFirst.mock.calls[0][0];
        expect(arg.where).toEqual({
          hoc_vien_id: 'hv-1',
          khoa: { trang_thai: 'da_duyet', cau_hinh_khao_sat: { isNot: null } },
        });
        expect(arg.orderBy[0]).toEqual({
          khoa: { ngay_duyet: { sort: 'desc', nulls: 'last' } },
        });
      });

      it('chưa ghi danh khóa nào có cấu hình riêng -> cấu hình chung', async () => {
        prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
          gia_tri: { kenh_danh_gia: 'vle' },
          cap_nhat_luc: new Date(),
        });
        const kq = await service.layChoHocVien('hv-1');
        expect(kq.pham_vi).toEqual({ loai: 'chung' });
        expect(kq.cau_hinh).toEqual({ kenh_danh_gia: 'vle' });
      });

      it('kênh đánh giá đi theo khóa của học viên', async () => {
        prisma.dang_ky_hoc.findFirst.mockResolvedValue({ khoa_id: 'k-ag' });
        prisma.cau_hinh_khao_sat_khoa.findUnique.mockResolvedValue(
          rowKhoa({ kenh_danh_gia: 'sso', khao_sat_dau_ra_mo: true }),
        );
        await expect(service.layKenhDanhGia('hv-1')).resolves.toBe('sso');
        await expect(service.khaoSatDauRaDangMo('hv-1')).resolves.toBe(true);
      });
    });

    describe('trang chủ theo tỉnh', () => {
      it('danhSachTinh: chỉ tỉnh có khóa đã duyệt, sắp xếp theo tên', async () => {
        prisma.cau_hinh_khao_sat_khoa.findMany.mockResolvedValue([
          { tinh: { id: 't-2', ten: 'Đồng Tháp' } },
          { tinh: { id: 't-1', ten: 'An Giang' } },
        ]);
        await expect(service.danhSachTinh()).resolves.toEqual([
          { tinh_id: 't-1', ten_tinh: 'An Giang' },
          { tinh_id: 't-2', ten_tinh: 'Đồng Tháp' },
        ]);
        expect(
          prisma.cau_hinh_khao_sat_khoa.findMany.mock.calls[0][0].where,
        ).toEqual({
          tinh_id: { not: null },
          khoa: { trang_thai: 'da_duyet' },
        });
      });

      it('layTheoTinh: tỉnh gắn khóa -> cấu hình khóa; không gắn -> cấu hình chung', async () => {
        prisma.cau_hinh_khao_sat_khoa.findFirst.mockResolvedValueOnce(
          rowKhoa({ che_do_hoc_vien: 'khao_sat' }),
        );
        expect((await service.layTheoTinh('t-ag')).pham_vi.loai).toBe('khoa');

        prisma.cau_hinh_khao_sat_khoa.findFirst.mockResolvedValueOnce(null);
        prisma.cau_hinh_he_thong.findUnique.mockResolvedValue(null);
        expect((await service.layTheoTinh('t-khac')).pham_vi).toEqual({
          loai: 'chung',
        });
      });
    });

    describe('luuCauHinhKhoa / xoaCauHinhKhoa', () => {
      beforeEach(() => {
        prisma.khoa_boi_duong.findUnique.mockResolvedValue(khoa);
        prisma.dia_danh.findUnique.mockResolvedValue({
          id: 't-ag',
          cap: 'tinh_thanh',
        });
        prisma.cau_hinh_khao_sat_khoa.findUnique.mockResolvedValue(null);
        prisma.cau_hinh_khao_sat_khoa.upsert.mockImplementation(({ create }) =>
          Promise.resolve({
            ...create,
            khoa,
            tinh: { id: 't-ag', ten: 'An Giang' },
          }),
        );
      });

      it('hợp lệ -> upsert theo khóa, lưu tỉnh, cùng quy tắc chuẩn hóa với cấu hình chung', async () => {
        const kq = await service.luuCauHinhKhoa(
          'k-ag',
          hopLe(),
          't-ag',
          'qt-1',
        );
        const arg = prisma.cau_hinh_khao_sat_khoa.upsert.mock.calls[0][0];
        expect(arg.where).toEqual({ khoa_id: 'k-ag' });
        expect(arg.create.tinh_id).toBe('t-ag');
        expect(arg.create.gia_tri.phieu[0].ten).toBe(
          'Phiếu khảo sát kĩ năng số',
        );
        expect(kq.pham_vi).toMatchObject({
          loai: 'khoa',
          ten_tinh: 'An Giang',
        });
      });

      it('khóa không tồn tại -> 404', async () => {
        prisma.khoa_boi_duong.findUnique.mockResolvedValue(null);
        await expect(
          service.luuCauHinhKhoa('k-x', hopLe(), null, 'qt-1'),
        ).rejects.toBeInstanceOf(NotFoundAppException);
      });

      it('tỉnh không phải cấp tỉnh/thành -> ValidationException', async () => {
        prisma.dia_danh.findUnique.mockResolvedValue({
          id: 'x',
          cap: 'phuong_xa_dac_khu',
        });
        await expect(
          service.luuCauHinhKhoa('k-ag', hopLe(), 'x', 'qt-1'),
        ).rejects.toBeInstanceOf(ValidationException);
        expect(prisma.cau_hinh_khao_sat_khoa.upsert).not.toHaveBeenCalled();
      });

      it('tỉnh đã gắn khóa KHÁC -> ConflictAppException (mỗi tỉnh 1 khóa)', async () => {
        prisma.cau_hinh_khao_sat_khoa.findUnique.mockResolvedValue({
          khoa_id: 'k-khac',
          khoa: { ma_khoa: 'K-KHAC' },
        });
        await expect(
          service.luuCauHinhKhoa('k-ag', hopLe(), 't-ag', 'qt-1'),
        ).rejects.toBeInstanceOf(ConflictAppException);
      });

      it('lưu lại đúng khóa đang giữ tỉnh đó -> không coi là trùng', async () => {
        prisma.cau_hinh_khao_sat_khoa.findUnique.mockResolvedValue({
          khoa_id: 'k-ag',
          khoa: { ma_khoa: '2026-AG-NLS' },
        });
        await expect(
          service.luuCauHinhKhoa('k-ag', hopLe(), 't-ag', 'qt-1'),
        ).resolves.toBeDefined();
      });

      it('quy tắc khao_sat + tắt khối vẫn áp dụng cho cấu hình khóa', async () => {
        await expect(
          service.luuCauHinhKhoa(
            'k-ag',
            { ...hopLe(), hien_khao_sat: false },
            null,
            'qt-1',
          ),
        ).rejects.toBeInstanceOf(ValidationException);
      });

      it('xoaCauHinhKhoa -> xóa đúng khóa (về dùng cấu hình chung)', async () => {
        await service.xoaCauHinhKhoa('k-ag');
        expect(prisma.cau_hinh_khao_sat_khoa.deleteMany).toHaveBeenCalledWith({
          where: { khoa_id: 'k-ag' },
        });
      });
    });
  });
});
