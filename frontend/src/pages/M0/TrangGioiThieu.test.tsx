import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderTrang } from '@/test/testUtils';
import TrangGioiThieu from './TrangGioiThieu';
import { gioiThieu } from '@/content/gioiThieu';

describe('M0 — Trang giới thiệu', () => {
  it('hiện nút "Đăng nhập cổng học viên" ngay màn hình đầu khi chưa đăng nhập', async () => {
    renderTrang(<TrangGioiThieu />);
    const nut = await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(nut).toBeVisible();
  });

  it('không hiển thị tên tỉnh "An Giang" (trang dùng chung nhiều tỉnh)', async () => {
    const { container } = renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(container.textContent).not.toContain('An Giang');
  });

  it('không render conSo/viSao/noiDung khi hien:false (mặc định nội dung hiện tại)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(screen.queryByRole('heading', { name: gioiThieu.viSao.tieuDe })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: gioiThieu.noiDung.tieuDe })).not.toBeInTheDocument();
    expect(screen.queryByText(gioiThieu.conSo.muc[0].nhan)).not.toBeInTheDocument();
  });

  // Tiêu đề mục cũng xuất hiện ở menu điều hướng (header) khi mục đó hien — dùng role "heading" để
  // phân biệt với link menu cùng tên, tránh lỗi "tìm thấy nhiều phần tử".
  it('render conSo/viSao/noiDung khi hien:true (xác nhận đúng theo cờ, không bị ẩn cứng)', async () => {
    const truoc = {
      conSo: gioiThieu.conSo.hien,
      viSao: gioiThieu.viSao.hien,
      noiDung: gioiThieu.noiDung.hien,
    };
    gioiThieu.conSo.hien = true;
    gioiThieu.viSao.hien = true;
    gioiThieu.noiDung.hien = true;
    try {
      renderTrang(<TrangGioiThieu />);
      await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
      expect(screen.getByText(gioiThieu.conSo.muc[0].nhan)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: gioiThieu.viSao.tieuDe })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: gioiThieu.noiDung.tieuDe })).toBeInTheDocument();
      // Tên mô-đun xuất hiện cả ở khối xem nhanh trong hero lẫn ở section chương trình đầy đủ.
      expect(screen.getAllByText(gioiThieu.noiDung.moDun[0].ten).length).toBeGreaterThan(0);
    } finally {
      gioiThieu.conSo.hien = truoc.conSo;
      gioiThieu.viSao.hien = truoc.viSao;
      gioiThieu.noiDung.hien = truoc.noiDung;
    }
  });

  it('hiển thị lộ trình học (nội dung thật, 7 bước)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.loTrinh.tieuDe });
    expect(screen.getByText(gioiThieu.loTrinh.buoc[0].ten)).toBeInTheDocument();
    expect(screen.getByText(gioiThieu.loTrinh.buoc[gioiThieu.loTrinh.buoc.length - 1].ten)).toBeInTheDocument();
  });

  it('hiển thị hướng dẫn nhanh và FAQ và liên hệ (nội dung thật)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.huongDan.tieuDe });
    expect(screen.getByText(gioiThieu.huongDan.buoc[0].ten)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.hoiDap.tieuDe })).toBeInTheDocument();
    expect(screen.getByText(gioiThieu.hoiDap.cau[0].hoi)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.lienHe.tieuDe })).toBeInTheDocument();
  });
});
