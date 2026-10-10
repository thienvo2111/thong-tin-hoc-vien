import { Prisma } from '@prisma/client';
import {
  KetQuaKhaoSatService,
  NGUONG_CAN_KIEM_TRA_MS,
} from './ket-qua-khao-sat.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundAppException,
  SsoChuaCauHinhException,
  UnauthorizedAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import { kiemTraApiKeyKhaoSat } from './sso-api-key';
import { ThangMucService } from './thang-muc.service';
import { HOC_VIEN_PHAI_KHAO_SAT } from '../common/utils/doi-tuong-khao-sat.util';

// Mô phỏng tối giản ngữ nghĩa Prisma cho đúng hình dạng where dùng ở đây
// (AND[ {OR:[{doi_tuong:null},{doi_tuong:{notIn}}]}, ... ]) — KHÔNG dùng lại
// phaiKhaoSat() để test độc lập với cách service dựng where.
function khopDieuKienDoiTuong(
  doiTuong: string | null,
  where: Prisma.hoc_vienWhereInput,
): boolean {
  const and = (where.AND as Prisma.hoc_vienWhereInput[]) ?? [where];
  return and.every((dk) => {
    if (!dk.OR) return true;
    return dk.OR.some((o) => {
      const dt = (o as { doi_tuong?: unknown }).doi_tuong;
      if (dt === null) return doiTuong === null;
      if (dt && typeof dt === 'object' && 'notIn' in dt) {
        return !(dt.notIn as string[]).includes(doiTuong as string);
      }
      return false;
    });
  });
}

