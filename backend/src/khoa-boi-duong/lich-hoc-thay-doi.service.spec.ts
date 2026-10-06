import { lich_hoc_lop } from '@prisma/client';
import {
  LichHocThayDoiService,
  soSanhLichHoc,
} from './lich-hoc-thay-doi.service';
import { PrismaService } from '../prisma/prisma.service';
import { NhatKyService } from '../nhat-ky/nhat-ky.service';

const lichCu: lich_hoc_lop = {
  id: 'lich-1',
  lop_id: 'lop-1',
  giai_doan_id: 'gd-1',
  buoi_so: 2,
  thoi_gian_bat_dau: new Date('2026-11-06T01:00:00Z'),
  thoi_gian_ket_thuc: new Date('2026-11-06T04:00:00Z'),
  dia_diem_hoac_link: null,
  trang_thai: 'chua_dien_ra',
  diem_hoc_id: 'dh-1',
  phong: 'P.101',
  cap_nhat_luc: new Date('2026-10-01T00:00:00Z'),
};

describe('soSanhLichHoc', () => {
  it('không truyền trường nào → không đổi', () => {
    expect(soSanhLichHoc(lichCu, {})).toBeNull();
  });

  it('cùng giá trị (kể cả Date khác instance) → không đổi', () => {
    expect(
      soSanhLichHoc(lichCu, {
        thoi_gian_bat_dau: new Date('2026-11-06T01:00:00Z'),
        phong: 'P.101',
        diem_hoc_id: 'dh-1',
      }),
    ).toBeNull();
  });

  it('đổi giờ + phòng → chỉ liệt kê đúng trường đổi, có trước/sau', () => {
    expect(
      soSanhLichHoc(lichCu, {
        thoi_gian_bat_dau: new Date('2026-11-06T02:00:00Z'),
        phong: 'P.202',
        diem_hoc_id: 'dh-1',
      }),
    ).toEqual({
      truoc: {
        thoi_gian_bat_dau: '2026-11-06T01:00:00.000Z',
        phong: 'P.101',
      },
      sau: { thoi_gian_bat_dau: '2026-11-06T02:00:00.000Z', phong: 'P.202' },
    });
  });

  it('null = xóa giá trị → tính là đổi', () => {
    expect(soSanhLichHoc(lichCu, { phong: null })).toEqual({
      truoc: { phong: 'P.101' },
      sau: { phong: null },
    });
  });
});

describe('LichHocThayDoiService.capNhat', () => {
  let prisma: { lich_hoc_lop: { update: jest.Mock } };
  let nhatKy: { ghi: jest.Mock };
  let service: LichHocThayDoiService;

  beforeEach(() => {
    prisma = {
      lich_hoc_lop: {
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ ...lichCu, ...data })),
      },
    };
    nhatKy = { ghi: jest.fn().mockResolvedValue(undefined) };
    service = new LichHocThayDoiService(
      prisma as unknown as PrismaService,
      nhatKy as unknown as NhatKyService,
    );
  });

  it('không có gì đổi → không update, không ghi nhật ký (chạy lại import y nguyên)', async () => {
    const kq = await service.capNhat(
      lichCu,
      { thoi_gian_bat_dau: lichCu.thoi_gian_bat_dau, phong: 'P.101' },
      { nguon: 'import' },
    );
    expect(kq).toBe(lichCu);
    expect(prisma.lich_hoc_lop.update).not.toHaveBeenCalled();
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });

  it('đổi giờ → set cap_nhat_luc mới + ghi nhật ký sua_lich_hoc kèm lý do', async () => {
    await service.capNhat(
      lichCu,
      { thoi_gian_bat_dau: new Date('2026-11-07T01:00:00Z') },
      { nguon: 'sua_tay', ly_do: 'Dời theo lịch trường' },
    );
    const data = prisma.lich_hoc_lop.update.mock.calls[0][0].data;
    expect(data.cap_nhat_luc).toBeInstanceOf(Date);
    expect(data.cap_nhat_luc.getTime()).toBeGreaterThan(
      lichCu.cap_nhat_luc.getTime(),
    );
    expect(nhatKy.ghi).toHaveBeenCalledWith(
      expect.objectContaining({
        hanh_dong: 'sua_lich_hoc',
        chi_tiet: expect.objectContaining({
          lich_hoc_id: 'lich-1',
          ly_do: 'Dời theo lịch trường',
          nguon: 'sua_tay',
          truoc: { thoi_gian_bat_dau: '2026-11-06T01:00:00.000Z' },
          sau: { thoi_gian_bat_dau: '2026-11-07T01:00:00.000Z' },
        }),
      }),
    );
  });

  it('chỉ đổi trang_thai → update nhưng KHÔNG đổi cap_nhat_luc, không ghi nhật ký', async () => {
    await service.capNhat(
      lichCu,
      { trang_thai: 'ket_thuc' },
      { nguon: 'sua_tay' },
    );
    const data = prisma.lich_hoc_lop.update.mock.calls[0][0].data;
    expect(data.cap_nhat_luc).toBeUndefined();
    expect(data.trang_thai).toBe('ket_thuc');
    expect(nhatKy.ghi).not.toHaveBeenCalled();
  });
});
