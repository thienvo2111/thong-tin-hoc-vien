import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';
import { DoiBuoiHocQueryService } from '../doi-buoi-hoc/doi-buoi-hoc-query.service';

// ADR 0008 L2 + ADR 0011 P1: phạm vi = cụm ∪ lớp (phân lớp gốc HOẶC đổi buổi
// da_duyet còn hiệu lực vào buổi của lớp). Prisma giả lập bảng đăng ký, phân
// lớp, đổi buổi nhỏ và tự đánh giá điều kiện where; DoiBuoiHocQueryService là
// bản THẬT (quy tắc hiệu lực dùng chung) — test theo yêu cầu, không theo hình
// dạng truy vấn.
interface PhanLopGia {
  giai_doan_id: string;
  lop_id: string;
}
interface DangKyGia {
  id: string;
  hoc_vien_id: string;
  cum_id: string | null;
  phan_lop: PhanLopGia[];
}
interface DoiBuoiGia {
  dang_ky_hoc_id: string;
  trang_thai: 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'da_huy';
  nguon: PhanLopGia;
  lop_chot: string;
}

type DieuKien = Record<string, unknown>;
type In = { in?: string[] };

const GIAI_DOAN: Record<string, { thu_tu: number; thoi_gian_bat_dau: Date }> = {
  gd1: { thu_tu: 1, thoi_gian_bat_dau: new Date('2026-10-01') },
  gd2: { thu_tu: 2, thoi_gian_bat_dau: new Date('2026-11-01') },
};

