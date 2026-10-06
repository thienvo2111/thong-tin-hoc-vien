import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { SelectDonVi } from './SelectDonVi';

function Bao({
  disabled,
  idBanDau,
  nhanBanDau,
}: {
  disabled?: boolean;
  idBanDau?: string | null;
  nhanBanDau?: string | null;
}) {
  const [id, setId] = useState<string | null>(idBanDau ?? null);
  return (
    <div>
      <SelectDonVi
        label="Đơn vị công tác"
        idBanDau={idBanDau}
        nhanBanDau={nhanBanDau}
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

  it('chọn Phường/xã mà CHƯA gõ gì → tự động gọi API theo dia_ban_id (không kèm q, page_size lớn) và hiện ngay danh sách trường khi focus ô tìm', async () => {
    const ycNhan: { diaBanId: string | null; q: string | null; pageSize: string | null }[] = [];
    server.use(
      http.get('/danh-muc/don-vi-cong-tac', ({ request }) => {
        const url = new URL(request.url);
        ycNhan.push({
          diaBanId: url.searchParams.get('dia_ban_id'),
          q: url.searchParams.get('q'),
          pageSize: url.searchParams.get('page_size'),
        });
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

    await waitFor(() => expect(ycNhan.some((y) => y.diaBanId === 'phuong-1')).toBe(true));
    const yc = ycNhan.find((y) => y.diaBanId === 'phuong-1');
    expect(yc?.q).toBeFalsy();
    expect(yc?.pageSize).toBe('100');

    const oTim = screen.getByPlaceholderText('Gõ tên trường (ít nhất 2 ký tự)');
    await user.click(oTim);
    expect(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' })).toBeInTheDocument();
  });

  it('đổi lại Tỉnh/thành sau khi đã có danh sách theo Phường/xã cũ → không còn tự hiện danh sách trường cũ (quay lại yêu cầu gõ ≥2 ký tự)', async () => {
    const user = userEvent.setup();
    renderTrang(<Bao />);

    const oTinh = screen.getByLabelText('Tỉnh/thành', { selector: 'input' });
    await user.click(oTinh);
    await user.click(await screen.findByRole('option', { name: 'An Giang' }));

    const oPhuong = screen.getByLabelText('Phường/xã', { selector: 'input' });
    await user.click(oPhuong);
    await user.click(await screen.findByRole('option', { name: 'Phường Long Xuyên' }));

    const oTim = screen.getByPlaceholderText('Gõ tên trường (ít nhất 2 ký tự)');
    await user.click(oTim);
    expect(await screen.findByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' })).toBeInTheDocument();

    // Đổi lại Tỉnh/thành -> setPhuongXaId(null) -> danh sách trường của xã cũ không còn tự hiện nữa.
    await user.click(oTinh);
    await user.click(await screen.findByRole('option', { name: 'Cần Thơ' }));

    await user.click(oTim);
    expect(screen.queryByRole('option', { name: 'THPT Long Xuyên — Phường Long Xuyên' })).not.toBeInTheDocument();
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
    // Chỉ điền sẵn 2 ô filter — giữ nguyên đơn vị đang có, không tự đổi.
    expect(screen.getByTestId('gia-tri')).toHaveTextContent('dv-1');
  });

  describe('hồ sơ đã có trường, đổi địa bàn (2026-10-05)', () => {
    const NHAN = 'THPT Long Xuyên — Phường Long Xuyên';

    it('chưa đổi gì: bấm ô trường -> hiện đủ trường trong xã, KHÔNG gửi nhãn trường đang chọn làm từ khóa', async () => {
      const qNhan: (string | null)[] = [];
      server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url);
        if (url.pathname === '/danh-muc/don-vi-cong-tac' && !url.searchParams.get('id')) qNhan.push(url.searchParams.get('q'));
      });
      const user = userEvent.setup();
      renderTrang(<Bao idBanDau="dv-1" nhanBanDau={NHAN} />);
      const oPhuong = screen.getByLabelText('Phường/xã', { selector: 'input' });
      await waitFor(() => expect(oPhuong).toHaveValue('Phường Long Xuyên'));

      await user.click(screen.getByDisplayValue(NHAN));
      expect(await screen.findByRole('option', { name: NHAN })).toBeInTheDocument();
      expect(qNhan.every((q) => !q)).toBe(true);
      server.events.removeAllListeners();
    });

    it('đổi Tỉnh/thành + Phường/xã -> bỏ trường cũ, hiện danh sách trường của xã mới để chọn lại', async () => {
      const user = userEvent.setup();
      renderTrang(<Bao idBanDau="dv-1" nhanBanDau={NHAN} />);
      const oTinh = screen.getByLabelText('Tỉnh/thành', { selector: 'input' });
      await waitFor(() => expect(oTinh).toHaveValue('An Giang'));

      await user.click(oTinh);
      await user.click(await screen.findByRole('option', { name: 'Cần Thơ' }));
      expect(screen.getByTestId('gia-tri')).toHaveTextContent('');
      expect(screen.queryByDisplayValue(NHAN)).not.toBeInTheDocument();

      const oPhuong = screen.getByLabelText('Phường/xã', { selector: 'input' });
      await user.click(oPhuong);
      await user.click(await screen.findByRole('option', { name: 'Phường Châu Đốc' }));

      const oTim = screen.getByPlaceholderText('Gõ tên trường (ít nhất 2 ký tự)');
      await user.click(oTim);
      await user.click(await screen.findByRole('option', { name: 'THPT Châu Đốc — Phường Châu Đốc' }));
      expect(screen.getByTestId('gia-tri')).toHaveTextContent('dv-2');
    });

    it('đổi chỉ Phường/xã (cùng tỉnh) cũng bỏ trường cũ, hiện trường của xã mới', async () => {
      server.use(
        http.get('/danh-muc/dia-danh', ({ request }) => {
          const url = new URL(request.url);
          const ds =
            url.searchParams.get('cap') === 'tinh_thanh'
              ? [{ id: 'tinh-1', ma: '89', ten: 'An Giang', cap: 'tinh_thanh', parent_id: null, trang_thai: 'active' }]
              : [
                  { id: 'phuong-1', ma: '001', ten: 'Phường Long Xuyên', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' },
                  { id: 'xa-3', ma: '003', ten: 'Xã Cần Đăng', cap: 'phuong_xa_dac_khu', parent_id: 'tinh-1', trang_thai: 'active' },
                ];
          return HttpResponse.json({ data: ds, total: ds.length, page: 1, page_size: 20 });
        }),
      );
      const yeuCau: (string | null)[] = [];
      server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url);
        if (url.pathname === '/danh-muc/don-vi-cong-tac' && !url.searchParams.get('id')) yeuCau.push(url.searchParams.get('dia_ban_id'));
      });
      const user = userEvent.setup();
      renderTrang(<Bao idBanDau="dv-1" nhanBanDau={NHAN} />);
      const oPhuong = screen.getByLabelText('Phường/xã', { selector: 'input' });
      await waitFor(() => expect(oPhuong).toHaveValue('Phường Long Xuyên'));

      await user.click(oPhuong);
      await user.click(await screen.findByRole('option', { name: 'Xã Cần Đăng' }));
      expect(screen.getByTestId('gia-tri')).toHaveTextContent('');
      expect(screen.queryByDisplayValue(NHAN)).not.toBeInTheDocument();
      await waitFor(() => expect(yeuCau).toContain('xa-3'));
      server.events.removeAllListeners();
    });
  });

  it('2 đơn vị trùng cả tên lẫn xã -> không sập (Mantine cấm option trùng), nhãn kèm mã để phân biệt và chọn đúng id', async () => {
    const dv = (id: string, ma: string) => ({
      id,
      ma_don_vi: ma,
      ten_don_vi: 'Trường Tiểu học A',
      loai_don_vi: 'truong',
      dia_ban_id: 'xa-1',
      dia_ban_ten: 'Xã Mỹ Hòa',
      tinh_id: 'tinh-1',
      tinh_ten: 'An Giang',
      trang_thai: 'active',
    });
    server.use(http.get('/danh-muc/don-vi-cong-tac', () => HttpResponse.json({ data: [dv('dv-1', 'TH01'), dv('dv-2', 'TH02')] })));
    const user = userEvent.setup();
    renderTrang(<Bao />);
    await user.type(screen.getByRole('textbox', { name: 'Đơn vị công tác' }), 'Tiểu học A');
    await user.click(await screen.findByRole('option', { name: 'Trường Tiểu học A — Xã Mỹ Hòa (mã TH02)' }));
    expect(screen.getByRole('option', { hidden: true, name: 'Trường Tiểu học A — Xã Mỹ Hòa (mã TH01)' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('gia-tri')).toHaveTextContent('dv-2'));
  });
});
