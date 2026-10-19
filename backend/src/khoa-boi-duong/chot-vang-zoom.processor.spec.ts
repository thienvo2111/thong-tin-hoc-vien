import { ChotVangZoomProcessor } from './chot-vang-zoom.processor';
import { PrismaService } from '../prisma/prisma.service';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';

// Spec đổi buổi (R11): chốt vắng buổi Zoom đi theo đổi buổi đã duyệt còn hiệu
// lực — người đổi ra không bị vắng ở buổi nguồn, người đổi vào chưa bấm thì
// vắng ở buổi chốt.
describe('ChotVangZoomProcessor — đổi buổi', () => {
  const batDau = new Date('2026-11-06T01:00:00Z');
  const now = new Date(batDau.getTime() + 3 * 3600 * 1000); // đã đóng cửa sổ
  const phanLop = (dk: string, coBaoVang = false) => ({
    dang_ky_hoc_id: dk,
    dang_ky_hoc: { bao_vang: coBaoVang ? [{ id: 'bv' }] : [] },
  });
  let tx: {
    lich_hoc_lop: { updateMany: jest.Mock };
    doi_buoi_hoc: { findMany: jest.Mock };
    phan_lop_giai_doan: { findMany: jest.Mock };
    dang_ky_hoc: { findMany: jest.Mock };
    diem_danh: { createMany: jest.Mock };
  };
  let query: { doiBuoiDaDuyetCuaDangKy: jest.Mock };
  let processor: ChotVangZoomProcessor;

  beforeEach(() => {
    tx = {
      lich_hoc_lop: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      doi_buoi_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      phan_lop_giai_doan: {
        findMany: jest
          .fn()
          .mockResolvedValue([phanLop('dk-o-lai'), phanLop('dk-doi-ra')]),
      },
      dang_ky_hoc: { findMany: jest.fn().mockResolvedValue([]) },
      diem_danh: {
        createMany: jest
          .fn()
          .mockImplementation(({ data }: { data: unknown[] }) => ({
            count: data.length,
          })),
      },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'lich-1',
          lop_id: 'lop-1',
          giai_doan_id: 'gd-1',
          thoi_gian_bat_dau: batDau,
          diem_danh_mo_truoc_phut: 30,
          diem_danh_dong_sau_phut: 120,
        },
      ]),
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    query = { doiBuoiDaDuyetCuaDangKy: jest.fn().mockResolvedValue([]) };
    processor = new ChotVangZoomProcessor(
      prisma as unknown as PrismaService,
      query as unknown as DoiBuoiHocQueryService,
    );
  });

  const dongGhi = () =>
    (
      tx.diem_danh.createMany.mock.calls[0][0] as {
        data: { dang_ky_hoc_id: string; trang_thai: string }[];
      }
    ).data;

  it('không có đổi buổi → như cũ, không gọi module truy vấn', async () => {
    const kq = await processor.chotVang(now);
    expect(kq).toEqual({ so_buoi: 1, so_dong_vang: 2 });
    expect(query.doiBuoiDaDuyetCuaDangKy).not.toHaveBeenCalled();
    expect(tx.dang_ky_hoc.findMany).not.toHaveBeenCalled();
  });

  it('người đổi ra hiệu lực bị bỏ qua; người đổi vào chưa có dòng bị ghi vắng; 1 lượt tra / buổi', async () => {
    tx.doi_buoi_hoc.findMany.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-doi-ra' },
      { dang_ky_hoc_id: 'dk-doi-vao' },
      { dang_ky_hoc_id: 'dk-mat-hieu-luc' },
    ]);
    query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      {
        dang_ky_hoc_id: 'dk-doi-ra',
        lich_nguon_id: 'lich-1',
        lich_chot_id: 'x',
      },
      {
        dang_ky_hoc_id: 'dk-doi-vao',
        lich_nguon_id: 'y',
        lich_chot_id: 'lich-1',
      },
    ]);
    tx.dang_ky_hoc.findMany.mockResolvedValue([
      { id: 'dk-doi-vao', bao_vang: [{ id: 'bv' }] },
    ]);

    await processor.chotVang(now);

    expect(tx.doi_buoi_hoc.findMany.mock.calls[0][0].where).toEqual({
      trang_thai: 'da_duyet',
      OR: [{ lich_nguon_id: 'lich-1' }, { lich_chot_id: 'lich-1' }],
    });
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
    expect(query.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledWith([
      'dk-doi-ra',
      'dk-doi-vao',
      'dk-mat-hieu-luc',
    ]);
    expect(tx.dang_ky_hoc.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ['dk-doi-vao'] },
      diem_danh: { none: { lich_hoc_id: 'lich-1' } },
    });
    expect(dongGhi().map((d) => [d.dang_ky_hoc_id, d.trang_thai])).toEqual([
      ['dk-o-lai', 'vang'],
      ['dk-doi-vao', 'vang_co_phep'],
    ]);
  });

  it('học bù (ADR 0012): KHÔNG bỏ qua người học bù ở buổi gốc; người học bù vào buổi chốt vẫn bị chốt vắng', async () => {
    tx.doi_buoi_hoc.findMany.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-doi-ra' },
      { dang_ky_hoc_id: 'dk-hoc-bu-vao' },
    ]);
    query.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      {
        dang_ky_hoc_id: 'dk-doi-ra',
        lich_nguon_id: 'lich-1',
        lich_chot_id: 'x',
        loai: 'hoc_bu',
      },
      {
        dang_ky_hoc_id: 'dk-hoc-bu-vao',
        lich_nguon_id: 'y',
        lich_chot_id: 'lich-1',
        loai: 'hoc_bu',
      },
    ]);
    tx.dang_ky_hoc.findMany.mockResolvedValue([
      { id: 'dk-hoc-bu-vao', bao_vang: [] },
    ]);

    await processor.chotVang(now);

    expect(dongGhi().map((d) => [d.dang_ky_hoc_id, d.trang_thai])).toEqual([
      ['dk-o-lai', 'vang'],
      ['dk-doi-ra', 'vang'],
      ['dk-hoc-bu-vao', 'vang'],
    ]);
  });
});
