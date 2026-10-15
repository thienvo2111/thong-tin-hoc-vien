import * as ExcelJS from 'exceljs';
import { ImportService } from './import.service';

jest.mock('./util/import-storage.util', () => {
  const ketQua = new Map<string, unknown>();
  const fileGoc = new Map<string, Buffer>();
  return {
    luuFileGoc: jest.fn(async (id: string, b: Buffer) => fileGoc.set(id, b)),
    docFileGoc: jest.fn(async (id: string) => fileGoc.get(id)),
    luuKetQua: jest.fn(async (id: string, k: unknown) => ketQua.set(id, k)),
    docKetQua: jest.fn(async (id: string) => ketQua.get(id) ?? null),
    luuFileLoi: jest.fn(),
    docFileLoi: jest.fn(),
  };
});

const COT = [
  'so_dinh_danh_ca_nhan',
  'ma_dinh_danh_moet',
  'ma_khoa',
  'loai',
  'muc',
];

async function taoFile(soDong: number): Promise<Express.Multer.File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mau');
  ws.addRow(COT);
  for (let i = 0; i < soDong; i++) {
    ws.addRow(['', `MA-${i}`, 'AG-2026', 'dau_vao', 'thanh_thao']);
  }
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    originalname: 'kq.xlsx',
  } as Express.Multer.File;
}

