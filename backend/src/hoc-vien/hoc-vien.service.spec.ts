import { HocVienService } from './hoc-vien.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../auth/scope/scope.service';
import {
  ConflictAppException,
  DotXacNhanDongException,
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ThongBaoService } from '../thong-bao/thong-bao.service';
import { DotXacNhanService } from '../dot-xac-nhan/dot-xac-nhan.service';
import { CauHinhKhaoSatService } from '../cau-hinh-khao-sat/cau-hinh-khao-sat.service';

const namHopLe = new Date().getUTCFullYear() - 20;

function baseCreateDto() {
  return {
    ho_ten: 'Nguyễn Văn An',
    so_dinh_danh_ca_nhan: '123456789012',
    ngay_sinh: 15,
    thang_sinh: 6,
    nam_sinh: namHopLe,
    noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
    noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
    noi_sinh_xa: 'Xã Long Xuyên (cũ)',
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
    lich_su_thay_doi_ho_so: { createMany: jest.Mock; create: jest.Mock };
    token_xac_thuc: { findFirst: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let scopeService: {
    getAccessibleDonViIds: jest.Mock;
    canAccessDonVi: jest.Mock;
  };
  let thongBaoService: {
    guiHocVienXacNhan: jest.Mock;
    guiHocVienDuyet: jest.Mock;
    guiXacMinhEmail: jest.Mock;
  };
  let dotXacNhanService: {
    dotDangMoCuaHocVien: jest.Mock;
    dotSapMoCuaHocVien: jest.Mock;
    coXacNhanConHieuLuc: jest.Mock;
    trangThaiXacNhanTrongDot: jest.Mock;
    xacNhanConHieuLucGanNhat: jest.Mock;
    huyXacNhanNeuCo: jest.Mock;
    taoXacNhan: jest.Mock;
    coXacNhanTruocDanhGiaConHieuLuc: jest.Mock;
    dotXacNhanTruocDanhGiaApDung: jest.Mock;
  };
  let cauHinhKhaoSatService: { layKenhDanhGia: jest.Mock };

  beforeEach(() => {
    // 2026-10-02: mặc định kênh 'vle' = hành vi cũ, test SSO tự override.
    cauHinhKhaoSatService = {
      layKenhDanhGia: jest.fn().mockResolvedValue('vle'),
    };
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
      lich_su_thay_doi_ho_so: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
      },
      token_xac_thuc: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([]),
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
      guiXacMinhEmail: jest.fn().mockResolvedValue(undefined),
    };
    // T14: các test hiện có đều dùng nguon_tao='tu_dang_ky' (không đi qua
    // đợt xác nhận) — mock trả "không có đợt" làm mặc định an toàn, test
    // riêng cho import_moet (nếu có) tự override.
    dotXacNhanService = {
      dotDangMoCuaHocVien: jest.fn().mockResolvedValue(null),
      dotSapMoCuaHocVien: jest.fn().mockResolvedValue(null),
      coXacNhanConHieuLuc: jest.fn().mockResolvedValue(false),
      trangThaiXacNhanTrongDot: jest
        .fn()
        .mockResolvedValue({ conHieuLuc: null, biHuyGanNhat: null }),
      xacNhanConHieuLucGanNhat: jest.fn().mockResolvedValue(null),
      huyXacNhanNeuCo: jest.fn().mockResolvedValue(false),
      taoXacNhan: jest.fn(),
      coXacNhanTruocDanhGiaConHieuLuc: jest.fn().mockResolvedValue(false),
      dotXacNhanTruocDanhGiaApDung: jest.fn().mockResolvedValue(null),
    };
    service = new HocVienService(
      prisma as unknown as PrismaService,
      scopeService as unknown as ScopeService,
      thongBaoService as unknown as ThongBaoService,
      dotXacNhanService as unknown as DotXacNhanService,
      cauHinhKhaoSatService as unknown as CauHinhKhaoSatService,
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

    it('cu_tru_phuong_xa_id không thuộc cu_tru_tinh_id đã chọn -> lỗi (rule mới thay #15)', async () => {
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
      const dto = {
        ...baseCreateDto(),
        cu_tru_tinh_id: 'tinh-1',
        cu_tru_phuong_xa_id: 'xa-1',
      };
      const { loi } = await service.validateHocVien(dto, {
        requireFull: true,
      });
      expect(loi.some((l) => l.field === 'cu_tru_phuong_xa_id')).toBe(true);
    });

    it('không có noi_sinh_tinh/huyen/xa -> không lỗi (T17: tùy chọn, không tính vào đầy đủ)', async () => {
      const dto = {
        ...baseCreateDto(),
        noi_sinh_tinh: undefined,
        noi_sinh_huyen: undefined,
        noi_sinh_xa: undefined,
      };
      const { loi } = await service.validateHocVien(dto, {
        requireFull: true,
      });
      expect(loi.some((l) => l.field.startsWith('noi_sinh'))).toBe(false);
    });

    it('cu_tru_tinh_id/cu_tru_phuong_xa_id không gửi (tùy chọn) -> không lỗi', async () => {
      const { loi } = await service.validateHocVien(baseCreateDto(), {
        requireFull: true,
      });
      expect(loi.some((l) => l.field.startsWith('cu_tru'))).toBe(false);
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

  describe('findAll — q tìm không dấu (unaccent) trên ho_ten', () => {
    const callerAll = {} as AuthenticatedUser;

    beforeEach(() => {
      scopeService.getAccessibleDonViIds.mockResolvedValue('ALL');
      prisma.hoc_vien.findMany.mockResolvedValue([]);
      prisma.hoc_vien.count.mockResolvedValue(0);
    });

    it('q="can dang" (không dấu) -> gọi $queryRaw rồi lọc where.OR gồm id khớp tên + CCCD/MOET nguyên dấu', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'hv-can-dang' }]);

      await service.findAll({ q: 'can dang' } as never, callerAll);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const whereArg = prisma.hoc_vien.findMany.mock.calls[0][0].where;
      expect(whereArg.OR[0]).toEqual({ id: { in: ['hv-can-dang'] } });
      expect(whereArg.OR[1]).toEqual({
        so_dinh_danh_ca_nhan: { contains: 'can dang' },
      });
    });

    it('q chứa ký tự % hoặc _ -> không làm vỡ truy vấn', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.findAll({ q: '100%_test' } as never, callerAll),
      ).resolves.toBeDefined();
    });

    it('không truyền q -> KHÔNG gọi $queryRaw', async () => {
      await service.findAll({} as never, callerAll);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
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

  // Thêm 2026-09-28 (docs/api-contract.md mục 2, "Thêm 2026-09-28"): GET
  // /hoc-vien/toi và GET /hoc-vien/{id} phải kèm sẵn *_ten đã join cho 4 FK
  // chọn-từ-danh-mục, song song giữ nguyên *_id.
  describe('GET /hoc-vien/toi + GET /hoc-vien/{id} — tên đã join cho FK danh mục (2026-09-28)', () => {
    function hocVienDayDuCoTen(overrides: Record<string, unknown> = {}) {
      return {
        id: 'hv-1',
        ho_ten: 'Nguyễn Văn An',
        don_vi_cong_tac_id: 'truong-1',
        noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
        noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
        noi_sinh_xa: 'Xã Long Xuyên (cũ)',
        noi_sinh_id: null,
        phuong_xa_id: null,
        cu_tru_tinh_id: 'tinh-1',
        cu_tru_phuong_xa_id: 'xa-1',
        mon_giang_day_id: 'mon-1',
        chuyen_mon: [],
        noi_sinh_dia_danh: null,
        phuong_xa: null,
        cu_tru_tinh: { id: 'tinh-1', ten: 'An Giang' },
        cu_tru_phuong_xa: { id: 'xa-1', ten: 'Phường Long Xuyên' },
        don_vi_cong_tac: { id: 'truong-1', ten_don_vi: 'Trường THPT An Giang' },
        mon_giang_day: { id: 'mon-1', ten_mon: 'Toán' },
        ...overrides,
      };
    }

    it('layHoSoCuaToi — có noi_sinh_tinh/huyen/xa (text) + cư trú đủ -> response kèm noi_sinh_tinh/huyen/xa, cu_tru_*_ten cạnh cu_tru_*_id', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDuCoTen());
      const res = await service.layHoSoCuaToi({
        hoc_vien_id: 'hv-1',
      } as AuthenticatedUser);

      expect(res).toMatchObject({
        noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
        noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
        noi_sinh_xa: 'Xã Long Xuyên (cũ)',
        cu_tru_tinh_id: 'tinh-1',
        cu_tru_tinh_ten: 'An Giang',
        cu_tru_phuong_xa_id: 'xa-1',
        cu_tru_phuong_xa_ten: 'Phường Long Xuyên',
        don_vi_cong_tac_id: 'truong-1',
        don_vi_cong_tac_ten: 'Trường THPT An Giang',
        mon_giang_day_id: 'mon-1',
        mon_giang_day_ten: 'Toán',
      });
      // Không lộ nguyên object quan hệ Prisma ra response, chỉ *_ten phẳng.
      expect(res).not.toHaveProperty('noi_sinh_dia_danh');
      expect(res).not.toHaveProperty('phuong_xa');
      expect(res).not.toHaveProperty('cu_tru_tinh');
      expect(res).not.toHaveProperty('cu_tru_phuong_xa');
      expect(res).not.toHaveProperty('mon_giang_day');
    });

    it('layHoSoCuaToi — chưa có cư trú/môn giảng dạy (optional NULL) -> *_ten tương ứng là null, không lỗi', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(
        hocVienDayDuCoTen({
          cu_tru_tinh_id: null,
          cu_tru_phuong_xa_id: null,
          mon_giang_day_id: null,
          cu_tru_tinh: null,
          cu_tru_phuong_xa: null,
          mon_giang_day: null,
        }),
      );
      const res = await service.layHoSoCuaToi({
        hoc_vien_id: 'hv-1',
      } as AuthenticatedUser);

      expect(res).toMatchObject({
        cu_tru_tinh_id: null,
        cu_tru_tinh_ten: null,
        cu_tru_phuong_xa_id: null,
        cu_tru_phuong_xa_ten: null,
        mon_giang_day_id: null,
        mon_giang_day_ten: null,
        // don_vi_cong_tac_id NOT NULL trên DDL -> luôn có tên đi kèm.
        don_vi_cong_tac_id: 'truong-1',
        don_vi_cong_tac_ten: 'Trường THPT An Giang',
      });
    });

    it('findOne — có noi_sinh_tinh/huyen/xa (text) + cư trú đủ -> response kèm noi_sinh_tinh/huyen/xa, cu_tru_*_ten', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDuCoTen());
      scopeService.canAccessDonVi.mockResolvedValue(true);
      const res = await service.findOne('hv-1', {} as AuthenticatedUser);

      expect(res).toMatchObject({
        noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
        noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
        noi_sinh_xa: 'Xã Long Xuyên (cũ)',
        cu_tru_tinh_ten: 'An Giang',
        cu_tru_phuong_xa_ten: 'Phường Long Xuyên',
        don_vi_cong_tac_ten: 'Trường THPT An Giang',
        mon_giang_day_ten: 'Toán',
      });
    });

    it('findOne — cư trú/môn giảng dạy optional NULL -> *_ten tương ứng là null, không lỗi', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(
        hocVienDayDuCoTen({
          cu_tru_tinh_id: null,
          cu_tru_phuong_xa_id: null,
          mon_giang_day_id: null,
          cu_tru_tinh: null,
          cu_tru_phuong_xa: null,
          mon_giang_day: null,
        }),
      );
      scopeService.canAccessDonVi.mockResolvedValue(true);
      const res = await service.findOne('hv-1', {} as AuthenticatedUser);

      expect(res).toMatchObject({
        cu_tru_tinh_ten: null,
        cu_tru_phuong_xa_ten: null,
        mon_giang_day_ten: null,
        don_vi_cong_tac_ten: 'Trường THPT An Giang',
      });
    });

    it('còn dữ liệu noi_sinh_id cũ (deprecated) -> vẫn trả noi_sinh_ten từ quan hệ cũ', async () => {
      prisma.hoc_vien.findUnique.mockResolvedValue(
        hocVienDayDuCoTen({
          noi_sinh_id: 'tinh-1',
          noi_sinh_dia_danh: { id: 'tinh-1', ten: 'An Giang' },
        }),
      );
      const res = await service.layHoSoCuaToi({
        hoc_vien_id: 'hv-1',
      } as AuthenticatedUser);
      expect(res).toMatchObject({ noi_sinh_ten: 'An Giang' });
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

  describe('danhGiaDayDu / mucDoDayDuCuaToi — T9 Hồ sơ đầy đủ', () => {
    function baseHocVienDayDu(overrides: Record<string, unknown> = {}) {
      return {
        id: 'hv-1',
        ho_ten: 'Nguyễn Văn An',
        so_dinh_danh_ca_nhan: '123456789012',
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: namHopLe,
        noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
        noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
        noi_sinh_xa: 'Xã Long Xuyên (cũ)',
        cu_tru_tinh_id: null,
        cu_tru_phuong_xa_id: null,
        don_vi_cong_tac_id: 'truong-1',
        so_dien_thoai_lien_he: '0912345678',
        email_lien_he: 'an@example.com',
        trinh_do_chuyen_mon: 'dai_hoc',
        trinh_do_chuyen_mon_khac: null,
        cap_giang_day: null,
        mon_giang_day_id: null,
        doi_tuong: 'giao_vien',
        chuyen_mon: [
          { id: 'cm-1', hoc_vien_id: 'hv-1', chuyen_mon: 'Sư phạm Toán' },
        ],
        ...overrides,
      };
    }

    it('hồ sơ MOET vừa import (nhiều field NULL) -> day_du=false, liệt kê đủ trường thiếu', async () => {
      const hocVien = baseHocVienDayDu({
        so_dinh_danh_ca_nhan: null,
        email_lien_he: null,
        trinh_do_chuyen_mon: null,
        chuyen_mon: [],
      });
      const res = await service.danhGiaDayDu(hocVien as never);
      expect(res.day_du).toBe(false);
      const thieuFields = res.thieu.map((t) => t.field);
      expect(thieuFields).toEqual(
        expect.arrayContaining([
          'so_dinh_danh_ca_nhan',
          'email_lien_he',
          'trinh_do_chuyen_mon',
          'chuyen_mon',
        ]),
      );
    });

    it('T17: thiếu cả noi_sinh_tinh/huyen/xa nhưng đủ mọi field khác -> vẫn day_du=true (nơi sinh không còn tính vào đầy đủ)', async () => {
      const res = await service.danhGiaDayDu(
        baseHocVienDayDu({
          noi_sinh_tinh: null,
          noi_sinh_huyen: null,
          noi_sinh_xa: null,
        }) as never,
      );
      expect(res).toEqual({ day_du: true, thieu: [] });
    });

    it('bổ sung đủ mọi trường -> day_du=true', async () => {
      const res = await service.danhGiaDayDu(baseHocVienDayDu() as never);
      expect(res).toEqual({ day_du: true, thieu: [] });
    });

    it('2026-10-02: chưa chọn đối tượng (GV/CBQL) -> day_du=false, thiếu đúng doi_tuong', async () => {
      const res = await service.danhGiaDayDu(
        baseHocVienDayDu({ doi_tuong: null }) as never,
      );
      expect(res.day_du).toBe(false);
      expect(res.thieu).toEqual([
        {
          field: 'doi_tuong',
          message: 'Chưa chọn đối tượng (giáo viên hoặc cán bộ quản lý)',
        },
      ]);
    });

    describe('danhGiaDauVaoCuaToi — kênh đánh giá (2026-10-02)', () => {
      const caller = {
        id: 'nd-1',
        vai_tro: 'hoc_vien',
        hoc_vien_id: 'hv-1',
      } as AuthenticatedUser;

      it('kênh sso + hồ sơ đầy đủ -> đủ điều kiện, KHÔNG cần đợt 2 / xác nhận / tài khoản VLE, không trả link', async () => {
        cauHinhKhaoSatService.layKenhDanhGia.mockResolvedValue('sso');
        prisma.hoc_vien.findUnique.mockResolvedValue(baseHocVienDayDu());
        const res = await service.danhGiaDauVaoCuaToi(caller);
        expect(res).toEqual({ kenh: 'sso', du_dieu_kien: true });
        expect(
          dotXacNhanService.coXacNhanTruocDanhGiaConHieuLuc,
        ).not.toHaveBeenCalled();
      });

      it('kênh sso + hồ sơ thiếu -> chưa đủ điều kiện, ly_do liệt kê trường thiếu', async () => {
        cauHinhKhaoSatService.layKenhDanhGia.mockResolvedValue('sso');
        prisma.hoc_vien.findUnique.mockResolvedValue(
          baseHocVienDayDu({ doi_tuong: null }),
        );
        const res = await service.danhGiaDauVaoCuaToi(caller);
        expect(res).toEqual({
          kenh: 'sso',
          du_dieu_kien: false,
          ly_do: ['Chưa chọn đối tượng (giáo viên hoặc cán bộ quản lý)'],
        });
      });

      it('kênh vle -> giữ luồng cũ (cần xác nhận đợt 2), response gắn kenh', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseHocVienDayDu());
        const res = await service.danhGiaDauVaoCuaToi(caller);
        expect(res).toMatchObject({ kenh: 'vle', du_dieu_kien: false });
        expect((res as { ly_do: string[] }).ly_do).toContain(
          'Chưa xác nhận hồ sơ ở đợt xác nhận trước đánh giá (đợt 2)',
        );
      });
    });

    it('cu_tru_phuong_xa_id (tùy chọn, đã điền) không thuộc cu_tru_tinh_id -> vẫn day_du=false kèm lý do', async () => {
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
      const res = await service.danhGiaDayDu(
        baseHocVienDayDu({
          cu_tru_tinh_id: 'tinh-1',
          cu_tru_phuong_xa_id: 'xa-1',
        }) as never,
      );
      expect(res.day_du).toBe(false);
      expect(res.thieu.some((t) => t.field === 'cu_tru_phuong_xa_id')).toBe(
        true,
      );
    });

    it('không điền cư trú (tùy chọn, để trống) -> vẫn day_du=true', async () => {
      const res = await service.danhGiaDayDu(baseHocVienDayDu() as never);
      expect(res.day_du).toBe(true);
    });

    it('cảnh báo (canh_bao) không làm hồ sơ "chưa đầy đủ"', async () => {
      // Họ tên chữ cái đầu không viết hoa -> canh_bao (rule #4), không phải loi.
      const res = await service.danhGiaDayDu(
        baseHocVienDayDu({ ho_ten: 'nguyễn văn an' }) as never,
      );
      expect(res.day_du).toBe(true);
    });

    it('mucDoDayDuCuaToi -> lấy hồ sơ của caller rồi tái dùng danhGiaDayDu', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'hv-1') return baseHocVienDayDu();
        return null;
      });
      const caller = { hoc_vien_id: 'hv-1' } as AuthenticatedUser;
      const res = await service.mucDoDayDuCuaToi(caller);
      expect(res).toEqual({ day_du: true, thieu: [] });
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

    it('chuyen_mon rỗng sau khi tách -> hợp lệ (T4c, bổ sung sau)', async () => {
      await expect(
        service.checkValidMoetImportRow({ ...baseMoetInput(), chuyen_mon: [] }),
      ).resolves.toBeUndefined();
    });

    it('so_dien_thoai_lien_he thiếu (undefined) -> hợp lệ (T4c, bổ sung sau)', async () => {
      await expect(
        service.checkValidMoetImportRow({
          ...baseMoetInput(),
          so_dien_thoai_lien_he: undefined,
        }),
      ).resolves.toBeUndefined();
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

    // T4b (2026-09-29): mã CSDL MOET và CCCD không giả định trùng nhau, một
    // số trường không báo được mã CSDL MOET -> chỉ cần ÍT NHẤT 1 trong 2.
    it('chỉ có so_dinh_danh_ca_nhan (không có ma_dinh_danh_moet) -> không throw', async () => {
      const { ma_dinh_danh_moet: _bo, ...rest } = baseMoetInput();
      await expect(
        service.checkValidMoetImportRow({
          ...rest,
          so_dinh_danh_ca_nhan: '123456789012',
        }),
      ).resolves.toBeUndefined();
    });

    it('thiếu cả ma_dinh_danh_moet lẫn so_dinh_danh_ca_nhan -> ValidationException rõ lý do', async () => {
      expect.assertions(2);
      const { ma_dinh_danh_moet: _bo, ...rest } = baseMoetInput();
      try {
        await service.checkValidMoetImportRow(rest);
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationException);
        const body = (e as ValidationException).getResponse() as {
          error: { fields: { field: string; message: string }[] };
        };
        expect(body.error.fields).toContainEqual(
          expect.objectContaining({
            field: 'ma_dinh_danh_moet',
            message: expect.stringContaining(
              'Thiếu cả Mã định danh CSDL MOET và Số định danh cá nhân',
            ),
          }),
        );
      }
    });

    it('so_dinh_danh_ca_nhan sai định dạng (không đủ 12 số) -> lỗi', async () => {
      await expect(
        service.checkValidMoetImportRow({
          ...baseMoetInput(),
          so_dinh_danh_ca_nhan: '123',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('so_dinh_danh_ca_nhan đã tồn tại ở hồ sơ khác -> ValidationException', async () => {
      prisma.hoc_vien.findUnique.mockImplementation(({ where }) =>
        where.so_dinh_danh_ca_nhan ? { id: 'khac' } : null,
      );
      await expect(
        service.checkValidMoetImportRow({
          ...baseMoetInput(),
          so_dinh_danh_ca_nhan: '123456789012',
        }),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    // T4d (2026-09-30): bug thật phát hiện qua kiểm thử tay — 2 dòng trùng mã
    // TRONG CÙNG FILE đều "pass" ở preview (DB chưa ghi gì), chỉ lộ lỗi mới ở
    // bước xác nhận sau khi dòng đầu đã commit. dupKeys phải bắt được ngay ở
    // preview (dùng chung 1 Set cho cả lượt, giống ImportService.taoImport()).
    describe('dupKeys — phát hiện trùng nội bộ file (T4d)', () => {
      it('2 dòng cùng ma_dinh_danh_moet, DB chưa có gì -> dòng đầu qua, dòng 2 báo trùng trong file', async () => {
        const dupKeys = new Set<string>();
        await expect(
          service.checkValidMoetImportRow(baseMoetInput(), dupKeys),
        ).resolves.toBeUndefined();

        expect.assertions(3);
        try {
          await service.checkValidMoetImportRow(baseMoetInput(), dupKeys);
        } catch (e) {
          expect(e).toBeInstanceOf(ValidationException);
          const body = (e as ValidationException).getResponse() as {
            error: { fields: { field: string; message: string }[] };
          };
          expect(body.error.fields).toContainEqual(
            expect.objectContaining({
              field: 'ma_dinh_danh_moet',
              message: expect.stringContaining('trùng'),
            }),
          );
        }
      });

      it('2 dòng cùng so_dinh_danh_ca_nhan, DB chưa có gì -> dòng đầu qua, dòng 2 báo trùng trong file', async () => {
        const { ma_dinh_danh_moet: _bo, ...rest } = baseMoetInput();
        const input = { ...rest, so_dinh_danh_ca_nhan: '123456789012' };
        const dupKeys = new Set<string>();
        await expect(
          service.checkValidMoetImportRow(input, dupKeys),
        ).resolves.toBeUndefined();

        expect.assertions(3);
        try {
          await service.checkValidMoetImportRow(input, dupKeys);
        } catch (e) {
          expect(e).toBeInstanceOf(ValidationException);
          const body = (e as ValidationException).getResponse() as {
            error: { fields: { field: string; message: string }[] };
          };
          expect(body.error.fields).toContainEqual(
            expect.objectContaining({
              field: 'so_dinh_danh_ca_nhan',
              message: expect.stringContaining('trùng'),
            }),
          );
        }
      });

      it('2 dòng khác ma_dinh_danh_moet -> cả 2 đều hợp lệ (hồi quy, không báo trùng sai)', async () => {
        const dupKeys = new Set<string>();
        await expect(
          service.checkValidMoetImportRow(baseMoetInput(), dupKeys),
        ).resolves.toBeUndefined();
        await expect(
          service.checkValidMoetImportRow(
            { ...baseMoetInput(), ma_dinh_danh_moet: 'MOET-002' },
            dupKeys,
          ),
        ).resolves.toBeUndefined();
      });
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

    // T4b (2026-09-29): dòng chỉ có CCCD (không có mã MOET) -> tạo hồ sơ
    // thành công, ten_dang_nhap = CCCD.
    it('chỉ có so_dinh_danh_ca_nhan (không có ma_dinh_danh_moet) -> ten_dang_nhap = CCCD', async () => {
      const txNguoiDung = { create: jest.fn(), update: jest.fn() };
      const txHocVien = { create: jest.fn(), update: jest.fn() };
      txHocVien.create.mockResolvedValue({ id: 'hv-2' });
      txNguoiDung.create.mockResolvedValue({
        id: 'nd-2',
        ten_dang_nhap: '123456789012',
      });
      txHocVien.update.mockResolvedValue({ id: 'hv-2' });
      prisma.$transaction.mockImplementation(async (cb) =>
        cb({ nguoi_dung: txNguoiDung, hoc_vien: txHocVien }),
      );

      await service.createFromMoetImport(
        {
          so_dinh_danh_ca_nhan: '123456789012',
          ho_ten: 'Trần Thị Bình',
          ngay_sinh: 10,
          thang_sinh: 3,
          nam_sinh: namHopLe,
          so_dien_thoai_lien_he: '0912345678',
          chuyen_mon: ['Toán'],
          don_vi_cong_tac_id: 'truong-1',
        },
        'quan-tri-1',
      );

      expect(txHocVien.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          ma_dinh_danh_moet: undefined,
          so_dinh_danh_ca_nhan: '123456789012',
        }),
      );
      expect(txNguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ten_dang_nhap: '123456789012' }),
        }),
      );
    });

    it('có cả 2 mã -> ten_dang_nhap ưu tiên ma_dinh_danh_moet, vẫn lưu so_dinh_danh_ca_nhan', async () => {
      const txNguoiDung = { create: jest.fn(), update: jest.fn() };
      const txHocVien = { create: jest.fn(), update: jest.fn() };
      txHocVien.create.mockResolvedValue({ id: 'hv-3' });
      txNguoiDung.create.mockResolvedValue({ id: 'nd-3' });
      txHocVien.update.mockResolvedValue({ id: 'hv-3' });
      prisma.$transaction.mockImplementation(async (cb) =>
        cb({ nguoi_dung: txNguoiDung, hoc_vien: txHocVien }),
      );

      await service.createFromMoetImport(
        {
          ma_dinh_danh_moet: 'MOET-002',
          so_dinh_danh_ca_nhan: '123456789012',
          ho_ten: 'Trần Thị Bình',
          ngay_sinh: 10,
          thang_sinh: 3,
          nam_sinh: namHopLe,
          so_dien_thoai_lien_he: '0912345678',
          chuyen_mon: ['Toán'],
          don_vi_cong_tac_id: 'truong-1',
        },
        'quan-tri-1',
      );

      expect(txHocVien.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({
          ma_dinh_danh_moet: 'MOET-002',
          so_dinh_danh_ca_nhan: '123456789012',
        }),
      );
      expect(txNguoiDung.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ten_dang_nhap: 'MOET-002' }),
        }),
      );
    });
  });

  describe('T14 — đợt xác nhận & lịch sử thay đổi hồ sơ', () => {
    function baseImportMoetHocVien(overrides: Record<string, unknown> = {}) {
      return {
        id: 'hv-moet-1',
        nguon_tao: 'import_moet',
        trang_thai: 'da_duyet',
        ho_ten: 'Nguyễn Văn Cũ',
        so_dinh_danh_ca_nhan: null,
        ngay_sinh: 15,
        thang_sinh: 6,
        nam_sinh: namHopLe,
        noi_sinh_tinh: null,
        noi_sinh_huyen: null,
        noi_sinh_xa: null,
        don_vi_cong_tac_id: 'truong-1',
        chuc_vu: 'Giáo viên',
        so_dien_thoai_lien_he: '0912345678',
        email_lien_he: null,
        trinh_do_chuyen_mon: null,
        trinh_do_chuyen_mon_khac: null,
        cap_giang_day: null,
        mon_giang_day_id: null,
        chuyen_mon: [
          { id: 'cm-1', hoc_vien_id: 'hv-moet-1', chuyen_mon: 'Toán' },
        ],
        ...overrides,
      };
    }

    const callerHocVien = {
      id: 'nd-hv-1',
      vai_tro: 'hoc_vien',
      hoc_vien_id: 'hv-moet-1',
    } as AuthenticatedUser;

    describe('capNhatHoSoCuaToi — import_moet', () => {
      it('KHÔNG có đợt đang mở -> DotXacNhanDongException, không update', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue(null);

        await expect(
          service.capNhatHoSoCuaToi(callerHocVien, { chuc_vu: 'Nhân viên' }),
        ).rejects.toBeInstanceOf(DotXacNhanDongException);
        expect(prisma.hoc_vien.update).not.toHaveBeenCalled();
      });

      it('CÓ đợt đang mở, sửa ho_ten + chuc_vu -> 2 dòng lịch sử, la_truong_goc_moet=true cả 2, dot_id đúng đợt', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
        });
        prisma.hoc_vien.update.mockResolvedValue({
          ...baseImportMoetHocVien({
            ho_ten: 'Nguyễn Văn Mới',
            chuc_vu: 'Nhân viên',
          }),
        });
        dotXacNhanService.huyXacNhanNeuCo.mockResolvedValue(false);

        const res = await service.capNhatHoSoCuaToi(callerHocVien, {
          ho_ten: 'Nguyễn Văn Mới',
          chuc_vu: 'Nhân viên',
        });

        expect(prisma.lich_su_thay_doi_ho_so.createMany).toHaveBeenCalledWith({
          data: expect.arrayContaining([
            expect.objectContaining({
              truong: 'ho_ten',
              gia_tri_cu: 'Nguyễn Văn Cũ',
              gia_tri_moi: 'Nguyễn Văn Mới',
              la_truong_goc_moet: true,
              dot_id: 'dot-1',
            }),
            expect.objectContaining({
              truong: 'chuc_vu',
              gia_tri_cu: 'Giáo viên',
              gia_tri_moi: 'Nhân viên',
              la_truong_goc_moet: true,
              dot_id: 'dot-1',
            }),
          ]),
        });
        expect(
          (
            prisma.lich_su_thay_doi_ho_so.createMany.mock.calls[0][0] as {
              data: unknown[];
            }
          ).data,
        ).toHaveLength(2);
        expect(dotXacNhanService.huyXacNhanNeuCo).toHaveBeenCalledWith(
          prisma,
          'dot-1',
          'hv-moet-1',
        );
        expect(res.xac_nhan_bi_huy).toBe(false);
      });

      it('gửi field trùng giá trị cũ -> không tạo dòng lịch sử nào (diff rỗng)', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
        });
        prisma.hoc_vien.update.mockResolvedValue(baseImportMoetHocVien());

        await service.capNhatHoSoCuaToi(callerHocVien, {
          chuc_vu: 'Giáo viên', // giá trị y hệt cũ
        });

        expect(prisma.lich_su_thay_doi_ho_so.createMany).not.toHaveBeenCalled();
        expect(dotXacNhanService.huyXacNhanNeuCo).not.toHaveBeenCalled();
      });

      it('sửa so_dinh_danh_ca_nhan (CCCD, không thuộc trường gốc MOET) -> ghi lịch sử nhưng la_truong_goc_moet=false', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
        });
        prisma.hoc_vien.update.mockResolvedValue(
          baseImportMoetHocVien({ so_dinh_danh_ca_nhan: '123456789012' }),
        );

        await service.capNhatHoSoCuaToi(callerHocVien, {
          so_dinh_danh_ca_nhan: '123456789012',
        });

        expect(prisma.lich_su_thay_doi_ho_so.createMany).toHaveBeenCalledWith({
          data: [
            expect.objectContaining({
              truong: 'so_dinh_danh_ca_nhan',
              la_truong_goc_moet: false,
            }),
          ],
        });
      });
    });

    describe('capNhatHoSoCuaToi — tu_dang_ky (không đổi hành vi T14)', () => {
      it('trang_thai=nhap -> sửa được, KHÔNG ghi lịch sử (rule T14 chỉ áp dụng import_moet)', async () => {
        const hv = {
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          trang_thai: 'nhap',
          ho_ten: 'Học Viên Tự Đăng Ký',
          so_dinh_danh_ca_nhan: '999999999999',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: namHopLe,
          noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
          noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
          noi_sinh_xa: 'Xã Long Xuyên (cũ)',
          don_vi_cong_tac_id: 'truong-1',
          so_dien_thoai_lien_he: '0912345678',
          email_lien_he: 'a@test.local',
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: [],
        };
        prisma.hoc_vien.findUnique.mockResolvedValue(hv);
        prisma.hoc_vien.update.mockResolvedValue({
          ...hv,
          so_dien_thoai_lien_he: '0987654321',
        });

        await service.capNhatHoSoCuaToi(
          { hoc_vien_id: 'hv-tdk-1' } as AuthenticatedUser,
          { so_dien_thoai_lien_he: '0987654321' },
        );

        expect(dotXacNhanService.dotDangMoCuaHocVien).not.toHaveBeenCalled();
        expect(prisma.lich_su_thay_doi_ho_so.createMany).not.toHaveBeenCalled();
      });
    });

    // 2026-09-30: đổi email_lien_he (PATCH /hoc-vien/toi) reset
    // email_da_xac_minh=false + gửi lại email xác minh tới địa chỉ mới.
    describe('capNhatHoSoCuaToi — đổi email_lien_he (xác minh lại, 2026-09-30)', () => {
      function hvTuDangKy(overrides: Record<string, unknown> = {}) {
        return {
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          trang_thai: 'nhap',
          ho_ten: 'Học Viên Tự Đăng Ký',
          so_dinh_danh_ca_nhan: '999999999999',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: namHopLe,
          noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
          noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
          noi_sinh_xa: 'Xã Long Xuyên (cũ)',
          don_vi_cong_tac_id: 'truong-1',
          so_dien_thoai_lien_he: '0912345678',
          email_lien_he: 'cu@test.local',
          email_da_xac_minh: true,
          trinh_do_chuyen_mon: 'dai_hoc',
          chuyen_mon: [],
          ...overrides,
        };
      }
      const callerTuDangKy = { hoc_vien_id: 'hv-tdk-1' } as AuthenticatedUser;

      it('đổi sang email mới -> update email_da_xac_minh=false, tạo token_xac_thuc, gửi email xác minh tới email MỚI', async () => {
        const hv = hvTuDangKy();
        prisma.hoc_vien.findUnique.mockResolvedValue(hv);
        prisma.hoc_vien.update.mockResolvedValue({
          ...hv,
          email_lien_he: 'moi@test.local',
        });

        await service.capNhatHoSoCuaToi(callerTuDangKy, {
          email_lien_he: 'moi@test.local',
        });

        expect(prisma.hoc_vien.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email_lien_he: 'moi@test.local',
              email_da_xac_minh: false,
            }),
          }),
        );
        expect(prisma.token_xac_thuc.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              hoc_vien_id: 'hv-tdk-1',
              loai: 'xac_minh_email',
            }),
          }),
        );
        expect(thongBaoService.guiXacMinhEmail).toHaveBeenCalledWith(
          'moi@test.local',
          expect.any(String),
          expect.stringContaining('/xac-minh-email?token='),
          'hv-tdk-1',
        );
      });

      it('gửi lại email_lien_he y hệt cũ -> KHÔNG reset email_da_xac_minh, không tạo token/gửi email', async () => {
        const hv = hvTuDangKy();
        prisma.hoc_vien.findUnique.mockResolvedValue(hv);
        prisma.hoc_vien.update.mockResolvedValue(hv);

        await service.capNhatHoSoCuaToi(callerTuDangKy, {
          email_lien_he: 'cu@test.local',
        });

        expect(prisma.hoc_vien.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ email_da_xac_minh: undefined }),
          }),
        );
        expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
        expect(thongBaoService.guiXacMinhEmail).not.toHaveBeenCalled();
      });

      it('sửa trường khác (không đụng email_lien_he) -> không reset email_da_xac_minh, không gửi email', async () => {
        const hv = hvTuDangKy();
        prisma.hoc_vien.findUnique.mockResolvedValue(hv);
        prisma.hoc_vien.update.mockResolvedValue({
          ...hv,
          so_dien_thoai_lien_he: '0987654321',
        });

        await service.capNhatHoSoCuaToi(callerTuDangKy, {
          so_dien_thoai_lien_he: '0987654321',
        });

        expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
        expect(thongBaoService.guiXacMinhEmail).not.toHaveBeenCalled();
      });
    });

    describe('guiLaiXacMinhEmail — POST /hoc-vien/toi/gui-lai-xac-minh-email (2026-09-30)', () => {
      const callerTuDangKy = { hoc_vien_id: 'hv-tdk-1' } as AuthenticatedUser;

      it('chưa có email_lien_he -> ValidationException', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue({
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          email_lien_he: null,
          email_da_xac_minh: false,
          chuyen_mon: [],
        });
        await expect(
          service.guiLaiXacMinhEmail(callerTuDangKy),
        ).rejects.toBeInstanceOf(ValidationException);
        expect(prisma.token_xac_thuc.create).not.toHaveBeenCalled();
      });

      it('email đã xác minh rồi -> ConflictAppException', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue({
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          email_lien_he: 'a@test.local',
          email_da_xac_minh: true,
          chuyen_mon: [],
        });
        await expect(
          service.guiLaiXacMinhEmail(callerTuDangKy),
        ).rejects.toBeInstanceOf(ConflictAppException);
      });

      it('vừa gửi (token còn hiệu lực tạo dưới 60 giây trước) -> 429, không gửi lại', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue({
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          email_lien_he: 'a@test.local',
          email_da_xac_minh: false,
          chuyen_mon: [],
        });
        prisma.token_xac_thuc.findFirst.mockResolvedValue({
          id: 'tok-gan-day',
        });

        await expect(
          service.guiLaiXacMinhEmail(callerTuDangKy),
        ).rejects.toThrow();
        expect(thongBaoService.guiXacMinhEmail).not.toHaveBeenCalled();
      });

      it('chưa xác minh, chưa gửi gần đây -> tạo token mới + gửi email', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue({
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          ho_ten: 'Học Viên Tự Đăng Ký',
          email_lien_he: 'a@test.local',
          email_da_xac_minh: false,
          chuyen_mon: [],
        });

        const res = await service.guiLaiXacMinhEmail(callerTuDangKy);
        expect(res).toEqual({ da_gui: true });
        expect(prisma.token_xac_thuc.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              hoc_vien_id: 'hv-tdk-1',
              loai: 'xac_minh_email',
            }),
          }),
        );
        expect(thongBaoService.guiXacMinhEmail).toHaveBeenCalledWith(
          'a@test.local',
          'Học Viên Tự Đăng Ký',
          expect.stringContaining('/xac-minh-email?token='),
          'hv-tdk-1',
        );
      });
    });

    describe('POST /hoc-vien/toi/xac-nhan — import_moet', () => {
      it('KHÔNG có đợt đang mở -> DotXacNhanDongException', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue(null);

        await expect(service.xacNhan(callerHocVien)).rejects.toBeInstanceOf(
          DotXacNhanDongException,
        );
        expect(dotXacNhanService.taoXacNhan).not.toHaveBeenCalled();
      });

      it('có đợt mở nhưng hồ sơ CHƯA đầy đủ -> ValidationException, không tạo xác nhận', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
        });

        await expect(service.xacNhan(callerHocVien)).rejects.toBeInstanceOf(
          ValidationException,
        );
        expect(dotXacNhanService.taoXacNhan).not.toHaveBeenCalled();
      });

      it('có đợt mở + hồ sơ đầy đủ -> taoXacNhan được gọi, gửi email, KHÔNG đổi trang_thai', async () => {
        const hocVienDayDu = baseImportMoetHocVien({
          so_dinh_danh_ca_nhan: '123456789012',
          noi_sinh_tinh: 'Tỉnh An Giang (cũ)',
          noi_sinh_huyen: 'Huyện Châu Thành (cũ)',
          noi_sinh_xa: 'Xã Long Xuyên (cũ)',
          email_lien_he: 'du@test.local',
          trinh_do_chuyen_mon: 'dai_hoc',
          doi_tuong: 'can_bo_quan_ly',
        });
        prisma.hoc_vien.findUnique.mockResolvedValue(hocVienDayDu);
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
        });
        prisma.hoc_vien.update.mockResolvedValue(hocVienDayDu);

        await service.xacNhan(callerHocVien);

        expect(dotXacNhanService.taoXacNhan).toHaveBeenCalledWith(
          prisma,
          'dot-1',
          'hv-moet-1',
          expect.any(Object),
        );
        expect(thongBaoService.guiHocVienXacNhan).toHaveBeenCalledWith(
          'hv-moet-1',
        );
        expect(prisma.hoc_vien.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'hv-moet-1' },
            data: expect.objectContaining({
              email_ban_sao_da_gui_at: expect.any(Date),
            }),
          }),
        );
      });
    });

    describe('POST /hoc-vien/toi/xac-nhan — import_moet đã xác nhận (2026-10-05)', () => {
      it('đã có xác nhận còn hiệu lực ở đợt đang mở -> 409, không tạo xác nhận mới', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
        });
        dotXacNhanService.coXacNhanConHieuLuc.mockResolvedValue(true);
        await expect(service.xacNhan(callerHocVien)).rejects.toBeInstanceOf(
          ConflictAppException,
        );
        expect(dotXacNhanService.taoXacNhan).not.toHaveBeenCalled();
      });
    });

    describe('dotXacNhanCuaToi', () => {
      it('tu_dang_ky -> dot=null, dang_mo=false', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue({
          id: 'hv-tdk-1',
          nguon_tao: 'tu_dang_ky',
          trang_thai: 'nhap',
          so_dinh_danh_ca_nhan: '999999999999',
          ngay_sinh: 1,
          thang_sinh: 1,
          nam_sinh: namHopLe,
          don_vi_cong_tac_id: 'truong-1',
          so_dien_thoai_lien_he: '0912345678',
          chuyen_mon: [],
        });
        const res = await service.dotXacNhanCuaToi({
          hoc_vien_id: 'hv-tdk-1',
        } as AuthenticatedUser);
        expect(res.dot).toBeNull();
        expect(res.dang_mo).toBe(false);
        expect(res.ap_dung_dot).toBe(false);
      });

      it('import_moet, có đợt đang mở, chưa xác nhận -> dang_mo=true, da_xac_nhan=false', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue({
          id: 'dot-1',
          ten: 'Đợt 1',
          loai: 'kiem_tra_bo_sung',
          mo_luc: new Date('2026-10-01'),
          dong_luc: new Date('2026-10-05'),
        });

        const res = await service.dotXacNhanCuaToi(callerHocVien);
        expect(res.dang_mo).toBe(true);
        expect(res.da_xac_nhan).toBe(false);
        expect(res.can_xac_nhan_lai).toBe(false);
        expect(res.dot?.id).toBe('dot-1');
      });

      const dotMo = {
        id: 'dot-1',
        ten: 'Đợt 1',
        loai: 'kiem_tra_bo_sung',
        mo_luc: new Date('2026-10-01'),
        dong_luc: new Date('2026-10-05'),
      };

      it('đã xác nhận (còn hiệu lực) -> da_xac_nhan=true kèm thời điểm, không cần xác nhận lại', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue(dotMo);
        const luc = new Date('2026-10-03T02:00:00Z');
        dotXacNhanService.trangThaiXacNhanTrongDot.mockResolvedValue({
          conHieuLuc: { xac_nhan_luc: luc },
          biHuyGanNhat: { vo_hieu_luc_luc: new Date('2026-10-02') },
        });
        const res = await service.dotXacNhanCuaToi(callerHocVien);
        expect(res).toMatchObject({
          da_xac_nhan: true,
          xac_nhan_luc: luc,
          can_xac_nhan_lai: false,
          dieu_chinh_luc: null,
        });
      });

      it('đã xác nhận rồi sửa hồ sơ (xác nhận bị hủy) -> can_xac_nhan_lai=true + thời điểm điều chỉnh', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue(dotMo);
        const luc = new Date('2026-10-04T03:00:00Z');
        dotXacNhanService.trangThaiXacNhanTrongDot.mockResolvedValue({
          conHieuLuc: null,
          biHuyGanNhat: { vo_hieu_luc_luc: luc },
        });
        const res = await service.dotXacNhanCuaToi(callerHocVien);
        expect(res).toMatchObject({
          da_xac_nhan: false,
          can_xac_nhan_lai: true,
          dieu_chinh_luc: luc,
        });
      });

      it('không có đợt mở, đã xác nhận ở đợt trước -> dot=null, trả xac_nhan_gan_nhat', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue(null);
        const luc = new Date('2026-10-03T02:00:00Z');
        dotXacNhanService.xacNhanConHieuLucGanNhat.mockResolvedValue({
          xac_nhan_luc: luc,
          dot: { ten: 'Đợt 1' },
        });
        const res = await service.dotXacNhanCuaToi(callerHocVien);
        expect(res).toMatchObject({
          dot: null,
          dang_mo: false,
          ap_dung_dot: true,
          xac_nhan_gan_nhat: { dot_ten: 'Đợt 1', xac_nhan_luc: luc },
        });
      });

      it('import_moet, KHÔNG có đợt đang mở nhưng có đợt sắp mở -> dot=null, dot_sap_mo = đợt sắp mở', async () => {
        prisma.hoc_vien.findUnique.mockResolvedValue(baseImportMoetHocVien());
        dotXacNhanService.dotDangMoCuaHocVien.mockResolvedValue(null);
        dotXacNhanService.dotSapMoCuaHocVien.mockResolvedValue({
          id: 'dot-sap-mo',
          ten: 'Đợt 2',
          loai: 'xac_nhan_truoc_danh_gia',
          mo_luc: new Date('2026-11-01'),
          dong_luc: new Date('2026-11-05'),
        });

        const res = await service.dotXacNhanCuaToi(callerHocVien);
        expect(res.dang_mo).toBe(false);
        expect(res.da_xac_nhan).toBe(false);
        expect(res.dot).toBeNull();
        expect(res.dot_sap_mo).toEqual({
          ten: 'Đợt 2',
          mo_luc: new Date('2026-11-01'),
        });
      });
    });
  });
});
