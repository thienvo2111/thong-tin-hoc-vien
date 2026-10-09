import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import DangNhap from './DangNhap';

const routes = [
  { path: '/dang-nhap', element: <DangNhap /> },
  { path: '/doi-mat-khau', element: <div>Màn hình đổi mật khẩu</div> },
  { path: '/toi', element: <div>Trang của tôi</div> },
  { path: '/quen-mat-khau', element: <div>Màn hình quên mật khẩu</div> },
];

describe('M1 — Đăng nhập', () => {
  it('đăng nhập bằng mã MOET + mật khẩu đúng (ngày sinh) → chuyển sang M2', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('dán mã định danh có khoảng trắng vẫn đăng nhập được (khoảng trắng bị loại bỏ)', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    const oMaDinhDanh = screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET') as HTMLInputElement;
    oMaDinhDanh.focus();
    await user.paste('9115 131060');
    expect(oMaDinhDanh.value).toBe('9115131060');

    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('sai mã định danh hoặc mật khẩu → 1 thông báo chung, không phân biệt sai phần nào', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), 'sai-ma');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai-mat-khau');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Mã định danh hoặc mật khẩu không đúng')).toBeInTheDocument();
  });

  it('423 ACCOUNT_LOCKED → thông báo tạm khóa kèm giờ mở khóa (giờ Việt Nam)', async () => {
    server.use(
      http.post('/auth/dang-nhap', () => loi(423, 'ACCOUNT_LOCKED', 'Tài khoản tạm khóa', { khoa_den: '2026-09-28T08:15:00.000Z' })),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText(/Tài khoản tạm khóa do nhập sai nhiều lần/)).toBeInTheDocument();
    expect(screen.getByText(/15:15/)).toBeInTheDocument();
    expect(screen.queryByText(/ngày sinh không còn dùng được/)).not.toBeInTheDocument();
  });

  async function dangNhapSai() {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), 'sai-ma');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  }

  it('sai mật khẩu → nhắc đã đổi mật khẩu thì ngày sinh không còn dùng được', async () => {
    await dangNhapSai();

    expect(await screen.findByText('Mã định danh hoặc mật khẩu không đúng')).toBeInTheDocument();
    expect(screen.getByText(/ngày sinh không còn dùng được/)).toBeInTheDocument();
  });

  it('429 → báo chờ 1 phút (không còn "vài phút") kèm lời nhắc mật khẩu', async () => {
    server.use(http.post('/auth/dang-nhap', () => loi(429, 'RATE_LIMITED', 'Too Many Requests')));
    await dangNhapSai();

    expect(await screen.findByText('Bạn đã thử quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.')).toBeInTheDocument();
    expect(screen.getByText(/ngày sinh không còn dùng được/)).toBeInTheDocument();
  });

  it('trạng thái tải: nút hiện loading khi đang gửi request', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    const nutGui = screen.getByRole('button', { name: 'Đăng nhập' });
    await user.click(nutGui);

    await waitFor(() => expect(nutGui).toHaveAttribute('data-loading', 'true'));
  });

  it('bấm "Không biết mã định danh?" → hiện khung hướng dẫn liên hệ', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.click(screen.getByRole('button', { name: 'Không biết mã định danh?' }));
    expect(await screen.findByText(/liên hệ bộ phận phụ trách/)).toBeInTheDocument();
  });

  it('có lối "Quên mật khẩu?" dẫn sang màn quên mật khẩu', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });

    await user.click(screen.getByRole('link', { name: 'Quên mật khẩu?' }));
    expect(await screen.findByText('Màn hình quên mật khẩu')).toBeInTheDocument();
  });

  it('có lối vào Hướng dẫn sử dụng (M9) ngay tại phần đăng nhập', async () => {
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(screen.getByRole('link', { name: /Xem hướng dẫn từng bước có hình minh họa/ })).toHaveAttribute(
      'href',
      '/huong-dan#dang-nhap',
    );
  });
});

