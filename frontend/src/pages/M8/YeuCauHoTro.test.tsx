import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { huongDan, NHAN_NHOM_LOI } from '@/content/huongDan';
import YeuCauHoTroPage from './YeuCauHoTro';

const routes = [{ path: '/toi/yeu-cau-ho-tro', element: <YeuCauHoTroPage /> }];

// Lấy tình huống thật từ nội dung "Lỗi thường gặp" để test không vỡ khi sửa câu chữ.
const TINH_HUONG = huongDan.troubleshooting.find((t) => t.nhom === 'dang-nhap')!;

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/yeu-cau-ho-tro'] });
}

async function moDanhSach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('textbox', { name: /vấn đề thầy\/cô đang gặp/i }));
}

describe('YeuCauHoTro (M8)', () => {
  it('có liên kết "Xem lỗi thường gặp và cách khắc phục" trỏ /huong-dan#loi', async () => {
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: 'Xem lỗi thường gặp và cách khắc phục' })).toHaveAttribute(
      'href',
      '/huong-dan#loi',
    );
  });

  it('danh sách vấn đề lấy đủ các tình huống trong "Lỗi thường gặp", gom theo nhóm, có mục "Vấn đề khác" cuối', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(huongDan.troubleshooting.length + 1);
    expect(options[options.length - 1]).toHaveTextContent(/vấn đề khác/i);
    for (const nhan of Object.values(NHAN_NHOM_LOI)) {
      expect(screen.getByText(nhan)).toBeInTheDocument();
    }
  });

  it('gõ không dấu vẫn tìm ra tình huống', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);

    await user.type(screen.getByRole('textbox', { name: /vấn đề thầy\/cô đang gặp/i }), 'mat khau');
    const options = await screen.findAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(huongDan.troubleshooting.length);
    options.forEach((o) => expect(o.textContent?.toLowerCase()).toMatch(/mật khẩu/));
  });

  it('cách khắc phục có mention "Phần N" -> liên kết sang /huong-dan#id (vì trang này không có các phần đó)', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);
    await user.click(await screen.findByRole('option', { name: TINH_HUONG.tinhHuong }));

    expect(await screen.findByRole('link', { name: 'Phần 3' })).toHaveAttribute('href', '/huong-dan#dang-nhap');
    expect(screen.getByRole('link', { name: 'Phần 11' })).toHaveAttribute('href', '/huong-dan#quen-mat-khau');
  });

  it('chọn tình huống -> hiện cách khắc phục, chưa hiện ô nhập cho tới khi bấm "Vẫn còn thắc mắc"', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);
    await user.click(await screen.findByRole('option', { name: TINH_HUONG.tinhHuong }));

    expect(await screen.findByText('Cách khắc phục')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(TINH_HUONG.cachXuLy.length);
    expect(screen.queryByLabelText(/nội dung thắc mắc/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /vẫn còn thắc mắc/i }));
    expect(screen.getByLabelText(/nội dung thắc mắc/i)).toBeInTheDocument();
  });

  it('gửi thắc mắc sau khi xem cách khắc phục -> lưu tinh_huong, hiện trong "Yêu cầu của tôi"', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);
    await user.click(await screen.findByRole('option', { name: TINH_HUONG.tinhHuong }));
    await user.click(await screen.findByRole('button', { name: /vẫn còn thắc mắc/i }));
    await user.type(screen.getByLabelText(/nội dung thắc mắc/i), 'Đã làm theo nhưng vẫn không đăng nhập được');
    await user.click(screen.getByRole('button', { name: /gửi yêu cầu/i }));

    await waitFor(() => {
      expect(screen.getByText('Đã làm theo nhưng vẫn không đăng nhập được')).toBeInTheDocument();
    });
    expect(db.danhSachYeuCauHoTro[0].tinh_huong).toBe(TINH_HUONG.tinhHuong);
    // Form trở về trạng thái ban đầu sau khi gửi.
    expect(screen.queryByLabelText(/nội dung thắc mắc/i)).not.toBeInTheDocument();
  });

  it('chọn "Vấn đề khác" -> hiện ô nhập ngay, không có cách khắc phục', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);
    await user.click(await screen.findByRole('option', { name: /vấn đề khác/i }));

    expect(await screen.findByLabelText(/nội dung cần hỗ trợ/i)).toBeInTheDocument();
    expect(screen.queryByText('Cách khắc phục')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /vẫn còn thắc mắc/i })).not.toBeInTheDocument();
  });

  it('gửi khi chưa nhập nội dung -> báo lỗi, không gọi API', async () => {
    const user = userEvent.setup();
    renderDaDangNhap();
    await moDanhSach(user);
    await user.click(await screen.findByRole('option', { name: /vấn đề khác/i }));
    await user.click(await screen.findByRole('button', { name: /gửi yêu cầu/i }));

    expect(await screen.findByText(/nhập nội dung cần hỗ trợ/i)).toBeInTheDocument();
    expect(db.danhSachYeuCauHoTro).toHaveLength(0);
  });
});
