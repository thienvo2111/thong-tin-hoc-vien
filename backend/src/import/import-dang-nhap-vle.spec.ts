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

const COT = ['so_dinh_danh_ca_nhan', 'ma_dinh_danh_moet', 'username', 'email'];

interface Dong {
  sdd?: string;
  moet?: string;
  username?: string;
  email?: string;
}

async function taoFile(rows: Dong[]): Promise<Express.Multer.File> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Mau');
  ws.addRow(COT);
  rows.forEach((r) => ws.addRow([r.sdd ?? '', r.moet ?? '', r.username ?? '', r.email ?? '']));
  return {
    buffer: Buffer.from(await wb.xlsx.writeBuffer()),
    originalname: 'dnv.xlsx',
  } as Express.Multer.File;
}

interface HvFake {
  id: string;
  so_dinh_danh_ca_nhan: string;
}

interface DangNhapFake {
  hoc_vien_id: string;
  username: string | null;
  email_chup: string | null;
}

// hoc_vien_id đi qua @IsUUID() (DangNhapVleRowDto) nên phải là UUID hợp lệ,
// không dùng id rút gọn kiểu 'hv-1' như các spec mock resolver khác.
const HV1 = '11111111-1111-4111-8111-111111111111';
const HV2 = '22222222-2222-4222-8222-222222222222';
const HV9 = '99999999-9999-4999-8999-999999999999';

