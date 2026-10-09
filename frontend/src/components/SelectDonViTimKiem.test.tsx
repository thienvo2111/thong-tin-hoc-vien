import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import type { DonViCongTac } from '@/api/types';
import { SelectDonViTimKiem } from './SelectDonViTimKiem';

function Bao({ initialValue = null }: { initialValue?: string | null }) {
  const [value, setValue] = useState<string | null>(initialValue);
  const [log, setLog] = useState<{ id: string | null; ten: string | null }[]>([]);
  return (
    <div>
      <SelectDonViTimKiem
        label="Đơn vị"
        placeholder="Gõ tên để tìm"
        value={value}
        onChange={(id, donVi) => {
          setValue(id);
          setLog((l) => [...l, { id, ten: donVi?.ten_don_vi ?? null }]);
        }}
      />
      <div data-testid="log">{JSON.stringify(log)}</div>
    </div>
  );
}

describe('SelectDonViTimKiem', () => {
  it('gõ < 2 ký tự: hiện gợi ý gõ thêm, KHÔNG gọi API', async () => {
    let soLanGoi = 0;
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        if (new URL(request.url).searchParams.get('q')) soLanGoi++;
        return HttpResponse.json({ data: [] });
      }),
    );
    const user = userEvent.setup();
    renderTrang(<Bao />);

    const o = screen.getByRole('textbox', { name: 'Đơn vị' });
    await user.type(o, 'a');
    await user.click(o);
    expect(await screen.findByText('Gõ ít nhất 2 ký tự để tìm')).toBeInTheDocument();
    expect(soLanGoi).toBe(0);
  });

  it('gõ ≥ 2 ký tự: gọi API kèm q đúng chuỗi đã gõ, hiện kết quả', async () => {
    const qNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        qNhan.push(new URL(request.url).searchParams.get('q'));
        return HttpResponse.json({
          data: [
            {
              id: 'dv-1',
              ma_don_vi: 'THPT01',
              ten_don_vi: 'THPT Long Xuyên',
              loai_don_vi: 'truong',
              dia_ban_id: 'phuong-1',
              dia_ban_ten: 'Phường Long Xuyên',
              tinh_id: 'tinh-1',
              trang_thai: 'active',
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    renderTrang(<Bao />);

    await user.type(screen.getByRole('textbox', { name: 'Đơn vị' }), 'Long Xuyên');

    await waitFor(() => expect(qNhan).toContain('Long Xuyên'));
    expect(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' })).toBeInTheDocument();
  });

  it('chọn 1 kết quả → onChange nhận đúng id và object đơn vị', async () => {
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', () =>
        HttpResponse.json({
          data: [
            {
              id: 'dv-1',
              ma_don_vi: 'THPT01',
              ten_don_vi: 'THPT Long Xuyên',
              loai_don_vi: 'truong',
              dia_ban_id: 'phuong-1',
              dia_ban_ten: 'Phường Long Xuyên',
              tinh_id: 'tinh-1',
              trang_thai: 'active',
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    renderTrang(<Bao />);

    await user.type(screen.getByRole('textbox', { name: 'Đơn vị' }), 'Long Xuyên');
    await user.click(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' }));

    await waitFor(() =>
      expect(screen.getByTestId('log')).toHaveTextContent('"id":"dv-1","ten":"THPT Long Xuyên"'),
    );
  });

  it('value từ ngoài mà component chưa biết → tự tra tên theo id (layDonViCongTacTheoId)', async () => {
    const idNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const id = new URL(request.url).searchParams.get('id');
        idNhan.push(id);
        if (id !== 'dv-2') return HttpResponse.json({ data: [] });
        return HttpResponse.json({
          data: [
            {
              id: 'dv-2',
              ma_don_vi: 'THPT02',
              ten_don_vi: 'THPT Châu Đốc',
              loai_don_vi: 'truong',
              dia_ban_id: 'phuong-2',
              dia_ban_ten: 'Phường Châu Đốc',
              tinh_id: 'tinh-2',
              tinh_ten: 'Cần Thơ',
              trang_thai: 'active',
            } satisfies DonViCongTac,
          ],
        });
      }),
    );
    renderTrang(<Bao initialValue="dv-2" />);

    expect(await screen.findByDisplayValue('THPT Châu Đốc — Phường Châu Đốc')).toBeInTheDocument();
    await waitFor(() => expect(idNhan).toContain('dv-2'));
  });
});
