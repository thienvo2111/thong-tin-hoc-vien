import { createHash } from 'crypto';
import { SsoService, SSO_MA_HIEU_LUC_MS } from './sso.service';
import { PrismaService } from '../prisma/prisma.service';
import { HocVienService } from '../hoc-vien/hoc-vien.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  SsoChuaCauHinhException,
  SsoMaKhongHopLeException,
  UnauthorizedAppException,
} from '../common/exceptions/app.exceptions';

describe('SsoService', () => {
  let service: SsoService;
  let prisma: {
    ma_sso_mot_lan: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    hoc_vien: { findUnique: jest.Mock };
  };
  let hocVienService: {
    danhGiaDauVaoCuaToi: jest.Mock;
    khaoSatDauRaCuaToi: jest.Mock;
  };
  const envGoc = { ...process.env };

  const caller = {
    id: 'nd-1',
    vai_tro: 'hoc_vien',
    hoc_vien_id: 'hv-1',
  } as AuthenticatedUser;

  beforeEach(() => {
    prisma = {
      ma_sso_mot_lan: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      hoc_vien: { findUnique: jest.fn() },
    };
    hocVienService = {
      danhGiaDauVaoCuaToi: jest
        .fn()
        .mockResolvedValue({ kenh: 'sso', du_dieu_kien: true }),
      khaoSatDauRaCuaToi: jest
        .fn()
        .mockResolvedValue({ mo: true, du_dieu_kien: true }),
    };
    service = new SsoService(
      prisma as unknown as PrismaService,
      hocVienService as unknown as HocVienService,
    );
    process.env.SSO_KHAO_SAT_URL = 'https://khaosat.test/sso/start';
    process.env.SSO_KHAO_SAT_API_KEY = 'khoa-bi-mat-dung';
  });

  afterEach(() => {
    process.env = { ...envGoc };
  });

  describe('capMa', () => {
    it('đủ điều kiện -> trả URL có code + target, DB chỉ lưu SHA-256 của mã, hết hạn sau 5 phút', async () => {
      const truoc = Date.now();
      const kq = await service.capMa(caller, 'danh-gia');

      const url = new URL(kq.url);
      expect(url.origin + url.pathname).toBe('https://khaosat.test/sso/start');
      expect(url.searchParams.get('target')).toBe('danh-gia');
      const ma = url.searchParams.get('code')!;
      expect(ma.length).toBeGreaterThanOrEqual(40);

      const data = prisma.ma_sso_mot_lan.create.mock.calls[0][0].data;
      expect(data.ma_hash).toBe(createHash('sha256').update(ma).digest('hex'));
      expect(data.ma_hash).not.toContain(ma);
      expect(data.hoc_vien_id).toBe('hv-1');
      expect(data.target).toBe('danh-gia');
      const hieuLuc = data.het_han.getTime() - truoc;
      expect(hieuLuc).toBeGreaterThanOrEqual(SSO_MA_HIEU_LUC_MS - 1000);
      expect(hieuLuc).toBeLessThanOrEqual(SSO_MA_HIEU_LUC_MS + 1000);
    });

    it('không target -> URL không có target (bên khảo sát hiện danh sách bài)', async () => {
      const kq = await service.capMa(caller);
      expect(new URL(kq.url).searchParams.has('target')).toBe(false);
      expect(
        prisma.ma_sso_mot_lan.create.mock.calls[0][0].data.target,
      ).toBeNull();
    });

    it('mỗi lần cấp ra 1 mã khác nhau', async () => {
      const a = new URL((await service.capMa(caller)).url).searchParams.get(
        'code',
      );
      const b = new URL((await service.capMa(caller)).url).searchParams.get(
        'code',
      );
      expect(a).not.toBe(b);
    });

    it('không đặt SSO_KHAO_SAT_URL -> dùng URL mặc định khaosatnls.hcmue.edu.vn', async () => {
      delete process.env.SSO_KHAO_SAT_URL;
      const kq = await service.capMa(caller);
      expect(
        kq.url.startsWith('https://khaosatnls.hcmue.edu.vn/sso/start?code='),
      ).toBe(true);
    });

    it('kênh đánh giá là vle -> 403, không tạo mã', async () => {
      hocVienService.danhGiaDauVaoCuaToi.mockResolvedValue({
        kenh: 'vle',
        du_dieu_kien: true,
      });
      await expect(service.capMa(caller)).rejects.toBeInstanceOf(
        ForbiddenAppException,
      );
      expect(prisma.ma_sso_mot_lan.create).not.toHaveBeenCalled();
    });

    it('hồ sơ chưa đầy đủ -> 403, không tạo mã', async () => {
      hocVienService.danhGiaDauVaoCuaToi.mockResolvedValue({
        kenh: 'sso',
        du_dieu_kien: false,
        ly_do: ['Chưa chọn đối tượng'],
      });
      await expect(service.capMa(caller)).rejects.toBeInstanceOf(
        ForbiddenAppException,
      );
      expect(prisma.ma_sso_mot_lan.create).not.toHaveBeenCalled();
    });
  });

  describe('capMa — khảo sát đầu ra (target dau-ra)', () => {
    it('đã mở + hồ sơ đủ -> cấp mã target dau-ra, không phụ thuộc kênh đầu vào', async () => {
      hocVienService.danhGiaDauVaoCuaToi.mockResolvedValue({
        kenh: 'vle',
        du_dieu_kien: false,
      });
      const kq = await service.capMa(caller, 'dau-ra');
      expect(new URL(kq.url).searchParams.get('target')).toBe('dau-ra');
      expect(
        prisma.ma_sso_mot_lan.create.mock.calls[0][0].data.target,
      ).toBe('dau-ra');
      expect(hocVienService.danhGiaDauVaoCuaToi).not.toHaveBeenCalled();
    });

    it('chưa mở -> 403, không tạo mã', async () => {
      hocVienService.khaoSatDauRaCuaToi.mockResolvedValue({ mo: false });
      await expect(service.capMa(caller, 'dau-ra')).rejects.toBeInstanceOf(
        ForbiddenAppException,
      );
      expect(prisma.ma_sso_mot_lan.create).not.toHaveBeenCalled();
    });

    it('đã mở nhưng hồ sơ thiếu -> 403, không tạo mã', async () => {
      hocVienService.khaoSatDauRaCuaToi.mockResolvedValue({
        mo: true,
        du_dieu_kien: false,
        ly_do: ['Chưa có email'],
      });
      await expect(service.capMa(caller, 'dau-ra')).rejects.toBeInstanceOf(
        ForbiddenAppException,
      );
      expect(prisma.ma_sso_mot_lan.create).not.toHaveBeenCalled();
    });
  });

  describe('taoMaThu (quản trị thử tích hợp)', () => {
    it('mã MOET không tồn tại -> 404, không tạo mã', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);
      await expect(service.taoMaThu('khong-co')).rejects.toBeInstanceOf(
        NotFoundAppException,
      );
      expect(prisma.ma_sso_mot_lan.create).not.toHaveBeenCalled();
    });

    it('có học viên -> tạo mã cho đúng học viên, BỎ QUA điều kiện kênh/hồ sơ, trả code + URL + thông tin để đối chiếu', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        id: 'hv-9',
        ho_ten: 'Nguyễn Văn Thử',
        ma_dinh_danh_moet: '9115131060',
        doi_tuong: null,
      });
      const kq = await service.taoMaThu('9115131060', 'khao-sat');

      expect(hocVienService.danhGiaDauVaoCuaToi).not.toHaveBeenCalled();
      const data = prisma.ma_sso_mot_lan.create.mock.calls[0][0].data;
      expect(data.hoc_vien_id).toBe('hv-9');
      expect(data.ma_hash).toBe(
        createHash('sha256').update(kq.code).digest('hex'),
      );
      expect(new URL(kq.url).searchParams.get('code')).toBe(kq.code);
      expect(new URL(kq.url).searchParams.get('target')).toBe('khao-sat');
      expect(kq.hoc_vien).toMatchObject({
        id: 'hv-9',
        ma_dinh_danh_moet: '9115131060',
      });
    });
  });

  describe('doiMa', () => {
    const banGhi = {
      target: 'khao-sat',
      hoc_vien: {
        id: 'hv-1',
        ma_dinh_danh_moet: '9115131060',
        doi_tuong: 'can_bo_quan_ly',
        so_dinh_danh_ca_nhan: '012345678901',
        don_vi_cong_tac: { ma_don_vi: 'DV01', ten_don_vi: 'Trường A' },
        dang_ky_hoc: [
          {
            khoa: { ma_khoa: 'NLS-AG' },
            phan_lop_giai_doan: [
              {
                lop: { ten_lop: 'Lớp 1', loai_lop: 'zoom' },
                giai_doan: { ten_giai_doan: 'Zoom – nhóm 1' },
              },
            ],
          },
        ],
      },
    };

    it('chưa cấu hình SSO_KHAO_SAT_API_KEY -> 503, không đụng DB', async () => {
      delete process.env.SSO_KHAO_SAT_API_KEY;
      await expect(
        service.doiMa('bat-ky', 'x'.repeat(43)),
      ).rejects.toBeInstanceOf(SsoChuaCauHinhException);
      expect(prisma.ma_sso_mot_lan.updateMany).not.toHaveBeenCalled();
    });

    it.each([undefined, '', 'khoa-sai'])(
      'API key %p không đúng -> 401, không đụng DB',
      async (key) => {
        await expect(service.doiMa(key, 'x'.repeat(43))).rejects.toBeInstanceOf(
          UnauthorizedAppException,
        );
        expect(prisma.ma_sso_mot_lan.updateMany).not.toHaveBeenCalled();
      },
    );

    it('mã đã dùng / hết hạn / không tồn tại (updateMany count=0) -> 400 SSO_MA_KHONG_HOP_LE', async () => {
      prisma.ma_sso_mot_lan.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.doiMa('khoa-bi-mat-dung', 'x'.repeat(43)),
      ).rejects.toBeInstanceOf(SsoMaKhongHopLeException);
      expect(prisma.ma_sso_mot_lan.findUnique).not.toHaveBeenCalled();
    });

    it('đánh dấu đã dùng nguyên tử: chỉ khớp mã CHƯA dùng và CHƯA hết hạn, tìm theo hash', async () => {
      prisma.ma_sso_mot_lan.updateMany.mockResolvedValue({ count: 1 });
      prisma.ma_sso_mot_lan.findUnique.mockResolvedValue(banGhi);
      const ma = 'm'.repeat(43);
      await service.doiMa('khoa-bi-mat-dung', ma);

      const { where, data } = prisma.ma_sso_mot_lan.updateMany.mock.calls[0][0];
      expect(where.ma_hash).toBe(createHash('sha256').update(ma).digest('hex'));
      expect(where.da_dung_luc).toBeNull();
      expect(where.het_han.gt).toBeInstanceOf(Date);
      expect(data.da_dung_luc).toBeInstanceOf(Date);
    });

    it('hợp lệ -> trả mã định danh, vai trò, đơn vị, target, lớp; KHÔNG trả CCCD', async () => {
      prisma.ma_sso_mot_lan.updateMany.mockResolvedValue({ count: 1 });
      prisma.ma_sso_mot_lan.findUnique.mockResolvedValue(banGhi);
      const kq = await service.doiMa('khoa-bi-mat-dung', 'm'.repeat(43));
      expect(kq).toEqual({
        hoc_vien_id: 'hv-1',
        ma_dinh_danh_moet: '9115131060',
        vai_tro: 'can_bo_quan_ly',
        ma_don_vi: 'DV01',
        ten_don_vi: 'Trường A',
        target: 'khao-sat',
        lop: [
          {
            ma_khoa: 'NLS-AG',
            ten_lop: 'Lớp 1',
            loai_lop: 'zoom',
            giai_doan: 'Zoom – nhóm 1',
          },
        ],
      });
      expect(JSON.stringify(kq)).not.toContain('012345678901');
    });
  });
});