// hv-i: i % 3 === 0 -> chưa xác nhận; i % 3 === 1 -> đã xác nhận + đủ hồ
// sơ; i % 3 === 2 -> đã xác nhận nhưng thiếu hồ sơ.
describe('ImportService — ket_qua_danh_gia nạp theo lô', () => {
  let service: ImportService;
  let prisma: {
    hoc_vien: { findMany: jest.Mock };
    nhat_ky_import: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    khoa_boi_duong: { findUnique: jest.Mock };
  };
  let khoaBoiDuong: {
    napLoKetQuaDanhGia: jest.Mock;
    resolveKetQuaDanhGiaRow: jest.Mock;
    commitKetQuaDanhGiaLo: jest.Mock;
  };
  let hocVienService: { danhGiaDayDu: jest.Mock };
  let dotXacNhan: {
    hocVienCoXacNhanTruocDanhGiaConHieuLuc: jest.Mock;
    coXacNhanTruocDanhGiaConHieuLuc: jest.Mock;
  };
  const bo = {
    traHocVien: jest.fn(async (r: { ma_dinh_danh_moet?: string }) => ({
      hocVien: { id: `hv-${r.ma_dinh_danh_moet!.slice(3)}` },
    })),
  };
  const so = (id: string) => Number(id.slice(3));

  beforeEach(() => {
    prisma = {
      hoc_vien: {
        findMany: jest.fn(async ({ where }) =>
          where.id.in.map((id: string) => ({ id, chuyen_mon: [] })),
        ),
      },
      nhat_ky_import: {
        create: jest.fn(async ({ data }) => data),
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }) => data),
      },
      khoa_boi_duong: { findUnique: jest.fn() },
    };
    khoaBoiDuong = {
      napLoKetQuaDanhGia: jest.fn().mockResolvedValue(bo),
      resolveKetQuaDanhGiaRow: jest.fn(async (raw) => ({
        dto: {
          hoc_vien_id: `hv-${raw.ma_dinh_danh_moet.slice(3)}`,
          khoa_id: 'khoa-1',
          loai: 'dau_vao',
          muc: 'thanh_thao',
        },
      })),
      commitKetQuaDanhGiaLo: jest.fn().mockResolvedValue(undefined),
    };
    hocVienService = {
      danhGiaDayDu: jest.fn(async (hv) => ({ day_du: so(hv.id) % 3 === 1 })),
    };
    dotXacNhan = {
      hocVienCoXacNhanTruocDanhGiaConHieuLuc: jest.fn(
        async (ids: string[]) => new Set(ids.filter((id) => so(id) % 3 !== 0)),
      ),
      coXacNhanTruocDanhGiaConHieuLuc: jest.fn(),
    };
    const khong = {} as never;
    service = new ImportService(
      prisma as never,
      khong,
      khong,
      khong,
      hocVienService as never,
      khoaBoiDuong as never,
      dotXacNhan as never,
      khong,
      khong,
      khong,
      khong,
    );
  });

  it('kiểm tra: số truy vấn tra cứu không tăng theo số dòng', async () => {
    for (const soDong of [3, 300]) {
      jest.clearAllMocks();
      await service.taoImport(
        'ket_qua_danh_gia',
        await taoFile(soDong),
        'nd-1',
      );
      expect(khoaBoiDuong.napLoKetQuaDanhGia).toHaveBeenCalledTimes(1);
      expect(khoaBoiDuong.napLoKetQuaDanhGia.mock.calls[0][0]).toHaveLength(
        soDong,
      );
      expect(
        dotXacNhan.hocVienCoXacNhanTruocDanhGiaConHieuLuc,
      ).toHaveBeenCalledTimes(1);
      expect(prisma.hoc_vien.findMany).toHaveBeenCalledTimes(1);
      expect(dotXacNhan.coXacNhanTruocDanhGiaConHieuLuc).not.toHaveBeenCalled();
      // mọi dòng dùng chung bộ nhớ nạp sẵn
      for (const c of khoaBoiDuong.resolveKetQuaDanhGiaRow.mock.calls) {
        expect(c[1]).toBe(bo);
      }
    }
  });

  it('cảnh báo lách cổng đúng khi chưa xác nhận HOẶC xác nhận mà thiếu hồ sơ', async () => {
    const { import_id } = await service.taoImport(
      'ket_qua_danh_gia',
      await taoFile(9),
      'nd-1',
    );
    const { docKetQua } = jest.requireMock('./util/import-storage.util');
    const ketQua = await docKetQua(import_id);
    // dòng Excel = 2 + i
    expect(
      ketQua.danh_sach_canh_bao.map((c: { dong: number }) => c.dong),
    ).toEqual([0, 2, 3, 5, 6, 8].map((i) => i + 2));
    expect(ketQua.danh_sach_canh_bao[0].ly_do).toBe(
      'Học viên "MA-0" có kết quả đánh giá nhưng CHƯA đủ điều kiện làm đánh giá đầu vào tại thời điểm import (chưa xác nhận đợt xác nhận trước đánh giá hoặc hồ sơ chưa đầy đủ) — kiểm tra khả năng lách cổng',
    );
    expect(ketQua.dong_hop_le).toHaveLength(9);
    // Chỉ chạy danhGiaDayDu cho học viên đã xác nhận (6/9).
    expect(hocVienService.danhGiaDayDu).toHaveBeenCalledTimes(6);
  });

  async function xacNhanFile(soDong: number) {
    const { import_id } = await service.taoImport(
      'ket_qua_danh_gia',
      await taoFile(soDong),
      'nd-1',
    );
    jest.clearAllMocks();
    prisma.nhat_ky_import.findUnique.mockResolvedValue({
      id: import_id,
      trang_thai: 'dang_xu_ly',
      loai_danh_muc: 'ket_qua_danh_gia',
      nguoi_import_id: 'nd-1',
    });
    return import_id;
  }

  it('xác nhận: không tính cảnh báo, ghi gộp 1 lần bằng bộ nhớ nạp sẵn', async () => {
    const id = await xacNhanFile(5);
    const nhatKy = await service.xacNhan(id);
    expect(nhatKy).toMatchObject({ so_dong_thanh_cong: 5, so_dong_loi: 0 });
    expect(khoaBoiDuong.napLoKetQuaDanhGia).toHaveBeenCalledTimes(1);
    expect(hocVienService.danhGiaDayDu).not.toHaveBeenCalled();
    expect(
      dotXacNhan.hocVienCoXacNhanTruocDanhGiaConHieuLuc,
    ).not.toHaveBeenCalled();
    expect(prisma.hoc_vien.findMany).not.toHaveBeenCalled();
    expect(khoaBoiDuong.commitKetQuaDanhGiaLo).toHaveBeenCalledTimes(1);
    const [dtos, boDung] = khoaBoiDuong.commitKetQuaDanhGiaLo.mock.calls[0];
    expect(boDung).toBe(bo);
    // giữ đúng thứ tự dòng trong file
    expect(dtos.map((d: { hoc_vien_id: string }) => d.hoc_vien_id)).toEqual([
      'hv-0',
      'hv-1',
      'hv-2',
      'hv-3',
      'hv-4',
    ]);
  });

  it('xác nhận: ghi gộp lỗi -> mọi dòng báo lỗi, 0 thành công', async () => {
    const id = await xacNhanFile(3);
    khoaBoiDuong.commitKetQuaDanhGiaLo.mockRejectedValueOnce(
      new Error('mất kết nối'),
    );
    const nhatKy = await service.xacNhan(id);
    expect(nhatKy).toMatchObject({
      so_dong_thanh_cong: 0,
      so_dong_loi: 3,
      trang_thai: 'hoan_thanh',
    });
  });

  it('dòng ghi khóa khác khóa mặc định -> lỗi dòng, không đưa vào nạp lô', async () => {
    prisma.khoa_boi_duong.findUnique.mockResolvedValue({ id: 'khoa-2' });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mau');
    ws.addRow(COT);
    ws.addRow(['', 'MA-1', '', 'dau_vao', 'co_ban']);
    ws.addRow(['', 'MA-2', 'KHAC', 'dau_vao', 'co_ban']);
    const file = {
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      originalname: 'kq.xlsx',
    } as Express.Multer.File;
    await service.taoImport('ket_qua_danh_gia', file, 'nd-1', 'AG-2026');
    const daNap = khoaBoiDuong.napLoKetQuaDanhGia.mock.calls[0][0];
    expect(daNap).toHaveLength(1);
    expect(daNap[0]).toMatchObject({
      ma_dinh_danh_moet: 'MA-1',
      ma_khoa: 'AG-2026',
    });
  });

  it('loại import khác không nạp lô ket_qua_danh_gia', async () => {
    await expect(
      service.taoImport('mon_hoc', undefined, 'nd-1'),
    ).rejects.toThrow();
    expect(khoaBoiDuong.napLoKetQuaDanhGia).not.toHaveBeenCalled();
  });
});
