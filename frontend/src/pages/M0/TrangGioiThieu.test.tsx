import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderTrang } from '@/test/testUtils';
import TrangGioiThieu from './TrangGioiThieu';
import { gioiThieu } from '@/content/gioiThieu';
import { trienKhai } from '@/content/trienKhai';

// Test đổi trực tiếp cấu hình (object module dùng chung) — lưu bản gốc và khôi phục sau mỗi test.
const goc = {
  trienKhai: structuredClone(trienKhai),
  khaoSat: structuredClone(gioiThieu.khaoSatDauVao),
  conSoHien: gioiThieu.conSo.hien,
};

beforeEach(() => {
  Object.assign(trienKhai, structuredClone(goc.trienKhai));
  gioiThieu.khaoSatDauVao = structuredClone(goc.khaoSat);
  gioiThieu.conSo.hien = goc.conSoHien;
});

afterEach(() => {
  Object.assign(trienKhai, structuredClone(goc.trienKhai));
  gioiThieu.khaoSatDauVao = structuredClone(goc.khaoSat);
  gioiThieu.conSo.hien = goc.conSoHien;
});

/** Chờ trang render xong (AuthContext tải xong) — neo vào tiêu đề khối viSao, có ở mọi chế độ. */
async function choTrang() {
  await screen.findByRole('heading', { name: gioiThieu.viSao.tieuDe });
}

const tenTheoCheDo = (cheDo: 'khao_sat' | 'dang_nhap') =>
  gioiThieu.loTrinh.buoc.filter((b) => b.cheDo === cheDo).map((b) => b.ten);
const hoiTheoCheDo = (cheDo: 'khao_sat' | 'dang_nhap') =>
  gioiThieu.hoiDap.cau.filter((c) => c.cheDo === cheDo).map((c) => c.hoi);

describe('M0 — Trang giới thiệu: nội dung chung', () => {
  it('không hiển thị tên tỉnh "An Giang" (trang dùng chung nhiều tỉnh)', async () => {
    const { container } = renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(container.textContent).not.toContain('An Giang');
  });

  it('không render conSo khi hien:false', async () => {
    gioiThieu.conSo.hien = false;
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(screen.queryByText(gioiThieu.conSo.muc[0].nhan)).not.toBeInTheDocument();
  });

  it('render conSo khi bật hien:true (xác nhận đúng theo cờ, không bị ẩn cứng)', async () => {
    gioiThieu.conSo.hien = true;
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(screen.getByText(gioiThieu.conSo.muc[0].nhan)).toBeInTheDocument();
  });

  // Tiêu đề mục cũng xuất hiện ở menu điều hướng (header) khi mục đó hien — dùng role "heading" để
  // phân biệt với link menu cùng tên, tránh lỗi "tìm thấy nhiều phần tử".
  it('render viSao/doiTuong/noiDung mặc định (nội dung thật theo 3 mức)', async () => {
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(screen.getByText(gioiThieu.viSao.doanMo)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.doiTuong.tieuDe })).toBeInTheDocument();
    expect(screen.getByText(gioiThieu.doiTuong.nhom[0])).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.noiDung.tieuDe })).toBeInTheDocument();

    const thanhThao = gioiThieu.noiDung.danhSachMuc.find((m) => m.ma === 'thanh_thao')!;
    expect(screen.getAllByText(`Mức ${thanhThao.ten}`).length).toBeGreaterThan(0);
    expect(screen.getByText(thanhThao.chuyenDe[0].ten)).toBeInTheDocument();
    expect(screen.getByText(thanhThao.doiTuongPhuHop)).toBeInTheDocument();
  });

  it('chuyển tab hiện đúng chuyên đề và đối tượng phù hợp của từng mức', async () => {
    const user = userEvent.setup();
    renderTrang(<TrangGioiThieu />);
    await choTrang();

    const coBan = gioiThieu.noiDung.danhSachMuc.find((m) => m.ma === 'co_ban')!;
    const nangCao = gioiThieu.noiDung.danhSachMuc.find((m) => m.ma === 'nang_cao')!;
    expect(screen.queryByText(coBan.doiTuongPhuHop)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Cơ bản' }));
    expect(await screen.findByText(coBan.doiTuongPhuHop)).toBeInTheDocument();
    expect(screen.getByText(coBan.chuyenDe[0].ten)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Nâng cao' }));
    expect(await screen.findByText(nangCao.doiTuongPhuHop)).toBeInTheDocument();
  });

  it('render khối hợp tác và liên hệ', async () => {
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(screen.getByRole('heading', { name: gioiThieu.hopTac.tieuDe })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: gioiThieu.lienHe.tieuDe })).toBeInTheDocument();
  });
});

