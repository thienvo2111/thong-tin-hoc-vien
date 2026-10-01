import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { SelectDonVi } from './SelectDonVi';

function Bao({ disabled, idBanDau }: { disabled?: boolean; idBanDau?: string | null }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <div>
      <SelectDonVi
        label="Đơn vị công tác"
        idBanDau={idBanDau}
        onChange={(donViId) => setId(donViId)}
        disabled={disabled}
      />
      <div data-testid="gia-tri">{id ?? ''}</div>
    </div>
  );
}

describe('SelectDonVi', () => {
  it('chọn Tỉnh/thành rồi Phường/xã → tìm kiếm gửi kèm đúng dia_ban_id của phường/xã đã chọn', async () => {
    const diaBanIdNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const url = new URL(request.url);
        diaBanIdNhan.push(url.searchParams.get('dia_ban_id'));
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
              tinh_ten: 'An Giang',
              trang_thai: 'active',
            },
          ],
        });
      }),
    );
    const user = userEvent.setup();
    renderTrang(<Bao />);

    const oTinh = screen.getByLabelText('Tỉnh/thành', { selector: 'input' });
    await user.click(oTinh);
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));

    const oPhuong = screen.getByLabelText('Phường/xã', { selector: 'input' });
    await user.click(oPhuong);
    await user.click(await screen.findByRole('option', { name: 'Phường Long Xuyên' }));

    const oTim = screen.getByPlaceholderText('Gõ tên trường (ít nhất 2 ký tự)');
    await user.type(oTim, 'Long Xuyên');

    await waitFor(() => expect(diaBanIdNhan).toContain('phuong-1'));

    await user.click(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' }));
    expect(screen.getByTestId('gia-tri')).toHaveTextContent('dv-1');
  });

  it('không chọn Tỉnh/thành và Phường/xã vẫn tìm được bình thường (không kèm dia_ban_id)', async () => {
    const diaBanIdNhan: (string | null)[] = [];
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const url = new URL(request.url);
        diaBanIdNhan.push(url.searchParams.get('dia_ban_id'));
        return HttpResponse.json({ data: [] });
      }),
    );
    const user = userEvent.setup();
    renderTrang(<Bao />);

    const oTim = screen.getByPlaceholderText('Gõ tên trường (ít nhất 2 ký tự)');
    await user.type(oTim, 'Long Xuyên');

    await waitFor(() => expect(diaBanIdNhan.length).toBeGreaterThan(0));
    expect(diaBanIdNhan.every((v) => v === null)).toBe(true);
  });

  it('disabled=true → cả 2 Select địa giới và ô tìm đều bị vô hiệu hóa', () => {
    renderTrang(<Bao disabled />);
    expect(screen.getByLabelText('Tỉnh/thành', { selector: 'input' })).toBeDisabled();
    expect(screen.getByLabelText('Phường/xã', { selector: 'input' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Gõ tên trường (ít nhất 2 ký tự)')).toBeDisabled();
  });

  it('idBanDau: tự động điền sẵn Tỉnh/thành + Phường/xã theo địa bàn của đơn vị đã có sẵn', async () => {
    renderTrang(<Bao idBanDau="dv-1" />);

    const oTinh = screen.getByLabelText('Tỉnh/thành', { selector: 'input' });
    const oPhuong = screen.getByLabelText('Phường/xã', { selector: 'input' });

    await waitFor(() => expect(oTinh).toHaveValue('An Giang'));
    await waitFor(() => expect(oPhuong).toHaveValue('Phường Long Xuyên'));
    // Chỉ điền sẵn 2 ô filter — KHÔNG tự chọn luôn đơn vị công tác (không ép người dùng phải dùng lại).
    expect(screen.getByTestId('gia-tri')).toHaveTextContent('');
  });
});
