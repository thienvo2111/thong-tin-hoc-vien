import {
  CauHinhKhaoSatService,
  KHOA_CAU_HINH_KHAO_SAT,
} from './cau-hinh-khao-sat.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationException } from '../common/exceptions/app.exceptions';
import { CauHinhKhaoSatDto } from './dto/cau-hinh-khao-sat.dto';

describe('CauHinhKhaoSatService', () => {
  let service: CauHinhKhaoSatService;
  let prisma: {
    cau_hinh_he_thong: { findUnique: jest.Mock; upsert: jest.Mock };
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
    };
    service = new CauHinhKhaoSatService(prisma as unknown as PrismaService);
  });

  describe('layCauHinh', () => {
    it('chưa lưu lần nào -> cau_hinh null (frontend dùng mặc định)', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue(null);
      await expect(service.layCauHinh()).resolves.toEqual({
        cau_hinh: null,
        cap_nhat_luc: null,
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
      await expect(service.layKenhDanhGia()).resolves.toBe('vle');
    });

    it('cấu hình lưu trước khi có trường kenh_danh_gia -> vle', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { che_do_hoc_vien: 'dang_nhap' },
        cap_nhat_luc: new Date(),
      });
      await expect(service.layKenhDanhGia()).resolves.toBe('vle');
    });

    it('đã chọn sso -> sso', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { kenh_danh_gia: 'sso' },
        cap_nhat_luc: new Date(),
      });
      await expect(service.layKenhDanhGia()).resolves.toBe('sso');
    });
  });

  describe('khaoSatDauRaDangMo', () => {
    it('chưa lưu / cấu hình cũ không có cờ -> chưa mở', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue(null);
      await expect(service.khaoSatDauRaDangMo()).resolves.toBe(false);
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { kenh_danh_gia: 'sso' },
        cap_nhat_luc: new Date(),
      });
      await expect(service.khaoSatDauRaDangMo()).resolves.toBe(false);
    });

    it('đã bật -> mở', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: { khao_sat_dau_ra_mo: true },
        cap_nhat_luc: new Date(),
      });
      await expect(service.khaoSatDauRaDangMo()).resolves.toBe(true);
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
});
