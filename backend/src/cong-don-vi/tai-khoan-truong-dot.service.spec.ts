import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';
import { TaiKhoanDonViService } from '../nguoi-dung/tai-khoan-don-vi.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ConflictAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';
import {
  LY_DO_KHONG_MA,
  LY_DO_NGUNG,
  TaiKhoanTruongDotService,
} from './tai-khoan-truong-dot.service';

// Dữ liệu bịa. Kiểm luật của service với Prisma / TaiKhoanDonViService giả.
type TruongGia = {
  id: string;
  ma: string | null;
  ten: string;
  trang_thai?: 'active' | 'ngung';
  tk?: { dang_nhap_lan_cuoi: Date | null; trang_thai?: 'active' | 'ngung' };
};

function dungService(ds: TruongGia[] | null) {
  const prisma = {
    dot_trien_khai: {
      findUnique: jest.fn().mockResolvedValue(ds ? { id: 'dot-1' } : null),
    },
    hop_dong_boi_duong: {
      findMany: jest.fn().mockResolvedValue(
        (ds ?? []).map((t) => ({
          don_vi: {
            id: t.id,
            ma_don_vi: t.ma,
            ten_don_vi: t.ten,
            trang_thai: t.trang_thai ?? 'active',
            nguoi_dung: t.tk
              ? [
                  {
                    id: `tk-${t.id}`,
                    ten_dang_nhap: `tk-${t.id}`,
                    trang_thai: t.tk.trang_thai ?? 'active',
                    dang_nhap_lan_cuoi: t.tk.dang_nhap_lan_cuoi,
                  },
                ]
              : [],
          },
        })),
      ),
    },
  };
  const nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
  const taoTaiKhoan = jest.fn();
  const service = new TaiKhoanTruongDotService(
    prisma as unknown as PrismaService,
    nhatKy as unknown as NhatKyService,
    { taoTaiKhoan } as unknown as TaiKhoanDonViService,
  );
  return { service, nhatKy, taoTaiKhoan };
}

const CALLER = { id: 'qt-1' } as AuthenticatedUser;

function taoThanhCong(ten: string) {
  return {
    tai_khoan: { ten_dang_nhap: ten },
    mat_khau_tam: 'Bia2345678',
  };
}