describe('HoTroHocVienScopeService — phạm vi cụm ∪ lớp (ADR 0008, ADR 0011)', () => {
  const ND = 'nd-ho-tro';
  let cumCuaToi: string[];
  let lopCuaToi: string[];
  let dangKy: DangKyGia[];
  let doiBuoi: DoiBuoiGia[];
  let service: HoTroHocVienScopeService;

  function khop(dk: DangKyGia, w: DieuKien): boolean {
    if (Array.isArray(w.AND))
      return (w.AND as DieuKien[]).every((x) => khop(dk, x));
    if (Array.isArray(w.OR))
      return (w.OR as DieuKien[]).some((x) => khop(dk, x));
    return Object.entries(w).every(([k, v]) => {
      const val = v as In & { some?: { lop_id?: { in: string[] } } };
      if (k === 'id') return !!val.in?.includes(dk.id);
      if (k === 'hoc_vien_id') return dk.hoc_vien_id === v;
      if (k === 'cum_id') return !!dk.cum_id && !!val.in?.includes(dk.cum_id);
      if (k === 'phan_lop_giai_doan')
        return dk.phan_lop.some((p) => val.some?.lop_id?.in.includes(p.lop_id));
      throw new Error(`Điều kiện chưa hỗ trợ: ${k}`);
    });
  }

  const hocVienCua = (dangKyId: string) =>
    dangKy.find((d) => d.id === dangKyId)!.hoc_vien_id;

  beforeEach(() => {
    cumCuaToi = [];
    lopCuaToi = [];
    dangKy = [
      {
        id: 'dk-cum',
        hoc_vien_id: 'hv-cum',
        cum_id: 'cum-1',
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-9' }],
      },
      {
        id: 'dk-lop',
        hoc_vien_id: 'hv-lop',
        cum_id: 'cum-9',
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-1' }],
      },
      {
        id: 'dk-ca-hai',
        hoc_vien_id: 'hv-ca-hai',
        cum_id: 'cum-1',
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-1' }],
      },
      {
        id: 'dk-doi-buoi',
        hoc_vien_id: 'hv-doi-buoi',
        cum_id: null,
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-2' }],
      },
      {
        id: 'dk-het-hieu-luc',
        hoc_vien_id: 'hv-het-hieu-luc',
        cum_id: null,
        // Đã duyệt đổi từ lop-2 sang lop-1, sau đó Quản trị phân lại vào lop-3.
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-3' }],
      },
      {
        id: 'dk-chua-duyet',
        hoc_vien_id: 'hv-chua-duyet',
        cum_id: null,
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-2' }],
      },
      {
        id: 'dk-ngoai',
        hoc_vien_id: 'hv-ngoai',
        cum_id: 'cum-9',
        phan_lop: [{ giai_doan_id: 'gd1', lop_id: 'lop-9' }],
      },
    ];
    const nguonLop2 = { giai_doan_id: 'gd1', lop_id: 'lop-2' };
    doiBuoi = [
      {
        dang_ky_hoc_id: 'dk-doi-buoi',
        trang_thai: 'da_duyet',
        nguon: nguonLop2,
        lop_chot: 'lop-1',
      },
      {
        dang_ky_hoc_id: 'dk-het-hieu-luc',
        trang_thai: 'da_duyet',
        nguon: nguonLop2,
        lop_chot: 'lop-1',
      },
      ...(['cho_duyet', 'tu_choi', 'da_huy'] as const).map((trang_thai) => ({
        dang_ky_hoc_id: 'dk-chua-duyet',
        trang_thai,
        nguon: nguonLop2,
        lop_chot: 'lop-1',
      })),
    ];
    const prisma = {
      phan_cong_ho_tro: {
        findMany: jest.fn(() =>
          Promise.resolve(cumCuaToi.map((cum_id) => ({ cum_id }))),
        ),
      },
      phan_cong_ho_tro_lop: {
        findMany: jest.fn(() =>
          Promise.resolve(lopCuaToi.map((lop_id) => ({ lop_id }))),
        ),
        count: jest.fn(({ where }: { where: { lop_id: string } }) =>
          Promise.resolve(lopCuaToi.filter((l) => l === where.lop_id).length),
        ),
      },
      dang_ky_hoc: {
        count: jest.fn(({ where }: { where: DieuKien }) =>
          Promise.resolve(dangKy.filter((d) => khop(d, where)).length),
        ),
      },
      phan_lop_giai_doan: {
        findMany: jest.fn(({ where }: { where: DieuKien }) => {
          const tatCa = dangKy.flatMap((d) =>
            d.phan_lop.map((p) => ({ ...p, dk: d })),
          );
          // locHieuLuc: phân lớp hiện tại theo (đăng ký, giai đoạn).
          if (Array.isArray(where.OR)) {
            const cap = where.OR as {
              dang_ky_hoc_id: string;
              giai_doan_id: string;
            }[];
            return Promise.resolve(
              tatCa
                .filter((p) =>
                  cap.some(
                    (c) =>
                      c.dang_ky_hoc_id === p.dk.id &&
                      c.giai_doan_id === p.giai_doan_id,
                  ),
                )
                .map((p) => ({
                  dang_ky_hoc_id: p.dk.id,
                  giai_doan_id: p.giai_doan_id,
                  lop_id: p.lop_id,
                })),
            );
          }
          // lopCuaHocVien: phân lớp vào lớp của tôi của các học viên.
          const lop = (where.lop_id as In).in!;
          const hv = (where.dang_ky_hoc as { hoc_vien_id: In }).hoc_vien_id.in!;
          return Promise.resolve(
            tatCa
              .filter(
                (p) => lop.includes(p.lop_id) && hv.includes(p.dk.hoc_vien_id),
              )
              .map((p) => ({
                dang_ky_hoc: { hoc_vien_id: p.dk.hoc_vien_id },
                lop: { id: p.lop_id, ten_lop: `Tên ${p.lop_id}` },
                giai_doan: GIAI_DOAN[p.giai_doan_id],
              })),
          );
        }),
      },
      doi_buoi_hoc: {
        findMany: jest.fn(({ where }: { where: DieuKien }) => {
          const lop = (where.lich_chot as { lop_id: In }).lop_id.in!;
          const hv = (where.dang_ky_hoc as { hoc_vien_id: In } | undefined)
            ?.hoc_vien_id.in;
          return Promise.resolve(
            doiBuoi
              .filter(
                (d) =>
                  d.trang_thai === where.trang_thai &&
                  lop.includes(d.lop_chot) &&
                  (!hv || hv.includes(hocVienCua(d.dang_ky_hoc_id))),
              )
              .map((d) => ({
                dang_ky_hoc_id: d.dang_ky_hoc_id,
                lich_nguon_id: `lich-${d.nguon.lop_id}`,
                lich_chot_id: `lich-${d.lop_chot}`,
                lich_nguon: d.nguon,
                dang_ky_hoc: { hoc_vien_id: hocVienCua(d.dang_ky_hoc_id) },
                lich_chot: {
                  lop: { id: d.lop_chot, ten_lop: `Tên ${d.lop_chot}` },
                  giai_doan: GIAI_DOAN[d.nguon.giai_doan_id],
                },
              })),
          );
        }),
      },
    } as unknown as PrismaService;
    service = new HoTroHocVienScopeService(
      prisma,
      new DoiBuoiHocQueryService(prisma),
    );
  });

  const trong = (hv: string) => service.damBaoTrongPhamVi(ND, hv);
  const ngoai = (hv: string) =>
    expect(trong(hv)).rejects.toBeInstanceOf(NotFoundAppException);

  it('trong phạm vi qua cụm (chỉ có cụm)', async () => {
    cumCuaToi = ['cum-1'];
    await expect(trong('hv-cum')).resolves.toBeUndefined();
    await ngoai('hv-lop');
  });

  it('trong phạm vi qua lớp gốc (chỉ có lớp)', async () => {
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-lop')).resolves.toBeUndefined();
    await ngoai('hv-cum');
  });

  it('có cả cụm lẫn lớp → thấy học viên của cả hai', async () => {
    cumCuaToi = ['cum-1'];
    lopCuaToi = ['lop-1'];
    for (const hv of ['hv-cum', 'hv-lop', 'hv-ca-hai'])
      await expect(trong(hv)).resolves.toBeUndefined();
  });

  it('ngoài phạm vi → 404 (kể cả khi chưa được gắn gì)', async () => {
    await ngoai('hv-cum');
    cumCuaToi = ['cum-1'];
    lopCuaToi = ['lop-1'];
    await ngoai('hv-ngoai');
  });

  it('ADR 0011 P1: đổi buổi đã duyệt còn hiệu lực VÀO lớp của tôi → trong phạm vi', async () => {
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-doi-buoi')).resolves.toBeUndefined();
  });

  it('học viên đổi buổi giữa 2 lớp thuộc phạm vi của người hỗ trợ CẢ HAI lớp', async () => {
    lopCuaToi = ['lop-2'];
    await expect(trong('hv-doi-buoi')).resolves.toBeUndefined();
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-doi-buoi')).resolves.toBeUndefined();
  });

  it('đổi buổi đã duyệt nhưng HẾT hiệu lực (phân lớp đã đổi) → ngoài phạm vi', async () => {
    lopCuaToi = ['lop-1'];
    await ngoai('hv-het-hieu-luc');
  });

  it('đổi buổi chờ duyệt / từ chối / đã hủy → ngoài phạm vi', async () => {
    lopCuaToi = ['lop-1'];
    await ngoai('hv-chua-duyet');
  });

  it('gỡ phân công lớp → ra khỏi phạm vi ngay ở request kế tiếp', async () => {
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-lop')).resolves.toBeUndefined();
    await expect(trong('hv-doi-buoi')).resolves.toBeUndefined();
    lopCuaToi = [];
    await ngoai('hv-lop');
    await ngoai('hv-doi-buoi');
  });

  it('lopIdsCuaToi / damBaoLopCuaToi: lớp không được gắn → 404 "Không tìm thấy lớp"', async () => {
    lopCuaToi = ['lop-1'];
    await expect(service.lopIdsCuaToi(ND)).resolves.toEqual(['lop-1']);
    await expect(service.damBaoLopCuaToi(ND, 'lop-1')).resolves.toBeUndefined();
    await expect(service.damBaoLopCuaToi(ND, 'lop-2')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
  });

  it('whereDangKyTrongPhamVi: null khi không có cụm/lớp nào', async () => {
    await expect(service.whereDangKyTrongPhamVi(ND)).resolves.toBeNull();
  });

  describe('lọc phạm vi chỉ cụm / chỉ lớp (ADR 0011 P4)', () => {
    const dkKhop = async (loai: 'tat_ca' | 'cum' | 'lop') => {
      const w = await service.whereDangKyTrongPhamVi(ND, loai);
      return w ? dangKy.filter((d) => khop(d, w)).map((d) => d.id) : null;
    };

    beforeEach(() => {
      cumCuaToi = ['cum-1'];
      lopCuaToi = ['lop-1'];
    });

    it("'cum' → chỉ đăng ký trong cụm của tôi", async () => {
      await expect(dkKhop('cum')).resolves.toEqual(['dk-cum', 'dk-ca-hai']);
    });

    it("'lop' → phân lớp gốc + đổi buổi còn hiệu lực vào lớp của tôi", async () => {
      await expect(dkKhop('lop')).resolves.toEqual([
        'dk-lop',
        'dk-ca-hai',
        'dk-doi-buoi',
      ]);
    });

    it("'tat_ca' (mặc định) → cụm ∪ lớp", async () => {
      await expect(dkKhop('tat_ca')).resolves.toEqual([
        'dk-cum',
        'dk-lop',
        'dk-ca-hai',
        'dk-doi-buoi',
      ]);
    });

    it("'cum' khi không có cụm / 'lop' khi không có lớp → null (không thấy ai)", async () => {
      cumCuaToi = [];
      await expect(dkKhop('cum')).resolves.toBeNull();
      cumCuaToi = ['cum-1'];
      lopCuaToi = [];
      await expect(dkKhop('lop')).resolves.toBeNull();
    });
  });

  it('whereDangKyCuaLop: lớp của tôi → phân lớp + đổi buổi vào; lớp khác → 404', async () => {
    lopCuaToi = ['lop-1', 'lop-2'];
    const w = await service.whereDangKyCuaLop(ND, 'lop-1');
    expect(dangKy.filter((d) => khop(d, w)).map((d) => d.id)).toEqual([
      'dk-lop',
      'dk-ca-hai',
      'dk-doi-buoi',
    ]);
    await expect(service.whereDangKyCuaLop(ND, 'lop-9')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
  });

  it('lopCuaHocVien: lớp của tôi mà học viên thuộc (phân lớp hoặc đổi buổi vào), giai đoạn mới nhất trước', async () => {
    dangKy[3].phan_lop.push({ giai_doan_id: 'gd2', lop_id: 'lop-5' });
    const m = await service.lopCuaHocVien(
      ['lop-1', 'lop-2', 'lop-5'],
      ['hv-doi-buoi', 'hv-het-hieu-luc', 'hv-ngoai'],
    );
    expect(m.get('hv-doi-buoi')).toEqual([
      { id: 'lop-5', ten_lop: 'Tên lop-5' },
      { id: 'lop-1', ten_lop: 'Tên lop-1' },
      { id: 'lop-2', ten_lop: 'Tên lop-2' },
    ]);
    // Đổi buổi hết hiệu lực không tính; học viên ngoài lớp → không có mục.
    expect(m.get('hv-het-hieu-luc')).toBeUndefined();
    expect(m.has('hv-ngoai')).toBe(false);
  });
});
