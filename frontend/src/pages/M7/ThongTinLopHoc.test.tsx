import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
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

  it('chưa được phân vào lớp nào (cả 3 loại đều null) → thông báo chờ phân lớp, không hiện buổi học', async () => {
    const dangKy: KhoaHocDangKy = {
      ...db.khoaHocToi[0],
      cum: null,
      lop_truc_tiep: null,
      lop_zoom: null,
      lop_vle: null,
    };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([dangKy])));
    renderDaDangNhap();

    expect(await screen.findByText(dangKy.khoa.ten_khoa)).toBeInTheDocument();
    expect(screen.getByText('Chưa được phân vào lớp nào (trực tiếp/Zoom/VLE).')).toBeInTheDocument();
    expect(screen.queryByText(/^Buổi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cụm hỗ trợ Zalo/)).not.toBeInTheDocument();
  });

  it('có đủ cả 3 loại lớp + cụm: hiện từng khối riêng, buổi học nhóm theo giai đoạn (địa điểm text + link http), kết quả đánh giá', async () => {
    renderDaDangNhap();

    // Cụm hỗ trợ Zalo.
    expect(await screen.findByText('Cụm hỗ trợ Zalo: Cụm Long Xuyên')).toBeInTheDocument();
    expect(screen.getByText('Hỗ trợ kỹ thuật trong giờ hành chính')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào nhóm Zalo' })).toHaveAttribute(
      'href',
      'https://zalo.me/g/cum-long-xuyen',
    );

    // Lớp trực tiếp.
    expect(screen.getByText('Lớp trực tiếp')).toBeInTheDocument();
    expect(screen.getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(screen.getByText(/Giảng viên: Nguyễn Văn Long — 0909123456/)).toBeInTheDocument();
    expect(screen.getByText(/Hỗ trợ: Trần Thị Mai/)).toBeInTheDocument();
    // T12: "Giai đoạn 1 — Tập trung" giờ xuất hiện 2 nơi (tiêu đề nhóm buổi học + khối "Tiến độ học
    // tập" bên dưới) -> getAllByText thay vì getByText.
    expect(screen.getAllByText('Giai đoạn 1 — Tập trung').length).toBeGreaterThan(0);
    expect(screen.getByText('Trực tiếp')).toBeInTheDocument();
    expect(screen.getByText('Buổi 1')).toBeInTheDocument();
    expect(screen.getByText('Địa điểm: Hội trường A, THPT Long Xuyên')).toBeInTheDocument();
    // T12 (2026-09-30): buổi 1 đã điểm danh 'co_mat' -> hiện badge "Có mặt".
    expect(screen.getByText('Có mặt')).toBeInTheDocument();

    // Lớp Zoom.
    expect(screen.getByText('Lớp học qua Zoom')).toBeInTheDocument();
    expect(screen.getByText('Lớp Zoom 01')).toBeInTheDocument();
    expect(screen.getByText(/Giảng viên: Lê Thị Hồng/)).toBeInTheDocument();
    // T12: cùng lý do trên — "Giai đoạn 2 — Trực tuyến" cũng xuất hiện ở khối "Tiến độ học tập".
    expect(screen.getAllByText('Giai đoạn 2 — Trực tuyến').length).toBeGreaterThan(0);
    expect(screen.getByText('Trực tuyến')).toBeInTheDocument();
    expect(screen.getByText('Buổi 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào học' })).toHaveAttribute(
      'href',
      'https://vle.example.edu.vn/lop-1/buoi-2',
    );
    // T12: buổi 2 chưa được điểm danh (null) -> KHÔNG hiện badge nào, tránh nhầm là "vắng".
    expect(screen.queryByText('Vắng')).not.toBeInTheDocument();
    expect(screen.queryByText('Vắng có phép')).not.toBeInTheDocument();

    // Lớp VLE (không có buổi học).
    expect(screen.getByText('Lớp học trên VLE')).toBeInTheDocument();
    expect(screen.getByText('Lớp VLE 01')).toBeInTheDocument();

    expect(screen.getByText(/Đầu vào: Cơ bản/)).toBeInTheDocument();
    expect(screen.getByText(/Đầu ra: Chưa có kết quả/)).toBeInTheDocument();

    // T12: tiến độ theo giai đoạn (import ket_qua_giai_doan).
    expect(screen.getByText('Tiến độ học tập')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành: 100%')).toBeInTheDocument();
    expect(screen.getByText('Điểm: 8.5')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành: 40%')).toBeInTheDocument();
  });

  it('chưa có tiến độ giai đoạn nào (mảng rỗng) → không hiện khối "Tiến độ học tập"', async () => {
    const dangKy: KhoaHocDangKy = { ...db.khoaHocToi[0], tien_do_giai_doan: [] };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([dangKy])));
    renderDaDangNhap();

    expect(await screen.findByText(dangKy.khoa.ten_khoa)).toBeInTheDocument();
    expect(screen.queryByText('Tiến độ học tập')).not.toBeInTheDocument();
  });

  it('chỉ có 1 trong 3 loại lớp (không phải cả 3), không có cụm → chỉ hiện khối lớp trực tiếp', async () => {
    const dangKy: KhoaHocDangKy = {
      ...db.khoaHocToi[0],
      cum: null,
      lop_zoom: null,
      lop_vle: null,
    };
    server.use(http.get('/hoc-vien/toi/khoa-hoc', () => HttpResponse.json([dangKy])));
    renderDaDangNhap();

    expect(await screen.findByText('Lớp trực tiếp')).toBeInTheDocument();
    expect(screen.getByText('Lớp 01 – Nhóm cơ bản A')).toBeInTheDocument();
    expect(screen.queryByText('Lớp học qua Zoom')).not.toBeInTheDocument();
    expect(screen.queryByText('Lớp học trên VLE')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cụm hỗ trợ Zalo/)).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa được phân vào lớp nào (trực tiếp/Zoom/VLE).')).not.toBeInTheDocument();
  });
});
