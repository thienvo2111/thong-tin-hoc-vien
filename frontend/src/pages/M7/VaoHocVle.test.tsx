import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { TrangThaiVle } from '@/api/sso';
import { NutVaoHocVle } from './VaoHocVle';

function datTrangThai(
  body: { san_sang: boolean; ly_do?: string; co_khoa_hoc: boolean } & Partial<
    Pick<TrangThaiVle, 'so_lan_vao' | 'lan_vao_gan_nhat'>
  >,
) {
  server.use(
    http.get('/sso/vle/trang-thai', () => HttpResponse.json({ so_lan_vao: 0, lan_vao_gan_nhat: null, ...body })),
  );
}

describe('NutVaoHocVle (Vào học VLE, external-login P.CNTT)', () => {
  let formKhiSubmit: HTMLFormElement | undefined;
  let submitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    datToken('token-gia-lap');
    formKhiSubmit = undefined;
    submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
      formKhiSubmit = this;
    });
  });

  afterEach(() => {
    submitSpy.mockRestore();
  });

  it('chưa cấu hình -> ẩn hẳn nút, không hiện gì cả', async () => {
    datTrangThai({ san_sang: false, ly_do: 'Chức năng vào học VLE chưa được cấu hình.', co_khoa_hoc: false });
    renderTrang(<NutVaoHocVle />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Vào học VLE' })).not.toBeInTheDocument());
  });

  it('chưa có tài khoản VLE -> nút disabled kèm lý do', async () => {
    datTrangThai({
      san_sang: false,
      ly_do: 'Chưa có tài khoản VLE. Vui lòng cập nhật email (không trùng người khác) để được cấp tài khoản.',
      co_khoa_hoc: false,
    });
    renderTrang(<NutVaoHocVle />);
    const nut = await screen.findByRole('button', { name: 'Vào học VLE' });
    expect(nut).toBeDisabled();
    expect(await screen.findByText(/Chưa có tài khoản VLE/)).toBeInTheDocument();
  });

  it('sẵn sàng -> nút bấm được, không hiện lý do', async () => {
    datTrangThai({ san_sang: true, co_khoa_hoc: true });
    renderTrang(<NutVaoHocVle />);
    const nut = await screen.findByRole('button', { name: 'Vào học VLE' });
    expect(nut).toBeEnabled();
    expect(screen.queryByText(/Chưa có tài khoản VLE/)).not.toBeInTheDocument();
  });

  it('bấm nút -> gọi API lấy form rồi tự submit đúng field (cùng tab)', async () => {
    datTrangThai({ san_sang: true, co_khoa_hoc: true });
    server.use(
      http.post('/sso/vle/form', () =>
        HttpResponse.json({
          action: 'https://vlebdhvs.hcmue.edu.vn/users/external-login',
          fields: { key: 'khoa-gia-lap', email: '', username: 'nguyenvana', id_course: '13' },
        }),
      ),
    );
    renderTrang(<NutVaoHocVle />);
    const nut = await screen.findByRole('button', { name: 'Vào học VLE' });
    await userEvent.click(nut);

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(formKhiSubmit?.method).toBe('post');
    expect(formKhiSubmit?.action).toBe('https://vlebdhvs.hcmue.edu.vn/users/external-login');
    expect(formKhiSubmit?.target).toBe('');

    const inputs = Array.from(formKhiSubmit?.querySelectorAll('input') ?? []) as HTMLInputElement[];
    const values = Object.fromEntries(inputs.map((i) => [i.name, i.value]));
    expect(values).toEqual({ key: 'khoa-gia-lap', email: '', username: 'nguyenvana', id_course: '13' });
  });

  it('lỗi khi bấm nút -> hiện thông báo lỗi, không ném ngoại lệ', async () => {
    datTrangThai({ san_sang: true, co_khoa_hoc: false });
    server.use(
      http.post('/sso/vle/form', () =>
        HttpResponse.json({ error: { code: 'VLE_CHUA_CO_TAI_KHOAN', message: 'Chưa có tài khoản VLE lúc này.' } }, { status: 409 }),
      ),
    );
    renderTrang(<NutVaoHocVle />);
    const nut = await screen.findByRole('button', { name: 'Vào học VLE' });
    await userEvent.click(nut);
    expect(await screen.findByText('Chưa có tài khoản VLE lúc này.')).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });
  // Lượt vào VLE (= số lần cấp form vào VLE thành công, không phải điểm danh) — dòng mờ dưới nút.
  it('đã vào VLE -> "Đã vào VLE 3 lần · gần nhất dd/MM/yyyy HH:mm" (giờ Việt Nam)', async () => {
    datTrangThai({ san_sang: true, co_khoa_hoc: true, so_lan_vao: 3, lan_vao_gan_nhat: '2026-11-09T08:30:00.000Z' });
    renderTrang(<NutVaoHocVle />);
    expect(await screen.findByText('Đã vào VLE 3 lần · gần nhất 09/11/2026 15:30')).toBeInTheDocument();
    expect(screen.queryByText('Chưa vào VLE lần nào')).not.toBeInTheDocument();
  });

  it('chưa vào lần nào -> "Chưa vào VLE lần nào"', async () => {
    datTrangThai({ san_sang: true, co_khoa_hoc: true, so_lan_vao: 0, lan_vao_gan_nhat: null });
    renderTrang(<NutVaoHocVle />);
    expect(await screen.findByText('Chưa vào VLE lần nào')).toBeInTheDocument();
    expect(screen.queryByText(/Đã vào VLE/)).not.toBeInTheDocument();
  });

  it('chưa cấu hình -> không hiện dòng lượt vào (ẩn hẳn cùng nút)', async () => {
    datTrangThai({ san_sang: false, ly_do: 'Chức năng vào học VLE chưa được cấu hình.', co_khoa_hoc: false, so_lan_vao: 2 });
    renderTrang(<NutVaoHocVle />);
    await waitFor(() => expect(screen.queryByTestId('luot-vao-vle')).not.toBeInTheDocument());
    expect(screen.queryByText(/Đã vào VLE/)).not.toBeInTheDocument();
  });
});
