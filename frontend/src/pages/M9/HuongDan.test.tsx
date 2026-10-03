import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { huongDan } from '@/content/huongDan';
import HuongDan from './HuongDan';

const routes = [{ path: '/huong-dan', element: <HuongDan /> }];

function render() {
  return renderVoiRouter(routes, { initialEntries: ['/huong-dan'] });
}

const TIEU_DE_13_PHAN = [
  ...huongDan.parts.map((p) => p.tieuDe),
  'Lỗi thường gặp và cách khắc phục',
  'Liên hệ hỗ trợ và an toàn tài khoản',
];

describe('M9 — Hướng dẫn sử dụng: 13 phần', () => {
  it('render đủ 13 tiêu đề phần', () => {
    const { container } = render();
    TIEU_DE_13_PHAN.forEach((tieuDe) => {
      expect(screen.getByRole('heading', { level: 2, name: tieuDe })).toBeInTheDocument();
    });
    expect(TIEU_DE_13_PHAN).toHaveLength(13);
    expect(container.textContent).not.toContain('An Giang');
  });
});

describe('M9 — bố cục mục lục + nội dung', () => {
  it('hàng mục lục/nội dung cho phép xuống dòng (tránh nội dung bị bóp 0px ở màn hình hẹp)', () => {
    const { container } = render();
    const hang = container.querySelector('[data-testid="hang-bo-cuc"]') as HTMLElement;
    expect(hang).not.toBeNull();
    expect(hang.style.flexWrap).toBe('wrap');
  });
});

describe('M9 — đổi kiểu hình minh họa', () => {
  it('bấm "Điện thoại"/"Máy tính" đổi ảnh minh họa (src thay đổi)', async () => {
    const user = userEvent.setup();
    render();

    const anh = screen.getByAltText('Minh họa màn hình đăng nhập') as HTMLImageElement;
    const srcBanDau = anh.src;

    await user.click(screen.getByRole('radio', { name: 'Máy tính' }));
    const anhSauKhiDoi = screen.getByAltText('Minh họa màn hình đăng nhập') as HTMLImageElement;
    expect(anhSauKhiDoi.src).not.toBe(srcBanDau);

    await user.click(screen.getByRole('radio', { name: 'Điện thoại' }));
    const anhSauKhiDoiLai = screen.getByAltText('Minh họa màn hình đăng nhập') as HTMLImageElement;
    expect(anhSauKhiDoiLai.src).toBe(srcBanDau);
  });
});

describe('M9 — Lỗi thường gặp: tìm kiếm & lọc', () => {
  it('tìm "tạm khóa" (có dấu) và "tam khoa" (không dấu) đều ra đúng mục, ẩn các mục khác', async () => {
    const user = userEvent.setup();
    render();

    const oTim = screen.getByLabelText('Tìm lỗi');

    await user.type(oTim, 'tạm khóa');
    expect(screen.getByText(/Tài khoản tạm khóa do nhập sai nhiều lần/)).toBeInTheDocument();
    expect(screen.queryByText('Số CCCD báo đã có người sử dụng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mã định danh hoặc mật khẩu không đúng/)).not.toBeInTheDocument();

    await user.clear(oTim);
    await user.type(oTim, 'tam khoa');
    expect(screen.getByText(/Tài khoản tạm khóa do nhập sai nhiều lần/)).toBeInTheDocument();
    expect(screen.queryByText('Số CCCD báo đã có người sử dụng')).not.toBeInTheDocument();
  });

  it('lọc theo nhóm "Hồ sơ, xác nhận" -> chỉ còn các mục nhóm đó', async () => {
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole('radio', { name: 'Hồ sơ, xác nhận' }));
    expect(screen.getByText('Số CCCD báo đã có người sử dụng')).toBeInTheDocument();
    expect(screen.queryByText(/Mã định danh hoặc mật khẩu không đúng/)).not.toBeInTheDocument();
    expect(screen.queryByText('Không nhận được email từ hệ thống')).not.toBeInTheDocument();
  });

  it('không tìm thấy -> hiện trạng thái rỗng kèm email hỗ trợ', async () => {
    const user = userEvent.setup();
    render();

    await user.type(screen.getByLabelText('Tìm lỗi'), 'khong-ton-tai-xyz');
    const thongBaoRong = screen.getByText(/Chưa tìm thấy lỗi phù hợp/);
    expect(thongBaoRong).toBeInTheDocument();
    expect(thongBaoRong.textContent).toContain(huongDan.contact.email);
  });

  it('bấm vào 1 mục để xem Nguyên nhân + Cách xử lý', async () => {
    const user = userEvent.setup();
    render();

    await user.type(screen.getByLabelText('Tìm lỗi'), 'tạm khóa');
    await user.click(screen.getByText(/Tài khoản tạm khóa do nhập sai nhiều lần/));
    expect(await screen.findByText(/chống người lạ dò mật khẩu/)).toBeInTheDocument();
    expect(screen.getByText(/Chờ đến giờ ghi trong thông báo/)).toBeInTheDocument();
  });
});

describe('M9 — công cụ tìm mật khẩu lần đầu từ ngày sinh', () => {
  it('mặc định 8/12/1983 -> 08121983; đổi ngày tháng năm -> cập nhật theo', async () => {
    const user = userEvent.setup();
    render();

    const congCu = screen.getByText('Tìm mật khẩu lần đầu từ ngày sinh').closest('.mantine-Paper-root') as HTMLElement;
    expect(within(congCu).getByText('08121983')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Ngày'), '1');
    await user.selectOptions(screen.getByLabelText('Tháng'), '1');
    await user.selectOptions(screen.getByLabelText('Năm'), '1978');
    expect(within(congCu).getByText('01011978')).toBeInTheDocument();
  });
});

describe('M9 — CTA đầu trang theo trạng thái đăng nhập', () => {
  it('chưa đăng nhập -> CTA "Đăng nhập" trỏ /dang-nhap', async () => {
    render();
    const header = screen.getByRole('banner');
    expect(await within(header).findByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap');
  });

  it('đã đăng nhập -> CTA "Vào trang của tôi" trỏ /toi', async () => {
    datToken('token-gia-lap');
    render();
    const header = screen.getByRole('banner');
    expect(await within(header).findByRole('link', { name: 'Vào trang của tôi' })).toHaveAttribute('href', '/toi');
    expect(within(header).queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument();
  });
});
