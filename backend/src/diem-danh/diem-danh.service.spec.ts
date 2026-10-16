import { DiemDanhService } from './diem-danh.service';
import { PrismaService } from '../prisma/prisma.service';
import { HoTroGiangVienScopeService } from '../ho-tro-giang-vien/ho-tro-giang-vien-scope.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { ValidationException } from '../common/exceptions/app.exceptions';

// Spec đổi buổi §5: bảng điểm danh + sửa ô tính học viên đổi buổi vào.
describe('DiemDanhService — đổi buổi', () => {
  const quanTri = {
    id: 'qt-1',
    vai_tro: 'quan_tri',
  } as AuthenticatedUser;
  const now = new Date('2026-11-05T00:00:00Z');
  const dk = (id: string, ho_ten: string) => ({
    id,
    hoc_vien: { ho_ten, don_vi_cong_tac: { ten_don_vi: 'THPT A' } },
    diem_danh: [],
    bao_vang: [],
  });
  let prisma: {
    lop_hoc: { findUnique: jest.Mock };
    giai_doan_khoa: { findMany: jest.Mock };
    lich_hoc_lop: { findMany: jest.Mock; findUnique: jest.Mock };
    phan_lop_giai_doan: { findMany: jest.Mock; count: jest.Mock };
    dang_ky_hoc: { findMany: jest.Mock };
    diem_danh: { upsert: jest.Mock };
  };
  let doiBuoi: {
    dieuChinhTheoBuoi: jest.Mock;
    doiBuoiDaDuyetCuaDangKy: jest.Mock;
  };
  let service: DiemDanhService;

  beforeEach(() => {
    prisma = {
      lop_hoc: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lop-b',
          ten_lop: 'Lớp B',
          loai_lop: 'truc_tiep',
          khoa: { id: 'k1', ma_khoa: 'K1', ten_khoa: 'Khóa 1' },
        }),
      },
      giai_doan_khoa: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'gd-1',
            thu_tu: 1,
            ten_giai_doan: 'GĐ 1',
            hinh_thuc: 'truc_tiep',
            lich_hoc: [{ id: 'b-1' }],
          },
        ]),
      },
      lich_hoc_lop: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b-1',
            buoi_so: 1,
            thoi_gian_bat_dau: new Date('2026-11-04T01:00:00Z'),
            thoi_gian_ket_thuc: new Date('2026-11-04T04:00:00Z'),
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          lop_id: 'lop-b',
          giai_doan_id: 'gd-1',
          thoi_gian_bat_dau: new Date('2026-11-04T01:00:00Z'),
          lop: { khoa_id: 'k1' },
        }),
      },
      phan_lop_giai_doan: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ dang_ky_hoc: dk('dk-b', 'Bình Lớp B') }]),
        count: jest.fn().mockResolvedValue(0),
      },
      dang_ky_hoc: {
        findMany: jest.fn().mockResolvedValue([dk('dk-a', 'An Lớp A')]),
      },
      diem_danh: {
        upsert: jest.fn().mockResolvedValue({
          trang_thai: 'co_mat',
          nguon: 'thu_cong',
          ghi_chu: null,
          tu_diem_danh_luc: null,
          cap_nhat_luc: now,
          sua_boi: { ho_ten: 'QT' },
        }),
      },
    };
    doiBuoi = {
      dieuChinhTheoBuoi: jest.fn().mockResolvedValue(
        new Map([
          [
            'b-1',
            {
              ra: [],
              vao: [
                {
                  dang_ky_hoc_id: 'dk-a',
                  lich_nguon_id: 'a-1',
                  lop_nguon: { id: 'lop-a', ten_lop: 'Lớp A' },
                },
              ],
            },
          ],
        ]),
      ),
      doiBuoiDaDuyetCuaDangKy: jest.fn().mockResolvedValue([]),
    };
    service = new DiemDanhService(
      prisma as unknown as PrismaService,
      {} as HoTroGiangVienScopeService,
      doiBuoi as unknown as DoiBuoiHocQueryService,
    );
  });

  it('bảng điểm danh: thêm dòng người đổi vào kèm nhãn, nạp trong 1 truy vấn', async () => {
    const bang = await service.bangDiemDanh(quanTri, 'lop-b', 'gd-1', now);
    expect(bang.hoc_vien.map((h) => h.dang_ky_hoc_id)).toEqual([
      'dk-a',
      'dk-b',
    ]);
    expect(bang.hoc_vien[0]).toMatchObject({
      doi_buoi: { 'b-1': { loai: 'vao', lop: 'Lớp A' } },
    });
    expect(bang.hoc_vien[1]).not.toHaveProperty('doi_buoi');
    expect(prisma.dang_ky_hoc.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.dang_ky_hoc.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['dk-a'] },
    });
  });

  it('sửa ô: học viên có đổi buổi đã duyệt vào buổi này → ghi được', async () => {
    doiBuoi.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-a', lich_nguon_id: 'a-1', lich_chot_id: 'b-1' },
    ]);
    const o = await service.suaO(
      quanTri,
      'lop-b',
      { dang_ky_hoc_id: 'dk-a', lich_hoc_id: 'b-1', trang_thai: 'co_mat' },
      now,
    );
    expect(o).toMatchObject({ dang_ky_hoc_id: 'dk-a', trang_thai: 'co_mat' });
  });

  it('sửa ô: không thuộc lớp và không có đổi buổi vào buổi này → lỗi', async () => {
    doiBuoi.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-a', lich_nguon_id: 'a-2', lich_chot_id: 'b-2' },
    ]);
    await expect(
      service.suaO(
        quanTri,
        'lop-b',
        { dang_ky_hoc_id: 'dk-a', lich_hoc_id: 'b-1', trang_thai: 'co_mat' },
        now,
      ),
    ).rejects.toBeInstanceOf(ValidationException);
    expect(prisma.diem_danh.upsert).not.toHaveBeenCalled();
  });
});
