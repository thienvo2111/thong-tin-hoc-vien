import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { datCauHinhCuaToiMock, datCauHinhKhaoSatMock, datCauHinhKhoaMock } from '@/test/mocks/cauHinhKhaoSat';
import type { CauHinhKhaoSat } from '@/api/cauHinhKhaoSat';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import TrangChinh from './TrangChinh';

const routes = [
  { path: '/toi', element: <TrangChinh /> },
  { path: '/toi/ho-so', element: <div>Màn hình hồ sơ</div> },
  { path: '/toi/xac-nhan', element: <div>Màn hình xác nhận</div> },
  { path: '/toi/danh-gia-dau-vao', element: <div>Màn hình đánh giá</div> },
];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi'] });
}

describe('M3 — Trang chính', () => {
  it('trạng thái tải: hiện loader trong lúc chờ API', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi/dot-xac-nhan', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('đợt đang mở, hồ sơ thiếu → hiện số trường thiếu + hạn + nút Bổ sung thông tin', async () => {
    renderDaDangNhap();
    expect(await screen.findByText(/Còn 2 thông tin cần bổ sung/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bổ sung thông tin' })).toHaveAttribute('href', '/toi/ho-so');
  });

  it('đợt đang mở, đủ, chưa xác nhận → nút Xem lại & xác nhận', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    renderDaDangNhap();
    expect(await screen.findByText(/Hồ sơ đã đủ/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem lại & xác nhận' })).toHaveAttribute('href', '/toi/xac-nhan');
  });

  it('đợt đang mở, đã xác nhận (không phải đợt đánh giá) → nút Xem hồ sơ, không có khối đánh giá', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.xac_nhan_luc = '2026-09-20T03:00:00.000Z';
    renderDaDangNhap();
    expect(await screen.findByText(/Đã xác nhận lúc/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.queryByText('Làm bài đánh giá')).not.toBeInTheDocument();
  });

  it('đợt 2 (xac_nhan_truoc_danh_gia) đã xác nhận → thêm khối đánh giá + nút Làm bài đánh giá', async () => {
    db.dotXacNhan.dot!.loai = 'xac_nhan_truoc_danh_gia';
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    db.dotXacNhan.da_xac_nhan = true;
    db.dotXacNhan.xac_nhan_luc = '2026-10-06T03:00:00.000Z';
    renderDaDangNhap();
    expect(await screen.findByText('Làm bài đánh giá')).toBeInTheDocument();
  });

  it('không có đợt mở, có đợt sắp mở → hiện giờ mở + nút Xem hồ sơ (chỉ xem)', async () => {
    db.dotXacNhan.dot = null;
    db.dotXacNhan.dot_sap_mo = { ten: 'Kiểm tra hồ sơ đợt 2', mo_luc: '2026-10-05T00:00:00.000Z' };
    renderDaDangNhap();
    expect(await screen.findByText(/mở lúc/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem hồ sơ' })).toBeInTheDocument();
  });

  it('không có đợt nào mở → "Hiện không trong thời gian chỉnh sửa hồ sơ"', async () => {
    db.dotXacNhan.dot = null;
    db.dotXacNhan.dot_sap_mo = null;
    renderDaDangNhap();
    expect(await screen.findByText('Hiện không trong thời gian chỉnh sửa hồ sơ')).toBeInTheDocument();
  });

  it('luôn hiện menu 2 mục: Cập nhật hồ sơ và Thông tin lớp học', async () => {
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: /Cập nhật hồ sơ/ })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.getByRole('link', { name: /Thông tin lớp học/ })).toHaveAttribute('href', '/toi/lop-hoc');
  });
});

describe('M3 — lời chào theo giới tính', () => {
  it.each([
    ['nam', 'Chào mừng Thầy Nguyễn Văn A'],
    ['nu', 'Chào mừng Cô Nguyễn Văn A'],
    [null, 'Chào mừng Thầy/Cô Nguyễn Văn A'],
  ] as const)('gioi_tinh=%s -> "%s"', async (gioiTinh, loiChao) => {
    db.hoSo.gioi_tinh = gioiTinh;
    db.hoSo.ho_ten = 'Nguyễn Văn A';
    renderDaDangNhap();
    expect(await screen.findByRole('heading', { name: new RegExp(loiChao) })).toBeInTheDocument();
  });

  it('chưa tải được hồ sơ -> vẫn chào chung "Thầy/Cô"', async () => {
    server.use(http.get('/hoc-vien/toi', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByRole('heading', { name: /Chào mừng Thầy\/Cô/ })).toBeInTheDocument();
  });
});

describe('M3 — khảo sát đầu vào / đầu ra', () => {
  const locationGoc = window.location;
  const cauHinh = (ghiDe: Partial<CauHinhKhaoSat>): CauHinhKhaoSat => ({
    che_do_hoc_vien: 'dang_nhap',
    danh_gia_dau_vao_trong_cong: false,
    hien_khao_sat: false,
    kenh_danh_gia: 'sso',
    khao_sat_dau_ra_mo: false,
    phieu: [],
    ...ghiDe,
  });
  const datDayDu = () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
  };

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: locationGoc });
  });

  it('chưa mở khảo sát nào -> không hiện khối khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({}));
    renderDaDangNhap();
    expect(await screen.findByText(/Còn 2 thông tin cần bổ sung/)).toBeInTheDocument();
    expect(screen.queryByText(/Khảo sát đầu vào đã mở/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Khảo sát đầu ra đã mở/)).not.toBeInTheDocument();
  });

  it('đầu vào mở, hồ sơ thiếu -> liệt kê thông tin phải cập nhật + nút về hồ sơ, không có nút làm khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true }));
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu vào đã mở')).toBeInTheDocument();
    expect(screen.getByText(/cần hoàn thành cập nhật các thông tin sau trước khi bắt đầu làm khảo sát/)).toBeInTheDocument();
    expect(screen.getAllByText('Số CCCD').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Cập nhật thông tin hồ sơ' })).toHaveAttribute('href', '/toi/ho-so');
    expect(screen.queryByRole('link', { name: 'Làm khảo sát đầu vào' })).not.toBeInTheDocument();
  });

  it('đầu vào mở, hồ sơ đủ -> nút Làm khảo sát đầu vào sang M6', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true }));
    datDayDu();
    renderDaDangNhap();
    expect(await screen.findByRole('link', { name: 'Làm khảo sát đầu vào' })).toHaveAttribute(
      'href',
      '/toi/danh-gia-dau-vao',
    );
  });

  it('đầu ra mở, hồ sơ thiếu -> liệt kê thông tin phải cập nhật, không có nút làm khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu ra đã mở')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cập nhật thông tin hồ sơ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Làm khảo sát đầu ra' })).not.toBeInTheDocument();
  });

  it('đầu ra mở, hồ sơ đủ -> bấm nút cấp mã target=dau-ra rồi chuyển trang cùng tab', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    datDayDu();
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...locationGoc, assign } });
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(await screen.findByRole('button', { name: 'Làm khảo sát đầu ra' }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(new URL(assign.mock.calls[0][0]).searchParams.get('target')).toBe('dau-ra');
  });

  it('đầu ra: cấp mã bị từ chối -> hiện lỗi, không chuyển trang', async () => {
    datCauHinhKhaoSatMock(cauHinh({ khao_sat_dau_ra_mo: true }));
    datDayDu();
    server.use(
      http.post('/sso/cap-ma', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Khảo sát đầu ra chưa mở' } }, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderDaDangNhap();

    await user.click(await screen.findByRole('button', { name: 'Làm khảo sát đầu ra' }));
    expect(await screen.findByText('Khảo sát đầu ra chưa mở')).toBeInTheDocument();
  });

  it('mở cả hai -> hiện cả 2 khối', async () => {
    datCauHinhKhaoSatMock(cauHinh({ danh_gia_dau_vao_trong_cong: true, khao_sat_dau_ra_mo: true }));
    datDayDu();
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu vào đã mở')).toBeInTheDocument();
    expect(await screen.findByText('Khảo sát đầu ra đã mở')).toBeInTheDocument();
  });
});

describe('M3 — cấu hình theo khóa học viên đã ghi danh (2026-10-02)', () => {
  it('cấu hình chung chưa mở đầu ra nhưng khóa của học viên mở -> hiện khối khảo sát đầu ra', async () => {
    db.dotXacNhan.day_du = true;
    db.dotXacNhan.thieu = [];
    const chung: CauHinhKhaoSat = {
      che_do_hoc_vien: 'dang_nhap',
      danh_gia_dau_vao_trong_cong: false,
      hien_khao_sat: false,
      kenh_danh_gia: 'sso',
      khao_sat_dau_ra_mo: false,
      phieu: [],
    };
    datCauHinhKhaoSatMock(chung);
    datCauHinhKhoaMock({
      khoa_id: 'k-hv',
      ma_khoa: 'K-HV',
      ten_khoa: 'Khóa của học viên',
      tinh: null,
      cau_hinh: { ...chung, khao_sat_dau_ra_mo: true },
    });
    datCauHinhCuaToiMock('k-hv');
    renderDaDangNhap();
    expect(await screen.findByText('Khảo sát đầu ra đã mở')).toBeInTheDocument();
  });
});
