import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { KhoaHocDangKy } from '@/api/types';
import ThongTinLopHoc from './ThongTinLopHoc';

const routes = [{ path: '/toi/lop-hoc', element: <ThongTinLopHoc /> }];

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/lop-hoc'] });
}

async function cacTheGiaiDoan() {
  return screen.findAllByTestId('the-giai-doan');
}

// Phân lớp theo giai đoạn (spec 2026-10-02 mục 5.2): M7 là dòng thời gian, mỗi giai đoạn 1 thẻ.
describe('M7 — Thông tin lớp học', () => {
  it('trạng thái tải: hiện loader trong lúc chờ API', () => {
    renderDaDangNhap();
    expect(document.querySelector('.mantine-Loader-root')).toBeInTheDocument();
  });

  it('lỗi API: hiện thông báo lỗi', async () => {
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.error()));
    renderDaDangNhap();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });

  it('mảng rỗng → thông báo chưa được ghi danh', async () => {
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([])));
    renderDaDangNhap();
    expect(await screen.findByText('Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào.')).toBeInTheDocument();
  });

  it('hiện mỗi giai đoạn 1 thẻ theo thứ tự, kèm nhãn hình thức', async () => {
    renderDaDangNhap();
    const the = await cacTheGiaiDoan();
    expect(the.map((t) => within(t).getByRole('heading').textContent)).toEqual([
      'GĐ1 · Đánh giá đầu vào',
      'GĐ2 · Học trực tiếp',
      'GĐ3 · Học trực tuyến qua zoom',
      'GĐ4 · Học trực tuyến qua VLE',
    ]);
    expect(within(the[0]).getByText('Đánh giá')).toBeInTheDocument();
    expect(within(the[1]).getByText('Trực tiếp')).toBeInTheDocument();
  });

  it('giai đoạn có lớp: tên lớp, nhân sự đã dịch nhãn, buổi + điểm danh, tiến độ', async () => {
    renderDaDangNhap();
    const gd2 = (await cacTheGiaiDoan())[1];
    expect(within(gd2).getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(within(gd2).getByText(/Giảng viên: Nguyễn Văn Long — 0909123456/)).toBeInTheDocument();
    expect(within(gd2).getByText(/Hỗ trợ: Trần Thị Mai/)).toBeInTheDocument();
    expect(within(gd2).getAllByText(/^Buổi \d$/)).toHaveLength(2);
    expect(within(gd2).getAllByText('Địa điểm: Hội trường A, THPT Long Xuyên')).toHaveLength(2);
    expect(within(gd2).getByText('Có mặt')).toBeInTheDocument();
    expect(within(gd2).getByText('Hoàn thành: 75%')).toBeInTheDocument();

    const gd3 = (await cacTheGiaiDoan())[2];
    expect(within(gd3).getByText('Lớp Zoom 01')).toBeInTheDocument();
    expect(within(gd3).getByRole('link', { name: 'Vào học' })).toHaveAttribute(
      'href',
      'https://vle.example.edu.vn/lop-1/buoi-2',
    );
    // Buổi chưa điểm danh (null) -> không hiện badge nào, tránh nhầm là "vắng".
    expect(within(gd3).queryByText('Vắng')).not.toBeInTheDocument();
  });

  it('giai đoạn không lớp: hiện link + hướng dẫn chung của giai đoạn', async () => {
    renderDaDangNhap();
    const gd1 = (await cacTheGiaiDoan())[0];
    expect(within(gd1).getByRole('link', { name: 'Mở liên kết' })).toHaveAttribute(
      'href',
      'https://vle.example/danh-gia',
    );
    expect(within(gd1).getByText('Làm bài trong 60 phút')).toBeInTheDocument();
    expect(within(gd1).queryByText(/Chưa được phân lớp/)).not.toBeInTheDocument();
  });

  it('giai đoạn không lớp, không link, không hướng dẫn: chỉ tiêu đề + ngày + dòng nhắc, không lỗi', async () => {
    renderDaDangNhap();
    const gd4 = (await cacTheGiaiDoan())[3];
    expect(within(gd4).queryByRole('link')).not.toBeInTheDocument();
    expect(within(gd4).getByText('Chưa được phân lớp ở giai đoạn này.')).toBeInTheDocument();
  });

  it('cụm Zalo và kết quả đánh giá vẫn hiện như trước', async () => {
    renderDaDangNhap();
    expect(await screen.findByText('Cụm hỗ trợ Zalo: Cụm Long Xuyên')).toBeInTheDocument();
    expect(screen.getByText('Hỗ trợ kỹ thuật trong giờ hành chính')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào nhóm Zalo' })).toHaveAttribute(
      'href',
      'https://zalo.me/g/cum-long-xuyen',
    );
    expect(screen.getByText(/Đầu vào: Cơ bản/)).toBeInTheDocument();
    expect(screen.getByText(/Đầu ra: Chưa có kết quả/)).toBeInTheDocument();
  });

  it('chưa được phân lớp ở giai đoạn nào → banner chờ phân lớp, không có buổi học, không cụm', async () => {
    const dangKy: KhoaHocDangKy = {
      ...db.khoaHocToi[0],
      cum: null,
      giai_doan: db.khoaHocToi[0].giai_doan.map((g) => ({ ...g, lop: null })),
    };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([dangKy])));
    renderDaDangNhap();

    expect(await screen.findByText(dangKy.khoa.ten_khoa)).toBeInTheDocument();
    expect(screen.getByText('Chưa được phân vào lớp nào.')).toBeInTheDocument();
    expect(screen.queryByText(/^Buổi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cụm hỗ trợ Zalo/)).not.toBeInTheDocument();
  });
});
