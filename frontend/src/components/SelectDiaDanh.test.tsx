import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('tỉnh có > 200 xã (nhiều hơn 1 trang) → vẫn gộp đủ, tìm được xã nằm ở trang sau (vd xã thứ 230)', async () => {
    const TONG_SO_XA = 250;
    const xaThu230 = 'Xã Cần Đăng';
    const tatCaXa = Array.from({ length: TONG_SO_XA }, (_, i) =>
      i === 229
        ? { id: 'xa-230', ma: 'XA230', ten: xaThu230, cap: 'phuong_xa_dac_khu' as const, parent_id: 'tinh-1', trang_thai: 'active' as const }
        : { id: `xa-${i + 1}`, ma: `XA${i + 1}`, ten: `Xã Số ${String(i + 1).padStart(3, '0')}`, cap: 'phuong_xa_dac_khu' as const, parent_id: 'tinh-1', trang_thai: 'active' as const },
    );
    server.use(
      http.get('/danh-muc/dia-danh', ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('page_size') ?? '20');
        const data = tatCaXa.slice((page - 1) * pageSize, page * pageSize);
        return HttpResponse.json({ data, total: tatCaXa.length, page, page_size: pageSize });
      }),
    );

    function BaoXa() {
      const [id, setId] = useState<string | null>(null);
      return <SelectDiaDanh label="Phường/xã" cap="phuong_xa_dac_khu" parentId="tinh-1" value={id} onChange={setId} />;
    }

    const user = userEvent.setup();
    renderTrang(<BaoXa />);

    const oXa = screen.getByLabelText('Phường/xã', { selector: 'input' });
    await user.click(oXa);
    await user.type(oXa, 'Cần Đăng');

    expect(await screen.findByRole('option', { name: xaThu230 })).toBeInTheDocument();
  });

  it('gõ không dấu ("cho moi") vẫn thấy "Xã Chợ Mới" trong dropdown', async () => {
    server.use(
      http.get('/danh-muc/dia-danh', () =>
        HttpResponse.json({
          data: [
            { id: 'xa-1', ma: 'XA1', ten: 'Xã Chợ Mới', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' },
            { id: 'xa-2', ma: 'XA2', ten: 'Xã Long Xuyên', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' },
          ],
        }),
      ),
    );

    function BaoXa() {
      const [id, setId] = useState<string | null>(null);
      return <SelectDiaDanh label="Phường/xã" cap="phuong_xa_dac_khu" parentId="tinh-1" value={id} onChange={setId} />;
    }

    const user = userEvent.setup();
    renderTrang(<BaoXa />);

    const oXa = screen.getByLabelText('Phường/xã', { selector: 'input' });
    await user.click(oXa);
    await user.type(oXa, 'cho moi');

    expect(await screen.findByRole('option', { name: 'Xã Chợ Mới' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Xã Long Xuyên' })).not.toBeInTheDocument();
  });

  it('gõ chuỗi NFD của "Chợ" (bộ gõ tiếng Việt) vẫn thấy "Xã Chợ Mới" trong dropdown', async () => {
    server.use(
      http.get('/danh-muc/dia-danh', () =>
        HttpResponse.json({
          data: [{ id: 'xa-1', ma: 'XA1', ten: 'Xã Chợ Mới', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' }],
        }),
      ),
    );

    function BaoXa() {
      const [id, setId] = useState<string | null>(null);
      return <SelectDiaDanh label="Phường/xã" cap="phuong_xa_dac_khu" parentId="tinh-1" value={id} onChange={setId} />;
    }

    const user = userEvent.setup();
    renderTrang(<BaoXa />);

    const oXa = screen.getByLabelText('Phường/xã', { selector: 'input' });
    await user.click(oXa);
    await user.type(oXa, 'Chợ'.normalize('NFD'));

    expect(await screen.findByRole('option', { name: 'Xã Chợ Mới' })).toBeInTheDocument();
  });
});
