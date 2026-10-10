import { Prisma } from '@prisma/client';
import { VaoHocZoomService } from './vao-hoc-zoom.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ForbiddenAppException,
  NotFoundAppException,
  ValidationException,
} from '../common/exceptions/app.exceptions';

const PHUT = 60 * 1000;
const BAT_DAU = new Date('2026-11-06T01:00:00Z'); // 08:00 giờ VN
const LINK = 'https://zoom.us/j/123';

const hocVien = {
  id: 'nd-1',
  vai_tro: 'hoc_vien',
  hoc_vien_id: 'hv-1',
} as unknown as AuthenticatedUser;

function taoBuoi(
  ghiDe: {
    loai_lop?: 'zoom' | 'truc_tiep';
    bat?: Date | null;
    link?: string | null;
  } = {},
) {
  return {
    id: 'lich-1',
    lop_id: 'lop-1',
    giai_doan_id: 'gd-1',
    thoi_gian_bat_dau: BAT_DAU,
    dia_diem_hoac_link: ghiDe.link === undefined ? LINK : ghiDe.link,
    lop: {
      loai_lop: ghiDe.loai_lop ?? 'zoom',
      khoa_id: 'khoa-1',
      khoa: {
        bat_diem_danh_zoom_luc:
          ghiDe.bat === undefined ? new Date('2026-10-01') : ghiDe.bat,
        diem_danh_mo_truoc_phut: 30,
        diem_danh_dong_sau_phut: 120,
      },
    },
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('VaoHocZoomService.vaoHoc', () => {
  let prisma: {
    lich_hoc_lop: { findUnique: jest.Mock };
    phan_lop_giai_doan: { findFirst: jest.Mock };
    diem_danh: { findUnique: jest.Mock; create: jest.Mock };
  };
  let service: VaoHocZoomService;
  const trongCuaSo = new Date(BAT_DAU.getTime() + 5 * PHUT);

  beforeEach(() => {
    prisma = {
      lich_hoc_lop: { findUnique: jest.fn().mockResolvedValue(taoBuoi()) },
      phan_lop_giai_doan: {
        findFirst: jest.fn().mockResolvedValue({ dang_ky_hoc_id: 'dk-1' }),
      },
      diem_danh: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    service = new VaoHocZoomService(prisma as unknown as PrismaService);
  });

  it('chưa mở: trả mo/dong, không link, không ghi', async () => {
    const kq = await service.vaoHoc(
      'lich-1',
      hocVien,
      new Date(BAT_DAU.getTime() - 31 * PHUT),
    );
    expect(kq).toEqual({
      ket_qua: 'chua_mo',
      mo: new Date(BAT_DAU.getTime() - 30 * PHUT),
      dong: new Date(BAT_DAU.getTime() + 120 * PHUT),
    });
    expect(kq).not.toHaveProperty('link');
    expect(prisma.diem_danh.create).not.toHaveBeenCalled();
  });

  it('đang mở, chưa có dòng: tạo co_mat/zoom với tu_diem_danh_luc = now', async () => {
    const kq = await service.vaoHoc('lich-1', hocVien, trongCuaSo);
    expect(kq).toMatchObject({
      ket_qua: 'da_ghi_nhan',
      luc: trongCuaSo,
      link: LINK,
    });
    expect(prisma.diem_danh.create).toHaveBeenCalledWith({
      data: {
        dang_ky_hoc_id: 'dk-1',
        lich_hoc_id: 'lich-1',
        trang_thai: 'co_mat',
        nguon: 'zoom',
        tu_diem_danh_luc: trongCuaSo,
        cap_nhat_luc: trongCuaSo,
      },
    });
  });

  it('biên mở cửa sổ (đúng mo) tính là đang mở', async () => {
    const kq = await service.vaoHoc(
      'lich-1',
      hocVien,
      new Date(BAT_DAU.getTime() - 30 * PHUT),
    );
    expect(kq.ket_qua).toBe('da_ghi_nhan');
  });

  it('đang mở, đã có dòng (vd import vắng): không ghi đè, trả da_co', async () => {
    const capNhat = new Date('2026-11-06T00:50:00Z');
    prisma.diem_danh.findUnique.mockResolvedValue({
      trang_thai: 'vang',
      tu_diem_danh_luc: null,
      cap_nhat_luc: capNhat,
    });
    const kq = await service.vaoHoc('lich-1', hocVien, trongCuaSo);
    expect(kq).toMatchObject({
      ket_qua: 'da_co',
      trang_thai: 'vang',
      luc: capNhat,
      link: LINK,
    });
    expect(prisma.diem_danh.create).not.toHaveBeenCalled();
  });

  it('đã tự điểm danh trước đó: luc = tu_diem_danh_luc', async () => {
    const luc = new Date('2026-11-06T00:45:00Z');
    prisma.diem_danh.findUnique.mockResolvedValue({
      trang_thai: 'co_mat',
      tu_diem_danh_luc: luc,
      cap_nhat_luc: new Date('2026-11-06T00:59:00Z'),
    });
    const kq = await service.vaoHoc('lich-1', hocVien, trongCuaSo);
    expect(kq).toMatchObject({ ket_qua: 'da_co', luc });
  });

  it('2 request song song: P2002 -> da_co theo dòng request kia tạo', async () => {
    const luc = new Date(BAT_DAU.getTime() + 4 * PHUT);
    prisma.diem_danh.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        trang_thai: 'co_mat',
        tu_diem_danh_luc: luc,
        cap_nhat_luc: luc,
      });
    prisma.diem_danh.create.mockRejectedValue(p2002());
    const kq = await service.vaoHoc('lich-1', hocVien, trongCuaSo);
    expect(kq).toMatchObject({
      ket_qua: 'da_co',
      trang_thai: 'co_mat',
      luc,
      link: LINK,
    });
  });

  it('lỗi DB khác P2002 thì ném ra', async () => {
    prisma.diem_danh.create.mockRejectedValue(new Error('db down'));
    await expect(service.vaoHoc('lich-1', hocVien, trongCuaSo)).rejects.toThrow(
      'db down',
    );
  });

  it('quá giờ: có link, không ghi', async () => {
    const kq = await service.vaoHoc(
      'lich-1',
      hocVien,
      new Date(BAT_DAU.getTime() + 121 * PHUT),
    );
    expect(kq).toEqual({
      ket_qua: 'qua_gio',
      mo: new Date(BAT_DAU.getTime() - 30 * PHUT),
      dong: new Date(BAT_DAU.getTime() + 120 * PHUT),
      link: LINK,
    });
    expect(prisma.diem_danh.create).not.toHaveBeenCalled();
  });

  it('báo vắng không chặn: vẫn tạo co_mat (không tra bao_vang)', async () => {
    const kq = await service.vaoHoc('lich-1', hocVien, trongCuaSo);
    expect(kq.ket_qua).toBe('da_ghi_nhan');
    expect(prisma.diem_danh.create.mock.calls[0][0].data.trang_thai).toBe(
      'co_mat',
    );
  });

  it('buổi không tồn tại -> 404', async () => {
    prisma.lich_hoc_lop.findUnique.mockResolvedValue(null);
    await expect(
      service.vaoHoc('lich-x', hocVien, trongCuaSo),
    ).rejects.toBeInstanceOf(NotFoundAppException);
  });

  it.each([
    ['lớp trực tiếp', { loai_lop: 'truc_tiep' as const }],
    ['khóa chưa bật', { bat: null }],
    ['buổi chưa có link', { link: null }],
    ['link chỉ khoảng trắng', { link: '   ' }],
  ])('%s -> 400', async (_, ghiDe) => {
    prisma.lich_hoc_lop.findUnique.mockResolvedValue(taoBuoi(ghiDe));
    await expect(
      service.vaoHoc('lich-1', hocVien, trongCuaSo),
    ).rejects.toBeInstanceOf(ValidationException);
    expect(prisma.diem_danh.create).not.toHaveBeenCalled();
  });

  it('không thuộc lớp ở giai đoạn của buổi -> 403', async () => {
    prisma.phan_lop_giai_doan.findFirst.mockResolvedValue(null);
    await expect(
      service.vaoHoc('lich-1', hocVien, trongCuaSo),
    ).rejects.toBeInstanceOf(ForbiddenAppException);
    expect(prisma.phan_lop_giai_doan.findFirst).toHaveBeenCalledWith({
      where: {
        lop_id: 'lop-1',
        giai_doan_id: 'gd-1',
        dang_ky_hoc: { hoc_vien_id: 'hv-1', khoa_id: 'khoa-1' },
      },
      select: { dang_ky_hoc_id: true },
    });
  });

  it('tài khoản không gắn hồ sơ học viên -> 403', async () => {
    await expect(
      service.vaoHoc(
        'lich-1',
        { ...hocVien, hoc_vien_id: null } as AuthenticatedUser,
        trongCuaSo,
      ),
    ).rejects.toBeInstanceOf(ForbiddenAppException);
  });
});
