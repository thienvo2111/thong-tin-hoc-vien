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

// Mỗi test đọc/ghi Excel 1–2 lần; máy chậm có thể vượt 5 s mặc định khi chạy song song.
jest.setTimeout(30000);

const COT = [
  'ma_diem_hoc',
  'ten',
  'dia_chi',
  'ma_dia_ban',
  'ma_don_vi',
  'suc_chua',
  'so_phong',
  'nguoi_lien_he',
  'sdt_lien_he',
  'ghi_chu_csvc',
];

type Dong = Partial<Record<(typeof COT)[number], string>>;

async function taoFile(
  rows: Dong[],
  cot: string[] = COT,
): Promise<Express.Multer.File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mau');
  ws.addRow(cot);
  rows.forEach((r) => ws.addRow(cot.map((c) => r[c] ?? '')));
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    originalname: 'diem-hoc.xlsx',
  } as Express.Multer.File;
}

// dia_ban_id/don_vi_id/id đi qua @IsUUID() (DiemHocRowDto) nên phải là UUID hợp lệ.
const XA_RACH_GIA = '11111111-1111-4111-8111-111111111111';
const DV_NHS = '22222222-2222-4222-8222-222222222222';
const DH_CU = '33333333-3333-4333-8333-333333333333';

interface DiemHocFake {
  id: string;
  ma_diem_hoc: string;
  ten: string;
  dia_chi: string;
  dia_ban_id: string;
  don_vi_id?: string | null;
  suc_chua?: number | null;
  so_phong?: number | null;
  nguoi_lien_he?: string | null;
  sdt_lien_he?: string | null;
  ghi_chu_csvc?: string | null;
  trang_thai: string;
  tao_boi?: string;
}

const DONG_DU: Dong = {
  ma_diem_hoc: 'DH-AG-014',
  ten: 'Trường THPT Nguyễn Hùng Sơn',
  dia_chi: 'Trường THPT Nguyễn Hùng Sơn, Phường Rạch Giá, tỉnh An Giang',
  ma_dia_ban: '30742',
  ma_don_vi: 'TR-91-014',
  suc_chua: '60',
  so_phong: '2',
  nguoi_lien_he: 'Phòng giáo vụ',
  sdt_lien_he: '0297000000',
  ghi_chu_csvc: 'Có máy chiếu',
};