describe('M1 — Đăng nhập không phụ thuộc chế độ triển khai', () => {
  it('kể cả chế độ "khao_sat" (mặc định): không hiện thông báo "chưa cần đăng nhập", form dùng được', async () => {
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
    expect(screen.queryByText('Học viên chưa cần đăng nhập')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đi tới trang khảo sát' })).not.toBeInTheDocument();
  });
});

// Spec 2026-10-09 Q-C: 2 chế độ đăng nhập — mã định danh MOET | số điện thoại.
describe('M1 — Đăng nhập bằng mã MOET hoặc số điện thoại', () => {
  // Chỉ khôi phục spy của test này — vi.restoreAllMocks() sẽ xóa luôn mock matchMedia trong test/setup.ts.
  const spies: { mockRestore: () => void }[] = [];
  afterEach(() => spies.splice(0).forEach((s) => s.mockRestore()));

  function batGuiBody() {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post('/auth/dang-nhap', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return loi(401, 'UNAUTHORIZED', 'Mã định danh hoặc mật khẩu không đúng');
      }),
    );
    return bodies;
  }

  it('mặc định chọn "Mã định danh MOET", gợi ý nói rõ có/không số 0 đầu đều được, không có chữ CCCD', () => {
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(screen.getByRole('radio', { name: 'Mã định danh MOET' })).toBeChecked();
    expect(screen.getByText('Nhập mã định danh MOET, có hoặc không có số 0 ở đầu đều được.')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.queryByText(/CCCD/)).not.toBeInTheDocument();
  });

  it('chọn "Số điện thoại" → đổi nhãn, gợi ý, bàn phím tel', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));

    const o = screen.getByRole('textbox', { name: 'Số điện thoại' });
    expect(o).toHaveAttribute('inputmode', 'tel');
    expect(o).toHaveAttribute('autocomplete', 'tel');
    expect(screen.getByText('Số điện thoại Thầy/Cô đã cung cấp cho nhà trường, ví dụ 0912345678.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tên tài khoản hoặc mã định danh MOET')).not.toBeInTheDocument();
  });

  it('chế độ mã: gửi kieu_dang_nhap="ma"; mã thiếu số 0 đầu vẫn đăng nhập được (mock khớp bỏ số 0)', async () => {
    db.hoSo.ma_dinh_danh_moet = '09115131060';
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('chế độ mã: payload có kieu_dang_nhap="ma"', async () => {
    const bodies = batGuiBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '9115131060');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByText('Mã định danh hoặc mật khẩu không đúng');
    expect(bodies).toEqual([{ ten_dang_nhap: '9115131060', mat_khau: 'sai', kieu_dang_nhap: 'ma' }]);
  });

  it('chế độ SĐT: đăng nhập thành công bằng SĐT có khoảng trắng (mock khớp SĐT hồ sơ)', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại' }), '0912 345 678');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('chế độ SĐT: payload có kieu_dang_nhap="sdt", thông báo lỗi nói "Số điện thoại"', async () => {
    const bodies = batGuiBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại' }), '0912345678');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Số điện thoại hoặc mật khẩu không đúng')).toBeInTheDocument();
    expect(bodies).toEqual([{ ten_dang_nhap: '0912345678', mat_khau: 'sai', kieu_dang_nhap: 'sdt' }]);
  });

  it('chế độ SĐT: dưới 9 hoặc trên 12 chữ số → báo lỗi, không gửi request', async () => {
    const bodies = batGuiBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    const o = screen.getByRole('textbox', { name: 'Số điện thoại' });
    await user.type(o, '0912-345');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Số điện thoại phải có từ 9 đến 12 chữ số')).toBeInTheDocument();

    await user.clear(o);
    await user.type(o, '+84 912 345 678 90');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Số điện thoại phải có từ 9 đến 12 chữ số')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('chế độ SĐT: bỏ trống cả 2 ô → báo lỗi cả 2 ô', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Vui lòng nhập số điện thoại')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
  });

  it('401 ở chế độ mã → giữ gợi ý ngày sinh + gợi ý thử "Số điện thoại"', async () => {
    batGuiBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '123');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText("Thử chọn 'Số điện thoại' nếu Thầy/Cô không nhớ mã định danh.")).toBeInTheDocument();
    expect(screen.getByText(/ngày sinh không còn dùng được/)).toBeInTheDocument();
  });

  it('401 ở chế độ SĐT → gợi ý chọn "Mã định danh MOET" khi SĐT dùng chung/đã đổi', async () => {
    batGuiBody();
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại' }), '0900000000');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByText(
        "Nếu số điện thoại dùng chung với người khác hoặc đã thay đổi, hãy chọn 'Mã định danh MOET'.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/ngày sinh không còn dùng được/)).toBeInTheDocument();
    expect(screen.queryByText(/Thử chọn 'Số điện thoại'/)).not.toBeInTheDocument();
  });

  it('429 → không hiện gợi ý chéo (chỉ dành cho sai thông tin 401)', async () => {
    server.use(http.post('/auth/dang-nhap', () => loi(429, 'RATE_LIMITED', 'Too Many Requests')));
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.type(screen.getByLabelText('Tên tài khoản hoặc mã định danh MOET'), '123');
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByText('Bạn đã thử quá nhiều lần. Vui lòng chờ 1 phút rồi thử lại.');
    expect(screen.queryByText(/Thử chọn 'Số điện thoại'/)).not.toBeInTheDocument();
  });

  it('nhớ chế độ đã chọn: lần mở sau tự chọn lại "Số điện thoại"', async () => {
    const user = userEvent.setup();
    const { unmount } = renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    expect(localStorage.getItem('kieu_dang_nhap')).toBe('sdt');
    unmount();

    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(screen.getByRole('radio', { name: 'Số điện thoại' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Số điện thoại' })).toBeInTheDocument();
  });

  it('giá trị lưu lạ trong localStorage → về mặc định "Mã định danh MOET"', () => {
    localStorage.setItem('kieu_dang_nhap', 'cccd');
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(screen.getByRole('radio', { name: 'Mã định danh MOET' })).toBeChecked();
  });

  it('localStorage ném lỗi (trình duyệt chặn) → trang vẫn chạy, đổi chế độ và đăng nhập được', async () => {
    spies.push(
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      }),
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      }),
    );
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    expect(screen.getByRole('radio', { name: 'Mã định danh MOET' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    await user.type(screen.getByRole('textbox', { name: 'Số điện thoại' }), '0912345678');
    await user.type(screen.getByLabelText('Mật khẩu'), '08121983');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Màn hình đổi mật khẩu')).toBeInTheDocument();
  });

  it('dán SĐT có khoảng trắng ở chế độ SĐT → khoảng trắng bị loại bỏ', async () => {
    const user = userEvent.setup();
    renderVoiRouter(routes, { initialEntries: ['/dang-nhap'] });
    await user.click(screen.getByRole('radio', { name: 'Số điện thoại' }));
    const o = screen.getByRole('textbox', { name: 'Số điện thoại' }) as HTMLInputElement;
    o.focus();
    await user.paste('0912 345 678');
    expect(o.value).toBe('0912345678');
  });
});
