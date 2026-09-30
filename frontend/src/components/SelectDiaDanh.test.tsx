import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { SelectDiaDanh } from './SelectDiaDanh';

function Bao({ phienBan }: { phienBan?: 'hien_tai' | 'lich_su' | 'dac_biet' }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <div>
      <SelectDiaDanh label="Tỉnh/thành" cap="tinh_thanh" value={id} onChange={setId} phienBan={phienBan} />
    </div>
  );
}

describe('SelectDiaDanh', () => {
  it('truyền phienBan="hien_tai" -> gửi kèm ?phien_ban=hien_tai lên API', async () => {
    const phienBanNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/dia-danh', ({ request }) => {
        const url = new URL(request.url);
        phienBanNhan.push(url.searchParams.get('phien_ban'));
        return HttpResponse.json({ data: [] });
      }),
    );
    renderTrang(<Bao phienBan="hien_tai" />);

    await waitFor(() => expect(phienBanNhan.length).toBeGreaterThan(0));
    expect(phienBanNhan.every((v) => v === 'hien_tai')).toBe(true);
  });

  it('không truyền phienBan -> KHÔNG gửi tham số phien_ban (giữ hành vi cũ)', async () => {
    const phienBanNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/dia-danh', ({ request }) => {
        const url = new URL(request.url);
        phienBanNhan.push(url.searchParams.get('phien_ban'));
        return HttpResponse.json({ data: [] });
      }),
    );
    renderTrang(<Bao />);

    await waitFor(() => expect(phienBanNhan.length).toBeGreaterThan(0));
    expect(phienBanNhan.every((v) => v === null)).toBe(true);
  });

  it('render đúng nhãn được truyền vào', () => {
    renderTrang(<Bao />);
    expect(screen.getByLabelText('Tỉnh/thành', { selector: 'input' })).toBeInTheDocument();
  });
});