describe('ImportService — dang_nhap_vle (Vào học VLE, external-login P.CNTT)', () => {
  let service: ImportService;
  let hocVien: HvFake[];
  let dangNhap: Map<string, DangNhapFake>;
  let prisma: {
    hoc_vien: { findUnique: jest.Mock };
    $queryRaw: jest.Mock;
    dang_nhap_vle: { findFirst: jest.Mock; upsert: jest.Mock };
    nhat_ky_import: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    hocVien = [
      { id: HV1, so_dinh_danh_ca_nhan: 'SDD-1' },
      { id: HV2, so_dinh_danh_ca_nhan: 'SDD-2' },
    ];
    dangNhap = new Map();
    const nhatKyStore = new Map<string, Record<string, unknown>>();

    prisma = {
      hoc_vien: {
        findUnique: jest.fn(async ({ where }: { where: { so_dinh_danh_ca_nhan?: string; id?: string } }) => {
          if (where.so_dinh_danh_ca_nhan) {
            return hocVien.find((h) => h.so_dinh_danh_ca_nhan === where.so_dinh_danh_ca_nhan) ?? null;
          }
          if (where.id) return hocVien.find((h) => h.id === where.id) ?? null;
          return null;
        }),
      },
      // timCacHocVienIdTheoMaMoet (common/utils/ma-moet.util.ts) gọi $queryRaw thô —
      // mock trả trực tiếp kết quả mong muốn cho từng test, không parse SQL.
      $queryRaw: jest.fn(async () => []),
      dang_nhap_vle: {
        findFirst: jest.fn(
          async ({
            where,
          }: {
            where: {
              hoc_vien_id?: { not: string };
              username?: { equals: string };
              email_chup?: { equals: string };
            };
          }) => {
            for (const r of dangNhap.values()) {
              if (where.hoc_vien_id?.not && r.hoc_vien_id === where.hoc_vien_id.not) continue;
              if (where.username && r.username?.toLowerCase() === where.username.equals.toLowerCase()) return r;
              if (where.email_chup && r.email_chup?.toLowerCase() === where.email_chup.equals.toLowerCase()) return r;
            }
            return null;
          },
        ),
        upsert: jest.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { hoc_vien_id: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const existing = dangNhap.get(where.hoc_vien_id);
            const bo = (obj: Record<string, unknown>) =>
              Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
            const data = existing
              ? { ...existing, ...bo(update) }
              : { hoc_vien_id: where.hoc_vien_id, username: null, email_chup: null, ...bo(create) };
            dangNhap.set(where.hoc_vien_id, data as DangNhapFake);
            return data;
          },
        ),
      },
      nhat_ky_import: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          nhatKyStore.set(data.id as string, data);
          return data;
        }),
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => nhatKyStore.get(where.id) ?? null),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const next = { ...nhatKyStore.get(where.id), ...data };
          nhatKyStore.set(where.id, next);
          return next;
        }),
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

  async function taoVaXacNhan(rows: Dong[]) {
    const { import_id } = await service.taoImport('dang_nhap_vle', await taoFile(rows), 'nd-1');
    return import_id;
  }

  async function layPreview(importId: string) {
    const { docKetQua } = jest.requireMock('./util/import-storage.util');
    return docKetQua(importId);
  }

  it('mỗi dòng phải có ít nhất 1 trong username/email', async () => {
    const id = await taoVaXacNhan([{ sdd: 'SDD-1' }]);
    const preview = await layPreview(id);
    expect(preview.dong_hop_le).toHaveLength(0);
    expect(preview.danh_sach_loi).toHaveLength(1);
    expect(preview.danh_sach_loi[0].ly_do).toContain('username');
  });

  it('email sai định dạng -> lỗi dòng', async () => {
    const id = await taoVaXacNhan([{ sdd: 'SDD-1', email: 'khong-phai-email' }]);
    const preview = await layPreview(id);
    expect(preview.dong_hop_le).toHaveLength(0);
    expect(preview.danh_sach_loi).toHaveLength(1);
  });

  it('trùng học viên trong cùng file -> dòng thứ 2 báo lỗi', async () => {
    const id = await taoVaXacNhan([
      { sdd: 'SDD-1', username: 'u1' },
      { sdd: 'SDD-1', username: 'u1-khac' },
    ]);
    const preview = await layPreview(id);
    expect(preview.dong_hop_le).toHaveLength(1);
    expect(preview.danh_sach_loi).toHaveLength(1);
    expect(preview.danh_sach_loi[0].ly_do).toContain('học viên');
  });

  it('trùng username giữa 2 học viên khác nhau trong file -> dòng thứ 2 báo lỗi', async () => {
    const id = await taoVaXacNhan([
      { sdd: 'SDD-1', username: 'trung-nhau' },
      { sdd: 'SDD-2', username: 'trung-nhau' },
    ]);
    const preview = await layPreview(id);
    expect(preview.dong_hop_le).toHaveLength(1);
    expect(preview.danh_sach_loi[0].ly_do).toContain('username');
  });

  it('trùng email với học viên khác ĐÃ CÓ trong hệ thống -> báo lỗi', async () => {
    dangNhap.set(HV9, { hoc_vien_id: HV9, username: null, email_chup: 'da-dung@x.com' });
    const id = await taoVaXacNhan([{ sdd: 'SDD-1', email: 'DA-DUNG@X.COM' }]);
    const preview = await layPreview(id);
    expect(preview.dong_hop_le).toHaveLength(0);
    expect(preview.danh_sach_loi[0].ly_do).toMatch(/email/i);
  });

  it('chuẩn hóa email viết thường khi nạp chính thức', async () => {
    const id = await taoVaXacNhan([{ sdd: 'SDD-1', email: 'A@Example.COM' }]);
    await service.xacNhan(id);
    expect(dangNhap.get(HV1)?.email_chup).toBe('a@example.com');
  });

  it('ô trống giữ nguyên giá trị cũ, không null hóa khi chạy lại file', async () => {
    const id1 = await taoVaXacNhan([{ sdd: 'SDD-1', username: 'u1', email: 'u1@x.com' }]);
    await service.xacNhan(id1);
    expect(dangNhap.get(HV1)).toMatchObject({ username: 'u1', email_chup: 'u1@x.com' });

    const id2 = await taoVaXacNhan([{ sdd: 'SDD-1', username: 'u1-moi' }]); // email để trống
    await service.xacNhan(id2);
    expect(dangNhap.get(HV1)).toMatchObject({ username: 'u1-moi', email_chup: 'u1@x.com' });
  });

  it('khớp mã MOET bỏ số 0 đầu qua resolver chung (resolveHocVienImportRow)', async () => {
    // mockResolvedValue (không phải Once): buildDangNhapVleDto chạy lại ở cả
    // 2 lượt (xem trước + xác nhận), cả 2 lượt đều phải tra ra cùng học viên.
    prisma.$queryRaw.mockResolvedValue([{ id: HV2, chinh_xac: false }]);
    const id = await taoVaXacNhan([{ moet: '0092', username: 'u2' }]);
    await service.xacNhan(id);
    expect(dangNhap.get(HV2)).toMatchObject({ username: 'u2' });
  });
});
