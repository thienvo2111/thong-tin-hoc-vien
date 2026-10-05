import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { thangMucMock } from '@/test/mocks/sso';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { TheThangMuc } from './TheThangMuc';

function renderThe() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/', element: <TheThangMuc /> }], { initialEntries: ['/'] });
}

describe('Admin — Thang mức kết quả khảo sát', () => {
  it('hiện thang hiện tại kèm nhãn học viên thấy', async () => {
    renderThe();
    expect(await screen.findByDisplayValue('Chưa đạt')).toBeInTheDocument();
    expect(screen.getByText('M1 – Chưa đạt')).toBeInTheDocument();
    expect(screen.getByText('M4 – Nâng cao')).toBeInTheDocument();
  });

  it('sửa nhãn, thêm mức (mã chữ thường tự viết hoa) rồi lưu -> gửi đúng dữ liệu', async () => {
    const user = userEvent.setup();
    renderThe();
    const nhanM3 = await screen.findByLabelText('Nhãn mức dòng 3');
    await user.clear(nhanM3);
    await user.type(nhanM3, 'Thuần thục');
    await user.click(screen.getByRole('button', { name: 'Thêm mức' }));
    await user.type(screen.getByLabelText('Mã mức dòng 5'), 'm5');
    await user.type(screen.getByLabelText('Nhãn mức dòng 5'), 'Xuất sắc');
    expect(screen.getByText('M5 – Xuất sắc')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu thang mức' }));
    await waitFor(() =>
      expect(thangMucMock.value).toEqual([
        { ma: 'M1', nhan: 'Chưa đạt' },
        { ma: 'M2', nhan: 'Cơ bản' },
        { ma: 'M3', nhan: 'Thuần thục' },
        { ma: 'M4', nhan: 'Nâng cao' },
        { ma: 'M5', nhan: 'Xuất sắc' },
      ]),
    );
  });

  it('mã trùng hoặc sai định dạng -> báo lỗi tại ô, khóa nút lưu', async () => {
    const user = userEvent.setup();
    renderThe();
    const ma2 = await screen.findByLabelText('Mã mức dòng 2');
    await user.clear(ma2);
    await user.type(ma2, 'm1');
    expect(screen.getAllByText('Mã bị trùng').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Lưu thang mức' })).toBeDisabled();

    await user.clear(ma2);
    await user.type(ma2, 'Mức 2');
    expect(screen.getByText(/Mã chỉ gồm chữ không dấu và số/)).toBeInTheDocument();
  });

  it('xóa 1 mức rồi lưu; API lỗi -> hiện thông báo', async () => {
    server.use(
      http.put('/sso/thang-muc', () =>
        HttpResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Mã mức bị trùng' } }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderThe();
    await user.click(await screen.findByRole('button', { name: 'Xóa mức dòng 4' }));
    expect(screen.queryByDisplayValue('Nâng cao')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lưu thang mức' }));
    expect(await screen.findByText('Mã mức bị trùng')).toBeInTheDocument();
  });
});
