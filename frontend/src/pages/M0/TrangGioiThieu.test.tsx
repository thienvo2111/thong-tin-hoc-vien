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

  it('chỉ render mục 1/6/7/8 (bản tối thiểu), không render mục 2/3/5/9', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    // Mục 3 "Vì sao cần năng lực số" có hien:false trong nội dung tạm hiện tại — không được render dù bản tối thiểu có bật lại sau.
    expect(screen.queryByText(gioiThieu.viSao.tieuDe)).not.toBeInTheDocument();
    expect(screen.queryByText(gioiThieu.noiDung.tieuDe)).not.toBeInTheDocument();
  });

  it('hiển thị hướng dẫn nhanh (mục 6) và FAQ (mục 7) và liên hệ (mục 8)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByText(gioiThieu.huongDan.tieuDe);
    expect(screen.getByText(gioiThieu.hoiDap.tieuDe)).toBeInTheDocument();
    expect(screen.getByText(gioiThieu.lienHe.tieuDe)).toBeInTheDocument();
  });
});
