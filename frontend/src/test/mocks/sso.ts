import { http, HttpResponse } from 'msw';

// Mock POST /sso/cap-ma (2026-10-02) — tách khỏi handlers.ts. Ghi lại target đã yêu cầu để test kiểm.
export const ssoDaYeuCau: (string | undefined)[] = [];

export const ssoHandlers = [
  http.post('/sso/cap-ma', async ({ request }) => {
    const body = (await request.json()) as { target?: string };
    ssoDaYeuCau.push(body.target);
    const url = new URL('https://khaosat.test/sso/start');
    url.searchParams.set('code', 'ma-gia-lap-dung-mot-lan');
    if (body.target) url.searchParams.set('target', body.target);
    return HttpResponse.json({ url: url.toString(), het_han: new Date(Date.now() + 300000).toISOString() }, { status: 201 });
  }),
  http.post('/sso/ma-thu', async ({ request }) => {
    const body = (await request.json()) as { ma_dinh_danh_moet: string; target?: string };
    if (body.ma_dinh_danh_moet !== '9115131060') {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Không tìm thấy học viên có mã định danh này' } },
        { status: 404 },
      );
    }
    const url = new URL('https://khaosat.test/sso/start');
    url.searchParams.set('code', 'ma-thu-gia-lap');
    if (body.target) url.searchParams.set('target', body.target);
    return HttpResponse.json(
      {
        url: url.toString(),
        code: 'ma-thu-gia-lap',
        het_han: '2026-10-02T05:00:00.000Z',
        hoc_vien: { id: 'hv-1', ho_ten: 'Hà Thị Thanh', ma_dinh_danh_moet: '9115131060', doi_tuong: null },
      },
      { status: 201 },
    );
  }),
];