describe('KetQuaKhaoSatService', () => {
  let service: KetQuaKhaoSatService;
  let prisma: {
    ket_qua_khao_sat: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      groupBy: jest.Mock;
    };
    hoc_vien: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    cau_hinh_he_thong: { findUnique: jest.Mock };
  };

  const dong = (over: Record<string, unknown> = {}) => ({
    id: 'kq-1',
    hoc_vien_id: 'hv-1',
    loai: 'khao-sat',
    trang_thai: 'da_mo',
    so_lan_mo: 1,
    mo_lan_dau_luc: new Date(),
    mo_gan_nhat_luc: new Date(),
    bat_dau_luc: null,
    hoan_thanh_luc: null,
    muc: null,
    diem: null,
    diem_toi_da: null,
    muc_goc: null,
    url_ket_qua: null,
    chi_tiet: null,
    nguon: 'sso',
    cap_nhat_luc: new Date(),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      ket_qua_khao_sat: {
        upsert: jest.fn().mockImplementation(async (args) => ({
          ...dong(),
          ...args.create,
          ...args.update,
        })),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      hoc_vien: {
        findUnique: jest.fn().mockResolvedValue({ id: 'hv-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'hv-1', chinh_xac: true }]),
      cau_hinh_he_thong: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    service = new KetQuaKhaoSatService(
      prisma as unknown as PrismaService,
      new ThangMucService(prisma as unknown as PrismaService),
    );
  });

  describe('ghiDaMo (khi đổi mã SSO)', () => {
    it('lần đầu -> tạo dòng da_mo, so_lan_mo=1, nguồn sso', async () => {
      await service.ghiDaMo('hv-1', 'danh-gia');
      const args = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(args.where.hoc_vien_id_loai).toEqual({
        hoc_vien_id: 'hv-1',
        loai: 'danh-gia',
      });
      expect(args.create).toMatchObject({
        trang_thai: 'da_mo',
        so_lan_mo: 1,
        nguon: 'sso',
      });
      expect(args.create.mo_lan_dau_luc).toBeInstanceOf(Date);
    });

    it('đã có dòng -> chỉ tăng số lần mở, KHÔNG đổi trạng thái (không hạ hoàn thành về đã mở)', async () => {
      await service.ghiDaMo('hv-1', 'khao-sat');
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update.so_lan_mo).toEqual({ increment: 1 });
      expect(update.mo_gan_nhat_luc).toBeInstanceOf(Date);
      expect(update).not.toHaveProperty('trang_thai');
    });

    it('DB lỗi -> nuốt lỗi, không làm hỏng đăng nhập SSO', async () => {
      prisma.ket_qua_khao_sat.upsert.mockRejectedValue(new Error('db'));
      await expect(service.ghiDaMo('hv-1', 'khao-sat')).resolves.toBe(
        undefined,
      );
    });
  });

  describe('nhanKetQua (POST /sso/ket-qua)', () => {
    it('xác định học viên theo hoc_vien_id', async () => {
      await service.nhanKetQua({
        hoc_vien_id: '11111111-1111-1111-1111-111111111111',
        loai: 'khao-sat',
        trang_thai: 'dang_lam',
      });
      expect(prisma.hoc_vien.findUnique.mock.calls[0][0].where).toEqual({
        id: '11111111-1111-1111-1111-111111111111',
      });
    });

    it('xác định học viên theo mã MOET (cắt khoảng trắng)', async () => {
      await service.nhanKetQua({
        ma_dinh_danh_moet: ' 9115131060 ',
        loai: 'khao-sat',
        trang_thai: 'dang_lam',
      });
      const sql = prisma.$queryRaw.mock.calls[0][0] as { values: unknown[] };
      expect(sql.values[0]).toBe('9115131060');
      expect(prisma.ket_qua_khao_sat.upsert.mock.calls[0][0].where).toEqual({
        hoc_vien_id_loai: { hoc_vien_id: 'hv-1', loai: 'khao-sat' },
      });
    });

    // Spec 2026-10-09 Q-A: hệ thống khảo sát gửi mã mất số 0 đầu vẫn khớp.
    it('mã lệch số 0 đầu khớp đúng 1 học viên -> ghi cho học viên đó', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'hv-7', chinh_xac: false }]);
      const kq = await service.nhanKetQua({
        ma_dinh_danh_moet: '115131060',
        loai: 'khao-sat',
        trang_thai: 'dang_lam',
      });
      expect(kq.hoc_vien_id).toBe('hv-7');
    });

    it('thiếu cả 2 định danh -> 400, không ghi', async () => {
      await expect(
        service.nhanKetQua({ loai: 'khao-sat', trang_thai: 'dang_lam' }),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
    });

    it('không tìm thấy học viên -> 404, không ghi', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(
        service.nhanKetQua({
          ma_dinh_danh_moet: 'khong-co',
          loai: 'khao-sat',
          trang_thai: 'hoan_thanh',
        }),
      ).rejects.toBeInstanceOf(NotFoundAppException);
      expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
    });

    it('hoàn thành -> lưu mức, điểm, chi tiết, thời điểm báo; nguồn api; trả gọn không kèm điểm', async () => {
      const kq = await service.nhanKetQua({
        hoc_vien_id: 'hv-1',
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        thoi_diem: '2026-10-04T08:00:00.000Z',
        muc: 'thanh_thao',
        diem: 72.5,
        chi_tiet: { mien_1: 8 },
      });
      const { create, update } =
        prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update).toMatchObject({
        trang_thai: 'hoan_thanh',
        muc: 'thanh_thao',
        diem: 72.5,
        chi_tiet: { mien_1: 8 },
        nguon: 'api',
      });
      expect(update.hoan_thanh_luc.toISOString()).toBe(
        '2026-10-04T08:00:00.000Z',
      );
      expect(create.loai).toBe('danh-gia');
      expect(kq).toEqual({
        hoc_vien_id: 'hv-1',
        loai: 'danh-gia',
        trang_thai: 'hoan_thanh',
        muc: 'thanh_thao',
        muc_goc: null,
      });
    });
  });

  describe('ghiKetQua — điểm tối đa (2026-10-05)', () => {
    it('hoàn thành kèm diem_toi_da -> lưu cả 2', async () => {
      await service.ghiKetQua(
        'hv-1',
        {
          loai: 'danh-gia',
          trang_thai: 'hoan_thanh',
          diem: 13.75,
          diem_toi_da: 44,
        },
        'api',
      );
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update).toMatchObject({ diem: 13.75, diem_toi_da: 44 });
    });

    it('điểm lớn hơn điểm tối đa -> 400, không ghi', async () => {
      await expect(
        service.ghiKetQua(
          'hv-1',
          {
            loai: 'danh-gia',
            trang_thai: 'hoan_thanh',
            diem: 50,
            diem_toi_da: 44,
          },
          'api',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
    });
  });

  describe('ghiKetQua — mức gốc + đường dẫn kết quả (2026-10-05)', () => {
    const envGoc = { ...process.env };
    afterEach(() => {
      process.env = { ...envGoc };
    });

    it('lưu nhãn mức gốc và url cùng tên miền hệ thống khảo sát', async () => {
      process.env.SSO_KHAO_SAT_URL = 'https://khaosat.test/sso/start';
      await service.ghiKetQua(
        'hv-1',
        {
          loai: 'danh-gia',
          trang_thai: 'hoan_thanh',
          muc_goc: 'M1',
          url_ket_qua: 'https://khaosat.test/ket-qua/abc',
        },
        'api',
      );
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update).toMatchObject({
        muc_goc: 'M1',
        url_ket_qua: 'https://khaosat.test/ket-qua/abc',
      });
    });

    it.each([
      'https://trang-la.example/ket-qua',
      'javascript:alert(1)',
      'khong-phai-url',
    ])(
      'url %p không thuộc tên miền khảo sát -> 400, không ghi',
      async (url) => {
        process.env.SSO_KHAO_SAT_URL = 'https://khaosat.test/sso/start';
        await expect(
          service.ghiKetQua(
            'hv-1',
            { loai: 'danh-gia', trang_thai: 'hoan_thanh', url_ket_qua: url },
            'api',
          ),
        ).rejects.toBeInstanceOf(ValidationException);
        expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
      },
    );

    it('không đặt SSO_KHAO_SAT_URL -> chấp nhận tên miền mặc định khaosatnls.hcmue.edu.vn', async () => {
      delete process.env.SSO_KHAO_SAT_URL;
      await service.ghiKetQua(
        'hv-1',
        {
          loai: 'danh-gia',
          trang_thai: 'hoan_thanh',
          url_ket_qua: 'https://khaosatnls.hcmue.edu.vn/surveys/x',
        },
        'api',
      );
      expect(prisma.ket_qua_khao_sat.upsert).toHaveBeenCalled();
    });

    it('học viên thấy mức gốc + url, vẫn không thấy điểm', async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        dong({
          loai: 'danh-gia',
          trang_thai: 'hoan_thanh',
          muc: 'co_ban',
          muc_goc: 'M1',
          url_ket_qua: 'https://khaosat.test/ket-qua/abc',
          diem: new Prisma.Decimal('13.75'),
        }),
      ]);
      const [, danhGia] = await service.tinhTrangCuaHocVien('hv-1');
      expect(danhGia).toMatchObject({
        muc_goc: 'M1',
        url_ket_qua: 'https://khaosat.test/ket-qua/abc',
      });
      expect(danhGia).not.toHaveProperty('diem');
    });
  });

  describe('mức gốc theo thang quản trị cấu hình', () => {
    it('mã không có trong thang -> 400, không ghi', async () => {
      await expect(
        service.ghiKetQua(
          'hv-1',
          { loai: 'danh-gia', trang_thai: 'hoan_thanh', muc_goc: 'M5' },
          'api',
        ),
      ).rejects.toBeInstanceOf(ValidationException);
      expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
    });

    it('thang tự cấu hình -> nhận mã mới, trả nhãn mới cho học viên', async () => {
      prisma.cau_hinh_he_thong.findUnique.mockResolvedValue({
        gia_tri: [{ ma: 'A', nhan: 'Tốt' }],
        cap_nhat_luc: new Date(),
      });
      await service.ghiKetQua(
        'hv-1',
        { loai: 'danh-gia', trang_thai: 'hoan_thanh', muc_goc: 'A' },
        'api',
      );
      expect(prisma.ket_qua_khao_sat.upsert).toHaveBeenCalled();

      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        dong({ loai: 'danh-gia', trang_thai: 'hoan_thanh', muc_goc: 'A' }),
      ]);
      const [, danhGia] = await service.tinhTrangCuaHocVien('hv-1');
      expect(danhGia.nhan_muc_goc).toBe('A – Tốt');
    });

    it('mặc định: học viên nhận nhãn "M1 – Chưa đạt"', async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        dong({ loai: 'khao-sat', trang_thai: 'hoan_thanh', muc_goc: 'M1' }),
      ]);
      const [khaoSat] = await service.tinhTrangCuaHocVien('hv-1');
      expect(khaoSat.nhan_muc_goc).toBe('M1 – Chưa đạt');
    });
  });

  describe('ghiKetQua — quy tắc gộp', () => {
    it('đang làm sau khi đã hoàn thành -> bỏ qua, giữ kết quả cũ', async () => {
      const cu = dong({
        trang_thai: 'hoan_thanh',
        hoan_thanh_luc: new Date('2026-10-04T08:00:00Z'),
        muc: 'nang_cao',
      });
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(cu);
      const kq = await service.ghiKetQua(
        'hv-1',
        { loai: 'khao-sat', trang_thai: 'dang_lam' },
        'api',
      );
      expect(kq).toBe(cu);
      expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
    });

    it('hoàn thành đến trễ (cũ hơn lần hoàn thành đã ghi) -> bỏ qua', async () => {
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        dong({
          trang_thai: 'hoan_thanh',
          hoan_thanh_luc: new Date('2026-10-04T08:00:00Z'),
        }),
      );
      await service.ghiKetQua(
        'hv-1',
        {
          loai: 'khao-sat',
          trang_thai: 'hoan_thanh',
          thoi_diem: new Date('2026-10-03T08:00:00Z'),
          muc: 'co_ban',
        },
        'api',
      );
      expect(prisma.ket_qua_khao_sat.upsert).not.toHaveBeenCalled();
    });

    it('làm lại, hoàn thành mới hơn -> ghi đè mức', async () => {
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        dong({
          trang_thai: 'hoan_thanh',
          hoan_thanh_luc: new Date('2026-10-01T08:00:00Z'),
          muc: 'co_ban',
        }),
      );
      await service.ghiKetQua(
        'hv-1',
        {
          loai: 'khao-sat',
          trang_thai: 'hoan_thanh',
          thoi_diem: new Date('2026-10-04T08:00:00Z'),
          muc: 'nang_cao',
        },
        'import',
      );
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update).toMatchObject({ muc: 'nang_cao', nguon: 'import' });
    });

    it('hoàn thành không gửi chi tiết -> chi_tiet = DbNull (xóa chi tiết cũ)', async () => {
      await service.ghiKetQua(
        'hv-1',
        { loai: 'khao-sat', trang_thai: 'hoan_thanh' },
        'api',
      );
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update.chi_tiet).toBe(Prisma.DbNull);
      expect(update.muc).toBeNull();
    });

    it('đang làm lần 2 -> giữ nguyên thời điểm bắt đầu lần đầu', async () => {
      const batDau = new Date('2026-10-02T01:00:00Z');
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(
        dong({ trang_thai: 'dang_lam', bat_dau_luc: batDau }),
      );
      await service.ghiKetQua(
        'hv-1',
        { loai: 'khao-sat', trang_thai: 'dang_lam' },
        'api',
      );
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update.bat_dau_luc).toBe(batDau);
      expect(update.trang_thai).toBe('dang_lam');
    });

    it('đã mở -> đang làm: chuyển trạng thái, bắt đầu = thời điểm báo', async () => {
      prisma.ket_qua_khao_sat.findUnique.mockResolvedValue(dong());
      const t = new Date('2026-10-04T02:00:00Z');
      await service.ghiKetQua(
        'hv-1',
        { loai: 'khao-sat', trang_thai: 'dang_lam', thoi_diem: t },
        'api',
      );
      const { update } = prisma.ket_qua_khao_sat.upsert.mock.calls[0][0];
      expect(update).toMatchObject({ trang_thai: 'dang_lam', bat_dau_luc: t });
    });
  });

  describe('tinhTrangCuaHocVien (học viên)', () => {
    it('đủ 3 loại bài; loại chưa có dòng -> chua_lam', async () => {
      const kq = await service.tinhTrangCuaHocVien('hv-1');
      expect(kq.map((k) => k.loai)).toEqual(['khao-sat', 'danh-gia', 'dau-ra']);
      expect(kq.every((k) => k.trang_thai === 'chua_lam')).toBe(true);
      expect(kq.every((k) => !k.can_kiem_tra)).toBe(true);
    });

    it('đã mở quá 24 giờ không cập nhật -> cần kiểm tra lại; mới mở -> chưa', async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        dong({
          loai: 'khao-sat',
          cap_nhat_luc: new Date(Date.now() - NGUONG_CAN_KIEM_TRA_MS - 1000),
        }),
        dong({ loai: 'danh-gia', trang_thai: 'dang_lam' }),
      ]);
      const [khaoSat, danhGia] = await service.tinhTrangCuaHocVien('hv-1');
      expect(khaoSat.can_kiem_tra).toBe(true);
      expect(danhGia).toMatchObject({
        trang_thai: 'dang_lam',
        can_kiem_tra: false,
      });
    });

    it('hoàn thành -> trả mức, KHÔNG trả điểm / chi tiết; hoàn thành lâu không bị "cần kiểm tra"', async () => {
      prisma.ket_qua_khao_sat.findMany.mockResolvedValue([
        dong({
          loai: 'danh-gia',
          trang_thai: 'hoan_thanh',
          muc: 'thanh_thao',
          diem: new Prisma.Decimal(80),
          chi_tiet: { a: 1 },
          cap_nhat_luc: new Date('2020-01-01'),
        }),
      ]);
      const kq = await service.tinhTrangCuaHocVien('hv-1');
      const danhGia = kq[1];
      expect(danhGia).toMatchObject({
        trang_thai: 'hoan_thanh',
        muc: 'thanh_thao',
        can_kiem_tra: false,
      });
      expect(danhGia).not.toHaveProperty('diem');
      expect(danhGia).not.toHaveProperty('chi_tiet');
    });
  });

  describe('thongKe (quản trị)', () => {
    it('chưa làm = tổng học viên − các trạng thái đã có; đếm theo mức gốc theo đúng thứ tự thang', async () => {
      prisma.hoc_vien.count.mockResolvedValue(10);
      prisma.ket_qua_khao_sat.groupBy
        .mockResolvedValueOnce([
          { loai: 'khao-sat', trang_thai: 'da_mo', _count: { _all: 2 } },
          { loai: 'khao-sat', trang_thai: 'hoan_thanh', _count: { _all: 3 } },
          { loai: 'danh-gia', trang_thai: 'dang_lam', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { loai: 'khao-sat', muc_goc: 'M2', _count: { _all: 2 } },
          { loai: 'khao-sat', muc_goc: null, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ loai: 'khao-sat', _count: { _all: 1 } }]);

      const kq = await service.thongKe('khoa-1');
      expect(kq.tong_hoc_vien).toBe(10);
      expect(kq.theo_loai[0]).toEqual({
        loai: 'khao-sat',
        chua_lam: 5,
        da_mo: 2,
        dang_lam: 0,
        hoan_thanh: 3,
        can_kiem_tra: 1,
        theo_muc_goc: [
          { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
          { ma: 'M2', nhan: 'Cơ bản', so_luong: 2 },
          { ma: 'M3', nhan: 'Thành thạo', so_luong: 0 },
          { ma: 'M4', nhan: 'Nâng cao', so_luong: 0 },
        ],
        chua_xep_muc: 1,
      });
      expect(kq.theo_loai[1]).toMatchObject({ chua_lam: 9, dang_lam: 1 });
      expect(prisma.hoc_vien.count.mock.calls[0][0].where).toEqual({
        AND: [HOC_VIEN_PHAI_KHAO_SAT, { dang_ky_hoc: { some: { khoa_id: 'khoa-1' } } }],
      });
    });

    it('không chọn khóa -> phạm vi toàn bộ học viên, vẫn loại nhân viên (chưa triển khai khảo sát)', async () => {
      await service.thongKe();
      expect(prisma.hoc_vien.count.mock.calls[0][0].where).toEqual({
        AND: [HOC_VIEN_PHAI_KHAO_SAT],
      });
    });

    // Mô phỏng ngữ nghĩa Prisma (OR/notIn, NULL bị notIn bỏ) để chứng minh
    // tong_hoc_vien thật sự đếm 2 (giáo viên + chưa khai), không phải 3.
    it('1 giáo_viên + 1 nhân_viên + 1 chưa khai đối tượng -> tong_hoc_vien = 2 (loại nhân viên, giữ NULL)', async () => {
      const hocVien = [
        { doi_tuong: 'giao_vien' },
        { doi_tuong: 'nhan_vien' },
        { doi_tuong: null },
      ];
      prisma.hoc_vien.count.mockImplementation(
        async ({ where }: { where: Prisma.hoc_vienWhereInput }) =>
          hocVien.filter((hv) => khopDieuKienDoiTuong(hv.doi_tuong, where))
            .length,
      );
      prisma.ket_qua_khao_sat.groupBy.mockResolvedValue([]);

      const kq = await service.thongKe();
      expect(kq.tong_hoc_vien).toBe(2);
    });

    it('mã không còn trong thang (đã bị xóa khỏi cấu hình) -> nối cuối, nhãn = chính mã đó', async () => {
      prisma.hoc_vien.count.mockResolvedValue(5);
      prisma.ket_qua_khao_sat.groupBy
        .mockResolvedValueOnce([
          { loai: 'khao-sat', trang_thai: 'hoan_thanh', _count: { _all: 4 } },
        ])
        .mockResolvedValueOnce([
          { loai: 'khao-sat', muc_goc: 'M4', _count: { _all: 1 } },
          { loai: 'khao-sat', muc_goc: 'M3', _count: { _all: 1 } },
          { loai: 'khao-sat', muc_goc: null, _count: { _all: 1 } },
          { loai: 'khao-sat', muc_goc: 'X9', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([]);

      const kq = await service.thongKe();
      expect(kq.theo_loai[0].theo_muc_goc).toEqual([
        { ma: 'M1', nhan: 'Chưa đạt', so_luong: 0 },
        { ma: 'M2', nhan: 'Cơ bản', so_luong: 0 },
        { ma: 'M3', nhan: 'Thành thạo', so_luong: 1 },
        { ma: 'M4', nhan: 'Nâng cao', so_luong: 1 },
        { ma: 'X9', nhan: 'X9', so_luong: 1 },
      ]);
      expect(kq.theo_loai[0].chua_xep_muc).toBe(1);
    });
  });

  describe('danhSach (quản trị)', () => {
    const whereCua = () =>
      prisma.hoc_vien.findMany.mock.calls[0][0].where.AND as unknown[];

    it('lọc chưa làm -> học viên KHÔNG có dòng của loại bài (mặc định khao-sat)', async () => {
      await service.danhSach({ trang_thai: 'chua_lam' });
      expect(whereCua()).toContainEqual({
        ket_qua_khao_sat: { none: { loai: 'khao-sat' } },
      });
    });

    it('lọc cần kiểm tra -> đã mở/đang làm + cập nhật cũ hơn 24 giờ, theo đúng loại chọn', async () => {
      await service.danhSach({ trang_thai: 'can_kiem_tra', loai: 'danh-gia' });
      const loc = whereCua()[1] as {
        ket_qua_khao_sat: { some: Record<string, unknown> };
      };
      expect(loc.ket_qua_khao_sat.some).toMatchObject({
        loai: 'danh-gia',
        trang_thai: { in: ['da_mo', 'dang_lam'] },
      });
    });

    it('tìm theo tên hoặc mã MOET; trả kết quả kèm điểm dạng số, phân trang', async () => {
      prisma.hoc_vien.findMany.mockResolvedValue([
        {
          id: 'hv-1',
          ho_ten: 'Nguyễn A',
          ma_dinh_danh_moet: '123',
          doi_tuong: 'giao_vien',
          don_vi_cong_tac: { ten_don_vi: 'Trường A' },
          ket_qua_khao_sat: [
            dong({
              trang_thai: 'hoan_thanh',
              diem: new Prisma.Decimal('72.5'),
              diem_toi_da: new Prisma.Decimal('100'),
              chi_tiet: { diem_loai_a: 5 },
              muc: 'thanh_thao',
            }),
          ],
        },
      ]);
      prisma.hoc_vien.count.mockResolvedValue(41);
      const kq = await service.danhSach({
        q: ' Nguyễn ',
        page: 3,
        page_size: 20,
      });
      expect(whereCua()).toContainEqual({
        OR: [
          { ho_ten: { contains: 'Nguyễn', mode: 'insensitive' } },
          { ma_dinh_danh_moet: { contains: 'Nguyễn' } },
        ],
      });
      expect(prisma.hoc_vien.findMany.mock.calls[0][0].skip).toBe(40);
      expect(kq.total).toBe(41);
      expect(kq.data[0]).toMatchObject({
        ten_don_vi: 'Trường A',
        ket_qua: [
          {
            loai: 'khao-sat',
            diem: 72.5,
            diem_toi_da: 100,
            chi_tiet: { diem_loai_a: 5 },
            muc: 'thanh_thao',
          },
        ],
      });
    });
  });
});

describe('kiemTraApiKeyKhaoSat', () => {
  const envGoc = { ...process.env };
  afterEach(() => {
    process.env = { ...envGoc };
  });

  it('chưa cấu hình key -> 503', () => {
    delete process.env.SSO_KHAO_SAT_API_KEY;
    expect(() => kiemTraApiKeyKhaoSat('x')).toThrow(SsoChuaCauHinhException);
  });

  it.each([undefined, '', 'sai'])('key %p sai -> 401', (key) => {
    process.env.SSO_KHAO_SAT_API_KEY = 'dung';
    expect(() => kiemTraApiKeyKhaoSat(key)).toThrow(UnauthorizedAppException);
  });

  it('key đúng -> qua', () => {
    process.env.SSO_KHAO_SAT_API_KEY = 'dung';
    expect(() => kiemTraApiKeyKhaoSat('dung')).not.toThrow();
  });
});