describe('M0 — chế độ "khao_sat" (giai đoạn 1: chưa mở đăng nhập học viên)', () => {
  beforeEach(() => {
    trienKhai.cheDoHocVien = 'khao_sat';
  });

  it('nút chính và nút header trỏ tới khối khảo sát, không mời đăng nhập', async () => {
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    const nutChinh = screen.getAllByRole('link', { name: gioiThieu.moDau.nutKhaoSat });
    expect(nutChinh.length).toBeGreaterThan(0);
    nutChinh.forEach((n) => expect(n).toHaveAttribute('href', '#khao-sat'));
    expect(screen.queryByRole('link', { name: gioiThieu.moDau.nutChinh })).not.toBeInTheDocument();
  });

  it('hiện 2 phiếu theo đúng thứ tự: kĩ năng số trước, năng lực số sau', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });
    const tieuDePhieu = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(tieuDePhieu).toEqual([
      'Phiếu 1: Phiếu khảo sát kĩ năng số',
      'Phiếu 2: Phiếu đánh giá năng lực số',
    ]);
  });

  it('đường dẫn còn "[CHỜ]" -> nút bị khóa, không có link hỏng', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });
    const nhan = gioiThieu.khaoSatDauVao.phieu[0].lienKet[0].nhan;
    expect(screen.getByRole('button', { name: new RegExp(nhan) })).toBeDisabled();
    expect(screen.queryByRole('link', { name: nhan })).not.toBeInTheDocument();
  });

  it('đường dẫn thật -> mở tab mới; tách theo đối tượng -> mỗi đối tượng 1 nút', async () => {
    gioiThieu.khaoSatDauVao.phieu[0].lienKet = [{ nhan: 'Mở phiếu khảo sát', url: 'https://forms.example/ks' }];
    gioiThieu.khaoSatDauVao.phieu[1].lienKet = [
      { nhan: 'Dành cho giáo viên', url: 'https://forms.example/gv' },
      { nhan: 'Dành cho cán bộ quản lý', url: 'https://forms.example/cbql' },
    ];
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });

    const ks = screen.getByRole('link', { name: 'Mở phiếu khảo sát' });
    expect(ks).toHaveAttribute('href', 'https://forms.example/ks');
    expect(ks).toHaveAttribute('target', '_blank');
    expect(ks).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: 'Dành cho giáo viên' })).toHaveAttribute('href', 'https://forms.example/gv');
    expect(screen.getByRole('link', { name: 'Dành cho cán bộ quản lý' })).toHaveAttribute(
      'href',
      'https://forms.example/cbql',
    );
  });

  it('hiện ghi chú "sau khi hoàn thành khảo sát" (chỉ xem, điều chỉnh ở đợt cuối)', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });
    gioiThieu.khaoSatDauVao.sauKhaoSat.forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());
  });

  it('ẩn hướng dẫn đăng nhập + FAQ về mật khẩu; hiện FAQ + lộ trình khảo sát', async () => {
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(screen.queryByRole('heading', { name: gioiThieu.huongDan.tieuDe })).not.toBeInTheDocument();
    hoiTheoCheDo('dang_nhap').forEach((h) => expect(screen.queryByText(h)).not.toBeInTheDocument());
    hoiTheoCheDo('khao_sat').forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
    tenTheoCheDo('dang_nhap').forEach((t) => expect(screen.queryByText(t)).not.toBeInTheDocument());
    tenTheoCheDo('khao_sat').forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    // Bước chung (không gắn cheDo) vẫn hiện.
    const cuoi = gioiThieu.loTrinh.buoc[gioiThieu.loTrinh.buoc.length - 1];
    expect(screen.getByText(cuoi.ten)).toBeInTheDocument();
  });

  it('menu có mục "Khảo sát" trỏ tới #khao-sat', async () => {
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Khảo sát' })).toHaveAttribute('href', '#khao-sat');
  });
});

describe('M0 — chế độ "dang_nhap" (đã mở cổng học viên / địa phương bổ sung thông tin trên hệ thống)', () => {
  beforeEach(() => {
    trienKhai.cheDoHocVien = 'dang_nhap';
  });

  it('nút chính dẫn tới /dang-nhap', async () => {
    renderTrang(<TrangGioiThieu />);
    const nut = await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(nut).toHaveAttribute('href', '/dang-nhap');
  });

  it('hiện hướng dẫn đăng nhập + FAQ đăng nhập; ẩn FAQ + bước lộ trình của chế độ khảo sát', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.huongDan.tieuDe });
    expect(screen.getByText(gioiThieu.huongDan.buoc[0].ten)).toBeInTheDocument();
    hoiTheoCheDo('dang_nhap').forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
    hoiTheoCheDo('khao_sat').forEach((h) => expect(screen.queryByText(h)).not.toBeInTheDocument());
    tenTheoCheDo('khao_sat').forEach((t) => expect(screen.queryByText(t)).not.toBeInTheDocument());
  });

  it('tắt khối khảo sát (hien:false) -> không render khối và không có mục menu', async () => {
    gioiThieu.khaoSatDauVao.hien = false;
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(screen.queryByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Khảo sát' })).not.toBeInTheDocument();
  });

  it('khảo sát vẫn có thể bật song song (vd khảo sát bổ sung) mà nút chính vẫn là đăng nhập', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });
    expect(screen.getByRole('link', { name: gioiThieu.moDau.nutChinh })).toHaveAttribute('href', '/dang-nhap');
  });
});
