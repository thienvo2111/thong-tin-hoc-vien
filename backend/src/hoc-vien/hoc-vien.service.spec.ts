import { HocVienService } from './hoc-vien.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  ConflictAppException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongBaoService } from '../thong-bao/thong-bao.service';

const namHopLe = new Date().getUTCFullYear() - 20;

function baseCreateDto() {
  return {
    ho_ten: 'Nguyễn Văn An',
    so_dinh_danh_ca_nhan: '123456789012',
    ngay_sinh: 15,
    thang_sinh: 6,
    nam_sinh: namHopLe,
    noi_sinh_id: 'tinh-1',
    phuong_xa_id: 'xa-1',
    don_vi_cong_tac_id: 'truong-1',
    so_dien_thoai_lien_he: '0912345678',
    email_lien_he: 'an@example.com',
    trinh_do_chuyen_mon: 'dai_hoc' as const,
    chuyen_mon: ['Sư phạm Toán'],
  };
}

describe('HocVienService', () => {
  let service: HocVienService;
  let prisma: {
    hoc_vien: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    hoc_vien_chuyen_mon: { create: jest.Mock; deleteMany: jest.Mock };
    dia_danh: { findUnique: jest.Mock };
    don_vi_cong_tac: { findUnique: jest.Mock; findFirst: jest.Mock };
    mon_hoc: { findUnique: jest.Mock };
    nguoi_dung: { create: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let scopeService: {
    getAccessibleDonViIds: jest.Mock;
    canAccessDonVi: jest.Mock;
  };
  let thongBaoService: {
    guiHocVienXacNhan: jest.Mock;
    guiHocVienDuyet: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      hoc_vien: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      hoc_vien_chuyen_mon: { create: jest.fn(), deleteMany: jest.fn() },
      dia_danh: { findUnique: jest.fn() },
      don_vi_cong_tac: { findUnique: jest.fn(), findFirst: jest.fn() },
      mon_hoc: { findUnique: jest.fn() },
      nguoi_dung: { create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    // Mặc định: $transaction chạy callback ngay với chính prisma mock làm tx
    // (đủ cho các test duyet() vốn assert trực tiếp trên prisma.hoc_vien.update).
    // dangKy()/createFromMoetImport() tự override bằng tx mock riêng khi cần.
    prisma.$transaction.mockImplementation(
      async (cb: (tx: unknown) => unknown) => cb(prisma),
    );
    scopeService = {
      getAccessibleDonViIds: jest.fn(),
      canAccessDonVi: jest.fn(),
    };
    thongBaoService = {
      guiHocVienXacNhan: jest.fn().mockResolvedValue(undefined),
      guiHocVienDuyet: jest.fn().mockResolvedValue(undefined),
    };
    service = new HocVienService(
      prisma as unknown as PrismaService,
      scopeService as unknown as ScopeService,
      thongBaoService as unknown as ThongBaoService,
    );

    // Fixture mặc định: mọi FK tra cứu hợp lệ (test override khi cần âm tính).
    prisma.dia_danh.findUnique.mockImplementation(({ where: { id } }) => {
      if (id === 'tinh-1')
        return { id, cap: 'tinh_thanh', trang_thai: 'active', parent_id: null };
      if (id === 'xa-1')
        return {
          id,
          cap: 'phuong_xa_dac_khu',
          trang_thai: 'active',
          parent_id: 'tinh-1',
        };
      return null;
    });
    prisma.don_vi_cong_tac.findUnique.mockImplementation(
      ({ where: { id } }) => {
        if (id === 'truong-1') {
          return {
            id,
            trang_thai: 'active',
            loai_don_vi: 'truong',
            dia_ban_id: 'xa-1',
          };
        }
        return null;
      },
    );
    prisma.hoc_vien.findUnique.mockResolvedValue(null);
  });

  describe('validateHocVien (requireFull=true, tự đăng ký)', () => {
    it('dữ liệu đầy đủ hợp lệ -> không lỗi', async () => {
      const { loi } = await service.validateHocVien(baseCreateDto(), {
        requireFull: true,
      });
      expect(loi).toHaveLength(0);
    });

    it('thiếu email_lien_he -> lỗi (bắt buộc khi tu_dang_ky)', async () => {
      const dto = { ...baseCreateDto(), email_lien_he: undefined };
      const { loi } = await service.validateHocVien(dto, { requireFull: true });
      expect(loi.some((l) => l.field === 'email_lien_he')).toBe(true);
    });

    it('thiếu chuyen_mon -> lỗi (rule #24, ≥1 giá trị)', async () => {
      const dto = { ...baseCreateDto(), chuyen_mon: [] };
      const { loi } = await service.validateHocVien(dto, { requireFull: true });
      expect(loi.some((l) => l.field === 'chuyen_mon')).toBe(true);
    });

    it('trinh_do_chuyen_mon=khac thiếu trinh_do_chuyen_mon_khac -> lỗi', async () => {
      const dto = { ...baseCreateDto(), trinh_do_chuyen_mon: 'khac' as const };
      const { loi } = await service.validateHocVien(dto, { requireFull: true });
      expect(loi.some((l) => l.field === 'trinh_do_chuyen_mon_khac')).toBe(
        true,
      );
    });

    it('phuong_xa_id không thuộc noi_sinh_id đã chọn -> lỗi (rule #15)', async () => {
      prisma.dia_danh.findUnique.mockImplementation(({ where: { id } }) => {
        if (id === 'tinh-1')
          return {
            id,
            cap: 'tinh_thanh',
            trang_thai: 'active',
            parent_id: null,
          };
        if (id === 'xa-1')
          return {
            id,
            cap: 'phuong_xa_dac_khu',
            trang_thai: 'active',
            parent_id: 'tinh-khac',
          };
        return null;
      });
      const { loi } = await service.validateHocVien(baseCreateDto(), {
        requireFull: true,
      });
      expect(loi.some((l) => l.field === 'phuong_xa_id')).toBe(true);
    });

    it('don_vi_cong_tac_id không phải loại truong -> lỗi (rule #18)', async () => {
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        id: 'truong-1',
        trang_thai: 'active',
        loai_don_vi: 'so_gddt',
        dia_ban_id: 'xa-1',
      });
      const { loi } = await service.validateHocVien(baseCreateDto(), {
        requireFull: true,
      });
      expect(loi.some((l) => l.field === 'don_vi_cong_tac_id')).toBe(true);
    });

    it('mon_giang_day_id có nhưng cap_giang_day trống -> lỗi (rule #26)', async () => {
      const dto = { ...baseCreateDto(), mon_giang_day_id: 'mon-1' };
      const { loi } = await service.validateHocVien(dto, { requireFull: true });
      expect(loi.some((l) => l.field === 'mon_giang_day_id')).toBe(true);
    });

    it('mon_giang_day_id không cùng cap_hoc với cap_giang_day -> lỗi', async () => {
      prisma.mon_hoc.findUnique.mockResolvedValue({
        id: 'mon-1',
        trang_thai: 'active',
        cap_hoc: 'tieu_hoc',
      });
      const dto = {
        ...baseCreateDto(),
        cap_giang_day: 'thpt' as const,
        mon_giang_day_id: 'mon-1',
      };
      const { loi } = await service.validateHocVien(dto, { requireFull: true });
      expect(loi.some((l) => l.field === 'mon_giang_day_id')).toBe(true);
    });

    it('so_dinh_danh_ca_nhan đã tồn tại ở học viên khác -> lỗi trùng (rule #7)', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) => {
        if (where.so_dinh_danh_ca_nhan) return { id: 'khac-id' };
        return null;
      });
      const { loi } = await service.validateHocVien(baseCreateDto(), {
        requireFull: true,
      });
      expect(loi.some((l) => l.field === 'so_dinh_danh_ca_nhan')).toBe(true);
    });

    it('excludeHocVienId trùng chính hồ sơ đang sửa -> không báo trùng (dùng ở PATCH)', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) => {
        if (where.so_dinh_danh_ca_nhan) return { id: 'hv-self' };
        return null;
      });
      const { loi } = await service.validateHocVien(baseCreateDto(), {
        requireFull: true,
        excludeHocVienId: 'hv-self',
      });
      expect(loi.some((l) => l.field === 'so_dinh_danh_ca_nhan')).toBe(false);
    });
  });

  describe('validateHocVien (requireFull=false, PATCH bổ sung)', () => {
    it('không có field nào -> không lỗi (không ép buộc field bắt buộc)', async () => {
      const { loi } = await service.validateHocVien(
        { don_vi_cong_tac_id: 'truong-1', so_dien_thoai_lien_he: '0912345678' },
        { requireFull: false },
      );
      expect(loi).toHaveLength(0);
    });

    it('có email_lien_he sai định dạng -> vẫn báo lỗi format dù không requireFull', async () => {
      const { loi } = await service.validateHocVien(
        {
          don_vi_cong_tac_id: 'truong-1',
          so_dien_thoai_lien_he: '0912345678',
          email_lien_he: 'khong-hop-le',
        },
        { requireFull: false },
      );
      expect(loi.some((l) => l.field === 'email_lien_he')).toBe(true);
    });
  });

  describe('dangKy — Luồng đăng ký (transaction 3 bước, thứ tự đảo ngược so với văn bản api-contract.md do chk_nguoi_dung_scope)', () => {
    it('tạo hoc_vien -> nguoi_dung (hoc_vien_id trỏ sẵn) -> backfill created_by, đúng thứ tự', async () => {
      const txNguoiDung = { create: jest.fn(), update: jest.fn() };
      const txHocVien = { create: jest.fn(), update: jest.fn() };
      txHocVien.create.mockResolvedValue({ id: 'hv-1' });
      txNguoiDung.create.mockResolvedValue({
        id: 'nd-1',
        ten_dang_nhap: '123456789012',
      });
      txHocVien.update.mockResolvedValue({ id: 'hv-1' });

      prisma.$transaction.mockImplementation(async (cb) =>
        cb({ nguoi_dung: txNguoiDung, hoc_vien: txHocVien }),
      );

      const res = await service.dangKy(baseCreateDto());

      expect(txHocVien.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nguon_tao: 'tu_dang_ky' }),
        }),
      );
      // created_by KHÔNG được set ở lệnh create đầu tiên (nguoi_dung chưa tồn tại).
      expect(txHocVien.create.mock.calls[0][0].data.created_by).toBeUndefined();

      expect(txNguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vai_tro: 'hoc_vien',
            ten_dang_nhap: '123456789012',
            hoc_vien_id: 'hv-1',
            don_vi_id: null,
            phai_doi_mat_khau: true,
          }),
        }),
      );
      expect(txHocVien.update).toHaveBeenCalledWith({
        where: { id: 'hv-1' },
        data: { created_by: 'nd-1' },
      });
      // Thứ tự: tạo hoc_vien trước nguoi_dung (nguoi_dung.hoc_vien_id phụ
      // thuộc hoc_vien.id — chk_nguoi_dung_scope bắt buộc hoc_vien_id NOT
      // NULL ngay khi tạo, không thể tạo nguoi_dung trước).
      expect(txHocVien.create.mock.invocationCallOrder[0]).toBeLessThan(
        txNguoiDung.create.mock.invocationCallOrder[0],
      );

      expect(res).toEqual({
        hoc_vien_id: 'hv-1',
        ten_dang_nhap: '123456789012',
        luu_y: expect.stringContaining('ngày sinh'),
      });
    });

    it('mật khẩu mặc định = ngày sinh dạng ddmmyyyy đã hash bcrypt', async () => {
      const txNguoiDung = { create: jest.fn(), update: jest.fn() };
      const txHocVien = { create: jest.fn(), update: jest.fn() };
      txHocVien.create.mockResolvedValue({ id: 'hv-1' });
      txNguoiDung.create.mockResolvedValue({ id: 'nd-1', ten_dang_nhap: 'x' });
      txHocVien.update.mockResolvedValue({ id: 'hv-1' });
      prisma.$transaction.mockImplementation(async (cb) =>
        cb({ nguoi_dung: txNguoiDung, hoc_vien: txHocVien }),
      );

      await service.dangKy(baseCreateDto());

      const hash = txNguoiDung.create.mock.calls[0][0].data.mat_khau_hash;
      const bcrypt = await import('bcryptjs');
      const dto = baseCreateDto();
      const expectedPlain = `${String(dto.ngay_sinh).padStart(2, '0')}${String(
        dto.thang_sinh,
      ).padStart(2, '0')}${dto.nam_sinh}`;
      await expect(bcrypt.compare(expectedPlain, hash)).resolves.toBe(true);
    });

    it('dữ liệu không hợp lệ -> ValidationException, KHÔNG mở transaction', async () => {
      const dto = { ...baseCreateDto(), so_dinh_danh_ca_nhan: '123' };
      await expect(service.dangKy(dto)).rejects.toBeInstanceOf(
        ValidationException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('race condition trùng ĐDCN ở tầng DB (P2002) -> ConflictAppException', async () => {
      const { Prisma } = await import('@prisma/client');
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('trung', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );
      await expect(service.dangKy(baseCreateDto())).rejects.toBeInstanceOf(
        ConflictAppException,
      );
    });
  });

  describe('duyet — routing theo cap_giang_day + scope enforcement', () => {
    const hocVienChoDuyet = (capGiangDay: string | null) => ({
      id: 'hv-1',
      nguon_tao: 'tu_dang_ky',
      trang_thai: 'cho_duyet',
      cap_giang_day: capGiangDay,
      ghi_chu: null,
      don_vi_cong_tac: { id: 'truong-1', dia_ban_id: 'xa-1' },
    });

    it('hồ sơ import_moet -> ConflictAppException (bỏ qua bước duyệt)', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        ...hocVienChoDuyet('thpt'),
        nguon_tao: 'import_moet',
      });
      await expect(
        service.duyet('hv-1', { ket_qua: 'da_duyet' }, {} as AuthenticatedUser),
      ).rejects.toBeInstanceOf(ConflictAppException);
    });

    it('hồ sơ không ở trang_thai cho_duyet -> ConflictAppException', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        ...hocVienChoDuyet('thpt'),
        trang_thai: 'nhap',
      });
      await expect(
        service.duyet('hv-1', { ket_qua: 'da_duyet' }, {} as AuthenticatedUser),
      ).rejects.toBeInstanceOf(ConflictAppException);
    });

    it('cap_giang_day=thpt -> route tới so_gddt quản lý tỉnh; ngoài scope -> 403', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienChoDuyet('thpt'));
      prisma.don_vi_cong_tac.findFirst.mockResolvedValue({ id: 'so-1' });
      scopeService.canAccessDonVi.mockResolvedValue(false);

      await expect(
        service.duyet('hv-1', { ket_qua: 'da_duyet' }, {
          vai_tro: 'phong_vhxh',
          don_vi_id: 'phong-khac',
        } as AuthenticatedUser),
      ).rejects.toBeInstanceOf(ForbiddenAppException);

      expect(prisma.don_vi_cong_tac.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ loai_don_vi: 'so_gddt' }),
        }),
      );
    });

    it('cap_giang_day=NULL -> cũng route tới so_gddt (fallback an toàn, rule #25b)', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienChoDuyet(null));
      prisma.don_vi_cong_tac.findFirst.mockResolvedValue({ id: 'so-1' });
      scopeService.canAccessDonVi.mockResolvedValue(true);
      prisma.hoc_vien.update.mockResolvedValue({ id: 'hv-1', chuyen_mon: [] });

      await service.duyet('hv-1', { ket_qua: 'da_duyet' }, {
        id: 'caller-1',
        vai_tro: 'so_gddt',
      } as AuthenticatedUser);

      expect(prisma.don_vi_cong_tac.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ loai_don_vi: 'so_gddt' }),
        }),
      );
    });

    it('cap_giang_day=tieu_hoc -> route tới phong_vhxh cùng xã; trong scope -> ghi nhận nguoi_duyet_id/cap_duyet_thuc_te/ngay_duyet', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienChoDuyet('tieu_hoc'));
      prisma.don_vi_cong_tac.findFirst.mockResolvedValue({ id: 'phong-1' });
      scopeService.canAccessDonVi.mockResolvedValue(true);
      prisma.hoc_vien.update.mockResolvedValue({ id: 'hv-1', chuyen_mon: [] });

      await service.duyet('hv-1', { ket_qua: 'da_duyet' }, {
        id: 'caller-1',
        vai_tro: 'phong_vhxh',
      } as AuthenticatedUser);

      expect(prisma.don_vi_cong_tac.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { loai_don_vi: 'phong_vhxh', dia_ban_id: 'xa-1' },
        }),
      );
      expect(prisma.hoc_vien.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trang_thai: 'da_duyet',
            nguoi_duyet_id: 'caller-1',
            cap_duyet_thuc_te: 'phong_vhxh',
            ngay_duyet: expect.any(Date),
          }),
        }),
      );
    });

    it('không tìm thấy đơn vị duyệt phù hợp trong danh mục -> NotFoundAppException', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienChoDuyet('mam_non'));
      prisma.don_vi_cong_tac.findFirst.mockResolvedValue(null);
      await expect(
        service.duyet('hv-1', { ket_qua: 'da_duyet' }, {
          vai_tro: 'phong_vhxh',
        } as AuthenticatedUser),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });

    it('tu_choi kèm ly_do -> ghi vào ghi_chu (không có cột riêng trong DDL)', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienChoDuyet('thpt'));
      prisma.don_vi_cong_tac.findFirst.mockResolvedValue({ id: 'so-1' });
      scopeService.canAccessDonVi.mockResolvedValue(true);
      prisma.hoc_vien.update.mockResolvedValue({ id: 'hv-1', chuyen_mon: [] });

      await service.duyet(
        'hv-1',
        { ket_qua: 'tu_choi', ly_do: 'Thiếu minh chứng' },
        { id: 'caller-1', vai_tro: 'so_gddt' } as AuthenticatedUser,
      );

      expect(prisma.hoc_vien.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ghi_chu: expect.stringContaining('Thiếu minh chứng'),
          }),
        }),
      );
    });
  });

  describe('findOne — scope enforcement', () => {
    it('ngoài phạm vi quyền -> ForbiddenAppException', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({
        id: 'hv-1',
        don_vi_cong_tac_id: 'truong-x',
        chuyen_mon: [],
      });
      scopeService.canAccessDonVi.mockResolvedValue(false);
      await expect(
        service.findOne('hv-1', {} as AuthenticatedUser),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('không tồn tại -> NotFoundAppException', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);
      await expect(
        service.findOne('khong-co', {} as AuthenticatedUser),
      ).rejects.toBeInstanceOf(NotFoundAppException);
    });
  });

  describe('kiemTraTrung', () => {
    it('sai định dạng (không đủ 12 số) -> ValidationException', async () => {
      await expect(service.kiemTraTrung('123')).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('đã tồn tại -> ton_tai=true', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue({ id: 'hv-1' });
      const res = await service.kiemTraTrung('123456789012');
      expect(res).toEqual({ ton_tai: true });
    });

    it('chưa tồn tại -> ton_tai=false', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(null);
      const res = await service.kiemTraTrung('123456789012');
      expect(res).toEqual({ ton_tai: false });
    });
  });

  describe('checkValidMoetImportRow — luồng import CSDL MOET (#36b-36f)', () => {
    function baseMoetInput() {
      return {
        ma_dinh_danh_moet: 'MOET-001',
        ho_ten: 'Trần Thị Bình',
        ngay_sinh: 10,
        thang_sinh: 3,
        nam_sinh: namHopLe,
        so_dien_thoai_lien_he: '0912345678',
        chuyen_mon: ['Toán', 'Lý'],
        don_vi_cong_tac_id: 'truong-1',
      };
    }

    it('dữ liệu hợp lệ -> không throw', async () => {
      await expect(
        service.checkValidMoetImportRow(baseMoetInput()),
      ).resolves.toBeUndefined();
    });

    it('ma_dinh_danh_moet đã tồn tại -> ValidationException (rule #36f)', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) =>
        where.ma_dinh_danh_moet ? { id: 'khac' } : null,
      );
      await expect(
        service.checkValidMoetImportRow(baseMoetInput()),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('chuyen_mon rỗng sau khi tách -> lỗi', async () => {
      await expect(
        service.checkValidMoetImportRow({ ...baseMoetInput(), chuyen_mon: [] }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('don_vi_cong_tac không active/không phải truong -> lỗi', async () => {
      prisma.don_vi_cong_tac.findUnique.mockResolvedValue({
        id: 'truong-1',
        trang_thai: 'ngung',
        loai_don_vi: 'truong',
      });
      await expect(
        service.checkValidMoetImportRow(baseMoetInput()),
      ).rejects.toBeInstanceOf(ValidationException);
    });
  });

  describe('createFromMoetImport — tạo nguoi_dung+hoc_vien da_duyet ngay (#36c)', () => {
    it('tạo với trang_thai=da_duyet, cap_duyet_thuc_te=quan_tri, nhiều chuyen_mon', async () => {
      const txNguoiDung = { create: jest.fn(), update: jest.fn() };
      const txHocVien = { create: jest.fn(), update: jest.fn() };
      txHocVien.create.mockResolvedValue({ id: 'hv-1' });
      txNguoiDung.create.mockResolvedValue({
        id: 'nd-1',
        ten_dang_nhap: 'MOET-001',
      });
      txHocVien.update.mockResolvedValue({ id: 'hv-1' });
      prisma.$transaction.mockImplementation(async (cb) =>
        cb({ nguoi_dung: txNguoiDung, hoc_vien: txHocVien }),
      );

      await service.createFromMoetImport(
        {
          ma_dinh_danh_moet: 'MOET-001',
          ho_ten: 'Trần Thị Bình',
          ngay_sinh: 10,
          thang_sinh: 3,
          nam_sinh: namHopLe,
          so_dien_thoai_lien_he: '0912345678',
          chuyen_mon: ['Toán', 'Lý', 'Toán'], // trùng lặp -> phải dedupe
          don_vi_cong_tac_id: 'truong-1',
        },
        'quan-tri-1',
      );

      expect(txNguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ten_dang_nhap: 'MOET-001',
            email: null,
            vai_tro: 'hoc_vien',
          }),
        }),
      );
      const hocVienData = txHocVien.create.mock.calls[0][0].data;
      expect(hocVienData).toEqual(
        expect.objectContaining({
          nguon_tao: 'import_moet',
          trang_thai: 'da_duyet',
          nguoi_duyet_id: 'quan-tri-1',
          cap_duyet_thuc_te: 'quan_tri',
          ngay_duyet: expect.any(Date),
        }),
      );
      expect(hocVienData.created_by).toBeUndefined(); // backfill sau, xem txHocVien.update
      expect(hocVienData.chuyen_mon.create).toHaveLength(2); // dedupe "Toán"

      expect(txNguoiDung.create.mock.calls[0][0].data.hoc_vien_id).toBe('hv-1');
      expect(txHocVien.update).toHaveBeenCalledWith({
        where: { id: 'hv-1' },
        data: { created_by: 'nd-1' },
      });
    });

    it('dữ liệu không hợp lệ -> ném lỗi trước khi mở transaction', async () => {
      await expect(
        service.createFromMoetImport(
          {
            ma_dinh_danh_moet: '',
            ho_ten: 'X',
            ngay_sinh: 1,
            thang_sinh: 1,
            nam_sinh: namHopLe,
            so_dien_thoai_lien_he: 'sai',
            chuyen_mon: [],
            don_vi_cong_tac_id: 'khong-ton-tai',
          },
          'quan-tri-1',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