describe('ImportService — diem_hoc (danh mục điểm học)', () => {
  let service: ImportService;
  let diemHoc: Map<string, DiemHocFake>;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    diemHoc = new Map();
    const nhatKyStore = new Map<string, Record<string, unknown>>();
    let soId = 0;
    prisma = {
      dia_danh: {
        findUnique: jest.fn(async ({ where }: { where: { ma: string } }) =>
          where.ma === '30742' ? { id: XA_RACH_GIA } : null,
        ),
      },
      don_vi_cong_tac: {
        findUnique: jest.fn(
          async ({ where }: { where: { ma_don_vi: string } }) =>
            where.ma_don_vi === 'TR-91-014' ? { id: DV_NHS } : null,
        ),
      },
      diem_hoc: {
        findUnique: jest.fn(
          async ({ where }: { where: { ma_diem_hoc: string } }) => {
            const d = [...diemHoc.values()].find(
              (x) => x.ma_diem_hoc === where.ma_diem_hoc,
            );
            return d ? { id: d.id } : null;
          },
        ),
        create: jest.fn(
          async ({
            data,
          }: {
            data: Omit<DiemHocFake, 'id' | 'trang_thai'>;
          }) => {
            soId += 1;
            const row = { id: `moi-${soId}`, trang_thai: 'active', ...data };
            diemHoc.set(row.id, row as DiemHocFake);
            return row;
          },
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Partial<DiemHocFake>;
          }) => {
            const bo = Object.fromEntries(
              Object.entries(data).filter(([, v]) => v !== undefined),
            );
            const row = { ...diemHoc.get(where.id)!, ...bo };
            diemHoc.set(where.id, row);
            return row;
          },
        ),
      },
      nhat_ky_import: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          nhatKyStore.set(data.id as string, data);
          return data;
        }),
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) =>
            nhatKyStore.get(where.id) ?? null,
        ),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const next = { ...nhatKyStore.get(where.id), ...data };
            nhatKyStore.set(where.id, next);
            return next;
          },
        ),
      },
    };
    const khong = {} as never;
    service = new ImportService(
      prisma as never,
      khong,
      khong,
      khong,
      khong,
      khong,
      khong,
      khong,
      khong,
      khong,
      khong,
    );
  });

  async function tao(rows: Dong[]) {
    const { import_id } = await service.taoImport(
      'diem_hoc',
      await taoFile(rows),
      'nd-1',
    );
    return import_id;
  }
  async function preview(importId: string) {
    const { docKetQua } = jest.requireMock('./util/import-storage.util');
    return docKetQua(importId);
  }
  async function loiDauTien(dong: Dong): Promise<string> {
    const p = await preview(await tao([dong]));
    expect(p.dong_hop_le).toHaveLength(0);
    expect(p.danh_sach_loi).toHaveLength(1);
    return p.danh_sach_loi[0].ly_do as string;
  }

  it('dòng đầy đủ: tạo điểm học mới, tra mã địa bàn/đơn vị ra id, người import là tao_boi', async () => {
    const id = await tao([DONG_DU]);
    expect((await preview(id)).dong_hop_le).toHaveLength(1);
    await service.xacNhan(id);
    const ds = [...diemHoc.values()];
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({
      ma_diem_hoc: 'DH-AG-014',
      dia_ban_id: XA_RACH_GIA,
      don_vi_id: DV_NHS,
      suc_chua: 60,
      so_phong: 2,
      nguoi_lien_he: 'Phòng giáo vụ',
      tao_boi: 'nd-1',
      trang_thai: 'active',
    });
  });

  it('chỉ cột bắt buộc (ma_don_vi, số, liên hệ để trống) vẫn tạo được', async () => {
    const id = await tao([
      {
        ma_diem_hoc: 'DH-1',
        ten: 'Điểm 1',
        dia_chi: 'Số 1',
        ma_dia_ban: '30742',
      },
    ]);
    await service.xacNhan(id);
    const d = [...diemHoc.values()][0];
    expect(d).toMatchObject({ ma_diem_hoc: 'DH-1', dia_ban_id: XA_RACH_GIA });
    expect(d.don_vi_id).toBeUndefined();
    expect(d.suc_chua).toBeUndefined();
  });

  it('mã đã có trong hệ thống: cập nhật đúng điểm đó, ô tùy chọn trống giữ giá trị cũ, giữ trạng thái', async () => {
    diemHoc.set(DH_CU, {
      id: DH_CU,
      ma_diem_hoc: 'DH-AG-014',
      ten: 'Tên cũ',
      dia_chi: 'Địa chỉ cũ',
      dia_ban_id: XA_RACH_GIA,
      nguoi_lien_he: 'Cô Lan',
      suc_chua: 45,
      trang_thai: 'ngung',
    });
    const id = await tao([
      {
        ma_diem_hoc: 'DH-AG-014',
        ten: 'Tên mới',
        dia_chi: 'Địa chỉ mới',
        ma_dia_ban: '30742',
        so_phong: '3',
      },
    ]);
    await service.xacNhan(id);
    expect(diemHoc.size).toBe(1);
    expect(prisma.diem_hoc.create).not.toHaveBeenCalled();
    expect(diemHoc.get(DH_CU)).toMatchObject({
      ten: 'Tên mới',
      dia_chi: 'Địa chỉ mới',
      so_phong: 3,
      suc_chua: 45,
      nguoi_lien_he: 'Cô Lan',
      trang_thai: 'ngung',
    });
  });

  it.each([
    ['ma_diem_hoc', 'ma_diem_hoc'],
    ['ten', 'ten'],
    ['dia_chi', 'dia_chi'],
    ['ma_dia_ban', 'ma_dia_ban'],
  ])('thiếu cột bắt buộc %s -> lỗi dòng', async (cot, chu) => {
    expect(await loiDauTien({ ...DONG_DU, [cot]: '' })).toContain(chu);
  });

  it('mã điểm học có dấu/khoảng trắng hoặc dài hơn 30 ký tự -> lỗi', async () => {
    expect(await loiDauTien({ ...DONG_DU, ma_diem_hoc: 'Điểm 1' })).toContain(
      'Mã điểm học',
    );
    expect(
      await loiDauTien({ ...DONG_DU, ma_diem_hoc: 'A'.repeat(31) }),
    ).toContain('Mã điểm học');
  });

  it('mã địa bàn không tồn tại -> lỗi', async () => {
    expect(await loiDauTien({ ...DONG_DU, ma_dia_ban: '99999' })).toContain(
      'Mã địa bàn',
    );
  });

  it('mã đơn vị không tồn tại -> lỗi', async () => {
    expect(await loiDauTien({ ...DONG_DU, ma_don_vi: 'TR-XX-000' })).toContain(
      'Mã đơn vị',
    );
  });

  it.each([['0'], ['-3'], ['2,5'], ['abc']])(
    'suc_chua/so_phong "%s" không phải số nguyên dương -> lỗi',
    async (v) => {
      expect(await loiDauTien({ ...DONG_DU, suc_chua: v })).toContain(
        'suc_chua',
      );
      expect(await loiDauTien({ ...DONG_DU, so_phong: v })).toContain(
        'so_phong',
      );
    },
  );

  it('2 dòng cùng ma_diem_hoc trong file -> dòng sau lỗi, dòng đầu vẫn nạp', async () => {
    const id = await tao([DONG_DU, { ...DONG_DU, ten: 'Bản trùng' }]);
    const p = await preview(id);
    expect(p.dong_hop_le).toHaveLength(1);
    expect(p.danh_sach_loi).toHaveLength(1);
    expect(p.danh_sach_loi[0].ly_do).toContain('Trùng ma_diem_hoc');
    await service.xacNhan(id);
    expect([...diemHoc.values()].map((d) => d.ten)).toEqual([
      'Trường THPT Nguyễn Hùng Sơn',
    ]);
  });

  it('vượt độ dài (sdt_lien_he > 20, ten > 255) -> lỗi dòng', async () => {
    const p1 = await preview(
      await tao([{ ...DONG_DU, sdt_lien_he: '0'.repeat(21) }]),
    );
    expect(p1.danh_sach_loi).toHaveLength(1);
    const p2 = await preview(await tao([{ ...DONG_DU, ten: 'x'.repeat(256) }]));
    expect(p2.danh_sach_loi).toHaveLength(1);
  });

  it('file thiếu cột so với mẫu -> báo lỗi cấp file, không nạp', async () => {
    const file = await taoFile([DONG_DU], COT.slice(0, 4));
    await expect(
      service.taoImport('diem_hoc', file, 'nd-1'),
    ).rejects.toMatchObject({
      response: {
        error: expect.objectContaining({
          message: expect.stringContaining('không đúng mẫu'),
        }),
      },
    });
    expect(prisma.diem_hoc.create).not.toHaveBeenCalled();
  });
});
