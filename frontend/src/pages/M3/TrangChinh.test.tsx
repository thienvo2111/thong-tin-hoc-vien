import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
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
