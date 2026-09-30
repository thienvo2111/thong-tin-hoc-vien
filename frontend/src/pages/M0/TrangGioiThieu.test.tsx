import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('không render conSo khi hien:false (số liệu minh họa vẫn chờ xác nhận nguồn dữ liệu)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(screen.queryByText(gioiThieu.conSo.muc[0].nhan)).not.toBeInTheDocument();
  });

  // Tiêu đề mục cũng xuất hiện ở menu điều hướng (header) khi mục đó hien — dùng role "heading" để
  // phân biệt với link menu cùng tên, tránh lỗi "tìm thấy nhiều phần tử".
  it('render viSao/doiTuong/noiDung mặc định (nội dung thật theo 3 mức, không còn placeholder)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(screen.getByRole('heading', { name: gioiThieu.viSao.tieuDe })).toBeInTheDocument();
    expect(screen.getByText(gioiThieu.viSao.doanMo)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.doiTuong.tieuDe })).toBeInTheDocument();
    expect(screen.getByText(gioiThieu.doiTuong.nhom[0])).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.noiDung.tieuDe })).toBeInTheDocument();

    // Mặc định chọn tab "Thành thạo" — chuyên đề đầu tiên của mức này hiện cả ở khối xem nhanh
    // trong hero (tên mức) lẫn ở section chương trình đầy đủ (tên chuyên đề).
    const thanhThao = gioiThieu.noiDung.danhSachMuc.find((m) => m.ma === 'thanh_thao')!;
    expect(screen.getAllByText(`Mức ${thanhThao.ten}`).length).toBeGreaterThan(0);
    expect(screen.getByText(thanhThao.chuyenDe[0].ten)).toBeInTheDocument();
    expect(screen.getByText(thanhThao.doiTuongPhuHop)).toBeInTheDocument();
  });

  it('chuyển tab hiện đúng chuyên đề và đối tượng phù hợp của từng mức', async () => {
    const user = userEvent.setup();
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });

    const coBan = gioiThieu.noiDung.danhSachMuc.find((m) => m.ma === 'co_ban')!;
    const nangCao = gioiThieu.noiDung.danhSachMuc.find((m) => m.ma === 'nang_cao')!;

    // Ban đầu (tab "Thành thạo" mặc định), chuyên đề của mức "Cơ bản" chưa hiện.
    expect(screen.queryByText(coBan.doiTuongPhuHop)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Cơ bản' }));
    expect(await screen.findByText(coBan.doiTuongPhuHop)).toBeInTheDocument();
    expect(screen.getByText(coBan.chuyenDe[0].ten)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Nâng cao' }));
    expect(await screen.findByText(nangCao.doiTuongPhuHop)).toBeInTheDocument();
    expect(screen.getByText(nangCao.chuyenDe[0].ten)).toBeInTheDocument();
  });

  it('render khối "Hợp tác tổ chức bồi dưỡng" mặc định', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.hopTac.tieuDe });
  });

  it('render conSo khi bật hien:true (xác nhận đúng theo cờ, không bị ẩn cứng)', async () => {
    const truoc = gioiThieu.conSo.hien;
    gioiThieu.conSo.hien = true;
    try {
      renderTrang(<TrangGioiThieu />);
      await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
      expect(screen.getByText(gioiThieu.conSo.muc[0].nhan)).toBeInTheDocument();
    } finally {
      gioiThieu.conSo.hien = truoc;
    }
  });

  it('hiển thị lộ trình học (nội dung thật, 9 bước)', async () => {
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
