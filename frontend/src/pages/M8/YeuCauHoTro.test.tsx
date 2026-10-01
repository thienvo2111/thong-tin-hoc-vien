import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import YeuCauHoTroPage from './YeuCauHoTro';

const routes = [{ path: '/toi/yeu-cau-ho-tro', element: <YeuCauHoTroPage /> }];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/yeu-cau-ho-tro'] });
}

describe('YeuCauHoTro (M8)', () => {
  it('chọn loại vấn đề -> hiện FAQ gợi ý trước khi cho gửi ticket', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(await screen.findByLabelText(/loại vấn đề/i, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Quên mật khẩu' }));

    expect(await screen.findByText(/liên hệ số hỗ trợ để đặt lại mật khẩu/i)).toBeInTheDocument();
  });

  it('gửi ticket thành công -> hiện trong danh sách "Yêu cầu của tôi"', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(await screen.findByLabelText(/loại vấn đề/i, { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Quên mật khẩu' }));
    await user.click(screen.getByRole('button', { name: /vẫn cần hỗ trợ/i }));
    await user.type(screen.getByLabelText(/nội dung/i), 'Tôi không đăng nhập được');
    await user.click(screen.getByRole('button', { name: /gửi yêu cầu/i }));

    await waitFor(() => {
      expect(screen.getByText('Tôi không đăng nhập được')).toBeInTheDocument();
    });
  });
});
