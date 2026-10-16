import { HoTroHocVienScopeService } from './ho-tro-hoc-vien-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundAppException } from '../common/exceptions/app.exceptions';

// ADR 0008 L2: phạm vi = cụm ∪ lớp GỐC (phan_lop_giai_doan); đổi buổi không
// tính. Prisma giả lập 1 bảng đăng ký nhỏ và tự đánh giá điều kiện where mà
// service sinh ra — test theo yêu cầu, không theo hình dạng truy vấn.
interface DangKyGia {
  hoc_vien_id: string;
  cum_id: string | null;
  lop_goc: string[];
  // Lớp chứa buổi chốt của đổi buổi đã duyệt (không phải lớp gốc).
  lop_doi_buoi: string[];
}

type DieuKien = Record<string, unknown>;

function khop(dk: DangKyGia, w: DieuKien): boolean {
  if (Array.isArray(w.AND))
    return (w.AND as DieuKien[]).every((x) => khop(dk, x));
  if (Array.isArray(w.OR)) return (w.OR as DieuKien[]).some((x) => khop(dk, x));
  return Object.entries(w).every(([k, v]) => {
    const val = v as { in?: string[]; some?: { lop_id?: { in: string[] } } };
    if (k === 'hoc_vien_id') return dk.hoc_vien_id === v;
    if (k === 'cum_id') return !!dk.cum_id && !!val.in?.includes(dk.cum_id);
    if (k === 'phan_lop_giai_doan')
      return dk.lop_goc.some((l) => val.some?.lop_id?.in.includes(l));
    throw new Error(`Điều kiện chưa hỗ trợ: ${k}`);
  });
}

describe('HoTroHocVienScopeService — phạm vi cụm ∪ lớp (ADR 0008)', () => {
  const ND = 'nd-ho-tro';
  let cumCuaToi: string[];
  let lopCuaToi: string[];
  let dangKy: DangKyGia[];
  let service: HoTroHocVienScopeService;

  beforeEach(() => {
    cumCuaToi = [];
    lopCuaToi = [];
    dangKy = [
      {
        hoc_vien_id: 'hv-cum',
        cum_id: 'cum-1',
        lop_goc: ['lop-9'],
        lop_doi_buoi: [],
      },
      {
        hoc_vien_id: 'hv-lop',
        cum_id: 'cum-9',
        lop_goc: ['lop-1'],
        lop_doi_buoi: [],
      },
      {
        hoc_vien_id: 'hv-ca-hai',
        cum_id: 'cum-1',
        lop_goc: ['lop-1'],
        lop_doi_buoi: [],
      },
      {
        hoc_vien_id: 'hv-doi-buoi',
        cum_id: null,
        lop_goc: ['lop-2'],
        lop_doi_buoi: ['lop-1'],
      },
      {
        hoc_vien_id: 'hv-ngoai',
        cum_id: 'cum-9',
        lop_goc: ['lop-9'],
        lop_doi_buoi: [],
      },
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
    };
    service = new HoTroHocVienScopeService(prisma as unknown as PrismaService);
  });

  const trong = (hv: string) => service.damBaoTrongPhamVi(ND, hv);

  it('trong phạm vi qua cụm (chỉ có cụm)', async () => {
    cumCuaToi = ['cum-1'];
    await expect(trong('hv-cum')).resolves.toBeUndefined();
    await expect(trong('hv-lop')).rejects.toBeInstanceOf(NotFoundAppException);
  });

  it('trong phạm vi qua lớp gốc (chỉ có lớp)', async () => {
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-lop')).resolves.toBeUndefined();
    await expect(trong('hv-cum')).rejects.toBeInstanceOf(NotFoundAppException);
  });

  it('có cả cụm lẫn lớp → thấy học viên của cả hai', async () => {
    cumCuaToi = ['cum-1'];
    lopCuaToi = ['lop-1'];
    for (const hv of ['hv-cum', 'hv-lop', 'hv-ca-hai'])
      await expect(trong(hv)).resolves.toBeUndefined();
  });

  it('ngoài phạm vi → 404 (kể cả khi chưa được gắn gì)', async () => {
    await expect(trong('hv-cum')).rejects.toBeInstanceOf(NotFoundAppException);
    cumCuaToi = ['cum-1'];
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-ngoai')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
  });

  it('chỉ liên quan lớp của tôi qua đổi buổi đã duyệt → KHÔNG trong phạm vi', async () => {
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-doi-buoi')).rejects.toBeInstanceOf(
      NotFoundAppException,
    );
  });

  it('gỡ phân công lớp → ra khỏi phạm vi ngay ở request kế tiếp', async () => {
    lopCuaToi = ['lop-1'];
    await expect(trong('hv-lop')).resolves.toBeUndefined();
    lopCuaToi = [];
    await expect(trong('hv-lop')).rejects.toBeInstanceOf(NotFoundAppException);
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
});
