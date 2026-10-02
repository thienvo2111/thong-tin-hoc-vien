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
];
