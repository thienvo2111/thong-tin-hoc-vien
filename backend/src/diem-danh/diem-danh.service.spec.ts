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
    $queryRaw: jest.Mock;
  };
  let doiBuoi: {
    dieuChinhTheoBuoi: jest.Mock;
    doiBuoiDaDuyetCuaDangKy: jest.Mock;
    lichTomTat: jest.Mock;
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
      $queryRaw: jest.fn().mockResolvedValue([]),
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
      lichTomTat: jest.fn().mockResolvedValue(new Map()),
    };
    service = new DiemDanhService(
      prisma as unknown as PrismaService,
      {} as HoTroGiangVienScopeService,
      doiBuoi as unknown as DoiBuoiHocQueryService,
    );
  });

  it('bảng điểm danh: người đổi vào ở danh sách riêng kèm nhãn, chỉ ô buổi chốt, nạp trong 1 truy vấn', async () => {
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      {
        ...dk('dk-a', 'An Lớp A'),
        diem_danh: [
          {
            lich_hoc_id: 'b-1',
            trang_thai: 'co_mat',
            nguon: 'ky_ten',
            ghi_chu: null,
            tu_diem_danh_luc: null,
            cap_nhat_luc: now,
            sua_boi: null,
          },
          {
            lich_hoc_id: 'b-9',
            trang_thai: 'vang',
            nguon: 'ky_ten',
            ghi_chu: null,
            tu_diem_danh_luc: null,
            cap_nhat_luc: now,
            sua_boi: null,
          },
        ],
      },
    ]);
    const bang = await service.bangDiemDanh(quanTri, 'lop-b', 'gd-1', now);
    // Danh sách lớp gốc không đổi số lượng.
    expect(bang.hoc_vien.map((h) => h.dang_ky_hoc_id)).toEqual(['dk-b']);
    expect(bang.hoc_vien[0]).not.toHaveProperty('doi_buoi');
    expect(bang.hoc_vien_doi_vao).toHaveLength(1);
    expect(bang.hoc_vien_doi_vao[0]).toMatchObject({
      dang_ky_hoc_id: 'dk-a',
      doi_buoi: { 'b-1': { loai: 'vao', lop: 'Lớp A' } },
    });
    expect(Object.keys(bang.hoc_vien_doi_vao[0].diem_danh)).toEqual(['b-1']);
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

  it('học bù (ADR 0012): bảng điểm danh gắn nhãn hoc_bu ở buổi chốt; sửa ô ở buổi chốt được', async () => {
    doiBuoi.dieuChinhTheoBuoi.mockResolvedValue(
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
                loai: 'hoc_bu',
              },
            ],
          },
        ],
      ]),
    );
    prisma.dang_ky_hoc.findMany.mockResolvedValue([
      { ...dk('dk-a', 'An Lớp A'), diem_danh: [] },
    ]);
    const bang = await service.bangDiemDanh(quanTri, 'lop-b', 'gd-1', now);
    expect(bang.hoc_vien_doi_vao[0].doi_buoi).toEqual({
      'b-1': { loai: 'vao', lop: 'Lớp A', hoc_bu: true },
    });
    doiBuoi.doiBuoiDaDuyetCuaDangKy.mockResolvedValue([
      { dang_ky_hoc_id: 'dk-a', lich_nguon_id: 'a-1', lich_chot_id: 'b-1', loai: 'hoc_bu' },
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

  // ADR 0014: ô lớp khác (lớp cũ trước khi chuyển / học bù) theo tinhChuyenCan.
  describe('ô được công nhận từ lớp khác', () => {
    const sqlCo = (q: unknown, chu: string) =>
      (q as { strings: string[] }).strings.join('').includes(chu);
    function gia(o: {
      cheDo: string;
      loaiLopCu?: string;
      mucCu?: string | null;
      mucMoi?: string | null;
      trangThai?: string;
    }) {
      prisma.$queryRaw.mockImplementation((q: unknown) => {
        if (sqlCo(q, 'FROM diem_danh')) {
          return Promise.resolve([
            {
              dang_ky_hoc_id: 'dk-b',
              lich_hoc_id: 'a-1',
              trang_thai: o.trangThai ?? 'co_mat',
              nguon: 'zoom',
              tu_diem_danh_luc: null,
              lop_id: 'lop-a',
              giai_doan_id: 'gd-1',
              buoi_so: 1,
              loai_lop: o.loaiLopCu ?? 'zoom',
              ten_lop: 'Lớp A',
              muc_nang_luc: o.mucCu ?? null,
              che_do_chuyen_can: o.cheDo,
            },
          ]);
        }
        return Promise.resolve([
          {
            dang_ky_hoc_id: 'dk-b',
            giai_doan_id: 'gd-1',
            lop_id: 'lop-b',
            muc_nang_luc: o.mucMoi ?? null,
          },
        ]);
      });
      doiBuoi.dieuChinhTheoBuoi.mockResolvedValue(new Map());
    }
    const bang = () => service.bangDiemDanh(quanTri, 'lop-b', 'gd-1', now);

    it.each([
      ['cong_nhan_lop_cu', 'zoom', 'co_ban', 'nang_cao', true],
      ['cong_nhan_cung_muc', 'zoom', 'co_ban', 'co_ban', true],
      ['cong_nhan_cung_muc', 'zoom', null, null, true],
      ['cong_nhan_cung_muc', 'zoom', 'co_ban', 'nang_cao', false],
      ['theo_lop_hien_tai', 'zoom', 'co_ban', 'co_ban', false],
      ['theo_lop_hien_tai', 'truc_tiep', 'co_ban', 'nang_cao', true],
    ])(
      'nấc %s, lớp cũ %s, mức %s -> %s: có ô lớp khác = %s',
      async (cheDo, loaiLopCu, mucCu, mucMoi, co) => {
        gia({ cheDo, loaiLopCu, mucCu, mucMoi });
        const o = (await bang()).hoc_vien[0].diem_danh['b-1'];
        if (!co) {
          expect(o).toBeUndefined();
          return;
        }
        expect(o).toMatchObject({
          trang_thai: 'co_mat',
          nhan: 'Có mặt – ở lớp Lớp A',
          nguon_tinh: 'lop_khac',
          lop_tinh: { id: 'lop-a', ten_lop: 'Lớp A' },
          sua_duoc: false,
        });
      },
    );

    it('vắng có phép ở lớp cũ -> nhãn "Vắng có phép – ở lớp X"', async () => {
      gia({ cheDo: 'cong_nhan_lop_cu', trangThai: 'vang_co_phep' });
      expect((await bang()).hoc_vien[0].diem_danh['b-1']).toMatchObject({
        nhan: 'Vắng có phép – ở lớp Lớp A',
      });
    });

    it('đã có dòng tại buổi của lớp này -> giữ ô cũ (sửa được), không thay', async () => {
      gia({ cheDo: 'cong_nhan_lop_cu' });
      prisma.phan_lop_giai_doan.findMany.mockResolvedValue([
        {
          dang_ky_hoc: {
            ...dk('dk-b', 'Bình Lớp B'),
            diem_danh: [
              {
                lich_hoc_id: 'b-1',
                trang_thai: 'vang',
                nguon: 'ky_ten',
                ghi_chu: null,
                tu_diem_danh_luc: null,
                cap_nhat_luc: now,
                sua_boi: null,
              },
            ],
          },
        },
      ]);
      const o = (await bang()).hoc_vien[0].diem_danh['b-1'];
      expect(o).toMatchObject({ trang_thai: 'vang', nguon: 'ky_ten' });
      expect(o).not.toHaveProperty('nguon_tinh');
    });

    it('học viên đã đổi buổi ra khỏi buổi này -> không thêm ô lớp khác', async () => {
      gia({ cheDo: 'cong_nhan_lop_cu' });
      doiBuoi.dieuChinhTheoBuoi.mockResolvedValue(
        new Map([
          [
            'b-1',
            {
              ra: [{ dang_ky_hoc_id: 'dk-b', lop_chot: { ten_lop: 'Lớp C' } }],
              vao: [],
            },
          ],
        ]),
      );
      const hv = (await bang()).hoc_vien[0];
      expect(hv.doi_buoi).toEqual({ 'b-1': { loai: 'ra', lop: 'Lớp C' } });
      expect(hv.diem_danh['b-1']).toBeUndefined();
    });

    it('nạp theo lô: 2 truy vấn SQL cho cả lớp dù nhiều học viên', async () => {
      gia({ cheDo: 'cong_nhan_lop_cu' });
      prisma.phan_lop_giai_doan.findMany.mockResolvedValue(
        Array.from({ length: 30 }, (_, i) => ({
          dang_ky_hoc: dk(`dk-${i}`, `HV ${i}`),
        })),
      );
      await bang();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(doiBuoi.doiBuoiDaDuyetCuaDangKy).toHaveBeenCalledTimes(1);
    });
  });
});
