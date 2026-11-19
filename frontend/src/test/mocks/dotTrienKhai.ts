import { http, HttpResponse } from 'msw';
import type { DotTrienKhai, SuaDotTrienKhaiDto, TaoDotTrienKhaiDto } from '@/api/dotTrienKhai';
import { DON_VI } from './db';

// Issue #56: đợt triển khai (Cổng đơn vị) — CSDL giả trong bộ nhớ, reset sau mỗi test (setup.ts).
// Sở dùng dv-so-1 trong DON_VI của db.ts.
export function dotMau(p: Partial<DotTrienKhai> = {}): DotTrienKhai {
  return {
    id: 'dtk-1',
    chuong_trinh: 'hsg',
    ten: 'HSG An Giang 2026',
    don_gia: 1500000,
    ngay_qd_tu: '2026-03-01',
    ngay_qd_den: '2026-12-31',
    han_nop: '2026-12-31T16:59:59.000Z',
    han_nop_ngay: '2026-12-31',
    so_gddt: { id: 'dv-so-1', ten_don_vi: 'Sở GD&ĐT An Giang' },
    created_at: '2026-11-19T01:00:00.000Z',
    updated_at: '2026-11-19T01:00:00.000Z',
    ...p,
  };
}

export const dbDotTrienKhai = { ds: [] as DotTrienKhai[] };

export function datLaiDotTrienKhaiMock() {
  dbDotTrienKhai.ds = [];
}

const hanNop = (ngay: string) => new Date(`${ngay}T23:59:59+07:00`).toISOString();

function soGddt(id: string) {
  const dv = DON_VI.find((d) => d.id === id);
  return { id, ten_don_vi: dv?.ten_don_vi ?? id };
}

export const dotTrienKhaiHandlers = [
  http.get('/cong-don-vi/dot-trien-khai', () => HttpResponse.json(dbDotTrienKhai.ds)),

  http.post('/cong-don-vi/dot-trien-khai', async ({ request }) => {
    const b = (await request.json()) as TaoDotTrienKhaiDto;
    const { so_gddt_id, ...con } = b;
    const dot = dotMau({
      ...con,
      id: `dtk-${dbDotTrienKhai.ds.length + 1}`,
      han_nop: hanNop(b.han_nop_ngay),
      so_gddt: soGddt(so_gddt_id),
    });
    dbDotTrienKhai.ds = [dot, ...dbDotTrienKhai.ds];
    return HttpResponse.json(dot, { status: 201 });
  }),

  http.patch('/cong-don-vi/dot-trien-khai/:id', async ({ params, request }) => {
    const b = (await request.json()) as SuaDotTrienKhaiDto;
    const cu = dbDotTrienKhai.ds.find((d) => d.id === params.id);
    if (!cu) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Không tìm thấy đợt triển khai' } },
        { status: 404 },
      );
    }
    const { so_gddt_id, ...con } = b;
    const moi: DotTrienKhai = {
      ...cu,
      ...con,
      ...(b.han_nop_ngay ? { han_nop: hanNop(b.han_nop_ngay) } : {}),
      ...(so_gddt_id ? { so_gddt: soGddt(so_gddt_id) } : {}),
    };
    dbDotTrienKhai.ds = dbDotTrienKhai.ds.map((d) => (d.id === cu.id ? moi : d));
    return HttpResponse.json(moi);
  }),
];