describe('TaiKhoanTruongDotService.danhSach', () => {
  it('đếm đúng và xếp theo tên tiếng Việt', async () => {
    const { service } = dungService([
      { id: 'c', ma: 'C', ten: 'Trường Đông' },
      { id: 'a', ma: 'A', ten: 'Trường An', tk: { dang_nhap_lan_cuoi: null } },
      {
        id: 'b',
        ma: 'B',
        ten: 'Trường Bình',
        tk: { dang_nhap_lan_cuoi: new Date('2026-11-01T00:00:00Z') },
      },
    ]);
    const kq = await service.danhSach('dot-1');
    expect(kq.tong).toEqual({
      so_truong: 3,
      so_co_tai_khoan: 2,
      so_chua_co: 1,
      so_chua_dang_nhap: 1,
    });
    expect(kq.truong.map((t) => t.don_vi.ten)).toEqual([
      'Trường An',
      'Trường Bình',
      'Trường Đông',
    ]);
    expect(kq.truong[0]).toEqual({
      don_vi: { id: 'a', ma: 'A', ten: 'Trường An' },
      tai_khoan: {
        id: 'tk-a',
        ten_dang_nhap: 'tk-a',
        trang_thai: 'active',
        lan_dang_nhap_cuoi: null,
      },
    });
    expect(kq.truong[2].tai_khoan).toBeNull();
  });

  it('đợt rỗng → 0 trường', async () => {
    const { service } = dungService([]);
    expect((await service.danhSach('dot-1')).tong.so_truong).toBe(0);
  });

  it('đợt không tồn tại → 404', async () => {
    const { service } = dungService(null);
    await expect(service.danhSach('x')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
  });
});

describe('TaiKhoanTruongDotService.cap', () => {
  it('lỗi 1 trường không dừng trường khác; gom lý do; file chỉ có trường tạo được', async () => {
    const { service, taoTaiKhoan, nhatKy } = dungService([
      { id: 'a', ma: 'TR-A', ten: 'Trường A' },
      { id: 'b', ma: 'TR-B', ten: 'Trường B' },
      { id: 'c', ma: 'TR-C', ten: 'Trường C' },
      { id: 'd', ma: null, ten: 'Trường D' },
      { id: 'e', ma: 'TR-E', ten: 'Trường E', trang_thai: 'ngung' },
      {
        id: 'f',
        ma: 'TR-F',
        ten: 'Trường F',
        tk: { dang_nhap_lan_cuoi: null },
      },
      { id: 'g', ma: 'TR G', ten: 'Trường G' },
    ]);
    taoTaiKhoan.mockImplementation(({ don_vi_id }: { don_vi_id: string }) => {
      if (don_vi_id === 'b') {
        throw new ConflictAppException('Tên đăng nhập đã được dùng', [
          { field: 'ten_dang_nhap', message: 'Tên đăng nhập đã được dùng' },
        ]);
      }
      if (don_vi_id === 'c') throw new Error('mất kết nối DB');
      if (don_vi_id === 'g') {
        throw new ValidationException('Dữ liệu tài khoản không hợp lệ', [
          {
            field: 'ten_dang_nhap',
            message: 'Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)',
          },
        ]);
      }
      return Promise.resolve(taoThanhCong(`tr-${don_vi_id}`));
    });

    const kq = await service.cap('dot-1', CALLER);

    // Chỉ gọi cho trường chưa có tài khoản, có mã, đang hoạt động; luôn cấp bằng mật khẩu tạm, không email.
    expect(taoTaiKhoan.mock.calls.map((c) => c[0])).toEqual([
      { don_vi_id: 'a', cach_cap: 'mat_khau_tam' },
      { don_vi_id: 'b', cach_cap: 'mat_khau_tam' },
      { don_vi_id: 'c', cach_cap: 'mat_khau_tam' },
      { don_vi_id: 'g', cach_cap: 'mat_khau_tam' },
    ]);
    expect(taoTaiKhoan.mock.calls.every((c) => c[1] === CALLER)).toBe(true);
    expect(kq.so_tao).toBe(1);
    expect(kq.bo_qua).toEqual([
      {
        don_vi: { id: 'b', ma: 'TR-B', ten: 'Trường B' },
        ly_do: 'Tên đăng nhập "tr-b": Tên đăng nhập đã được dùng',
      },
      {
        don_vi: { id: 'c', ma: 'TR-C', ten: 'Trường C' },
        ly_do: 'Lỗi không xác định khi tạo tài khoản — thử lại sau',
      },
      { don_vi: { id: 'd', ma: null, ten: 'Trường D' }, ly_do: LY_DO_KHONG_MA },
      { don_vi: { id: 'e', ma: 'TR-E', ten: 'Trường E' }, ly_do: LY_DO_NGUNG },
      {
        don_vi: { id: 'g', ma: 'TR G', ten: 'Trường G' },
        ly_do:
          'Tên đăng nhập "tr g": Chỉ gồm chữ thường không dấu, số, . _ - (3–50 ký tự)',
      },
    ]);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      Buffer.from(kq.file_mat_khau!, 'base64') as unknown as ExcelJS.Buffer,
    );
    const sh = wb.worksheets[0];
    expect(sh.rowCount).toBe(2);
    expect(sh.getRow(2).values).toEqual([
      undefined,
      '1',
      'TR-A',
      'Trường A',
      'tr-a',
      'Bia2345678',
      'Đổi mật khẩu ở lần đăng nhập đầu tiên',
    ]);

    // Nhật ký tổng hợp: chỉ số đếm, không tên đăng nhập / mật khẩu.
    expect(nhatKy.ghi).toHaveBeenCalledTimes(1);
    expect(nhatKy.ghi).toHaveBeenCalledWith({
      hanh_dong: 'cap_tai_khoan_truong_theo_dot',
      chi_tiet: { dot_trien_khai_id: 'dot-1', so_tao: 1, so_bo_qua: 5 },
    });
    expect(JSON.stringify(nhatKy.ghi.mock.calls)).not.toContain('Bia2345678');
  });

  it('mọi trường đã có tài khoản → so_tao 0, không file, không gọi tạo', async () => {
    const { service, taoTaiKhoan } = dungService([
      { id: 'a', ma: 'A', ten: 'Trường A', tk: { dang_nhap_lan_cuoi: null } },
    ]);
    const kq = await service.cap('dot-1', CALLER);
    expect(kq).toEqual({ so_tao: 0, bo_qua: [], file_mat_khau: null });
    expect(taoTaiKhoan).not.toHaveBeenCalled();
  });

  it('đợt không tồn tại → 404, không ghi nhật ký', async () => {
    const { service, nhatKy } = dungService(null);
    await expect(service.cap('x', CALLER)).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });
});
