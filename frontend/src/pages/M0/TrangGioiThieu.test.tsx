import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { datCauHinhKhaoSatMock, datCauHinhKhoaMock } from '@/test/mocks/cauHinhKhaoSat';
import { renderTrang } from '@/test/testUtils';
import TrangGioiThieu from './TrangGioiThieu';
import { gioiThieu } from '@/content/gioiThieu';
import { cauHinhMacDinh } from '@/content/trienKhai';
import type { CauHinhKhaoSat } from '@/api/cauHinhKhaoSat';

const conSoHienGoc = gioiThieu.conSo.hien;
afterEach(() => {
  gioiThieu.conSo.hien = conSoHienGoc;
});

/** Cấu hình quản trị đã lưu (GET /cau-hinh-khao-sat) — mặc định chế độ khảo sát, 2 phiếu có link thật. */
function cauHinh(sua: Partial<CauHinhKhaoSat> = {}): CauHinhKhaoSat {
  return {
    che_do_hoc_vien: 'khao_sat',
    danh_gia_dau_vao_trong_cong: false,
    hien_khao_sat: true,
    phieu: [
      { ten: 'Phiếu khảo sát kĩ năng số', mo_ta: 'Mô tả 1', lien_ket: [{ nhan: 'Mở phiếu khảo sát', url: 'https://forms.example/ks' }] },
      {
        ten: 'Phiếu đánh giá năng lực số',
        mo_ta: 'Mô tả 2',
        lien_ket: [
          { nhan: 'Dành cho giáo viên', url: 'https://forms.example/gv' },
          { nhan: 'Dành cho cán bộ quản lý', url: '' },
        ],
      },
    ],
    ...sua,
  };
}

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

  it('có lối vào trang Hướng dẫn sử dụng (M9): mục menu + liên kết chân trang, luôn hiện', async () => {
    renderTrang(<TrangGioiThieu />);
    await choTrang();
    const header = screen.getByRole('banner');
    const footer = screen.getByRole('contentinfo');
    expect(within(header).getByRole('link', { name: gioiThieu.huongDanSuDung.nhanMenu })).toHaveAttribute('href', '/huong-dan');
    expect(within(footer).getByRole('link', { name: gioiThieu.huongDanSuDung.lienKetChanTrang })).toHaveAttribute(
      'href',
      '/huong-dan',
    );
  });
});

describe('M0 — quản trị chưa lưu cấu hình / API lỗi -> dùng mặc định', () => {
  it('chưa lưu (cau_hinh null): chế độ khảo sát, phiếu mặc định chưa có link -> nút bị khóa', async () => {
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });
    const nhan = cauHinhMacDinh.phieu[0].lienKet[0].nhan;
    expect(screen.getByRole('button', { name: nhan })).toBeDisabled();
    expect(screen.getAllByText('Đường dẫn đang được cập nhật').length).toBe(cauHinhMacDinh.phieu.length);
    expect(screen.queryByRole('link', { name: nhan })).not.toBeInTheDocument();
  });

  it('API lỗi -> trang vẫn hiển thị theo mặc định, không vỡ', async () => {
    server.use(http.get('/cau-hinh-khao-sat', () => HttpResponse.json({}, { status: 500 })));
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe });
    expect(screen.getAllByRole('link', { name: gioiThieu.moDau.nutKhaoSat }).length).toBeGreaterThan(0);
  });
});

describe('M0 — chế độ "khao_sat" (giai đoạn 1: chưa mở đăng nhập học viên)', () => {
  it('nút chính và nút header trỏ tới khối khảo sát, không mời đăng nhập', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    const nutChinh = screen.getAllByRole('link', { name: gioiThieu.moDau.nutKhaoSat });
    expect(nutChinh.length).toBeGreaterThan(0);
    nutChinh.forEach((n) => expect(n).toHaveAttribute('href', '#khao-sat'));
    expect(screen.queryByRole('link', { name: gioiThieu.moDau.nutChinh })).not.toBeInTheDocument();
  });

  it('hiện các phiếu theo đúng thứ tự cấu hình', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    const tieuDePhieu = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(tieuDePhieu).toEqual(['Phiếu 1: Phiếu khảo sát kĩ năng số', 'Phiếu 2: Phiếu đánh giá năng lực số']);
  });

  it('đổi thứ tự phiếu trong cấu hình -> trang đổi theo', async () => {
    const c = cauHinh();
    datCauHinhKhaoSatMock({ ...c, phieu: [...c.phieu].reverse() });
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    const tieuDePhieu = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(tieuDePhieu[0]).toBe('Phiếu 1: Phiếu đánh giá năng lực số');
  });

  it('link thật mở tab mới; tách theo đối tượng -> mỗi đối tượng 1 nút; url rỗng -> nút khóa', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    const ks = await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    expect(ks).toHaveAttribute('href', 'https://forms.example/ks');
    expect(ks).toHaveAttribute('target', '_blank');
    expect(ks).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: 'Dành cho giáo viên' })).toHaveAttribute('href', 'https://forms.example/gv');
    expect(screen.getByRole('button', { name: 'Dành cho cán bộ quản lý' })).toBeDisabled();
  });

  it('hiện ghi chú "sau khi hoàn thành khảo sát"', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    gioiThieu.khaoSatDauVao.sauKhaoSat.forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());
  });

  it('ẩn hướng dẫn đăng nhập + FAQ về mật khẩu; hiện FAQ + lộ trình khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    expect(screen.queryByRole('heading', { name: gioiThieu.huongDan.tieuDe })).not.toBeInTheDocument();
    hoiTheoCheDo('dang_nhap').forEach((h) => expect(screen.queryByText(h)).not.toBeInTheDocument());
    hoiTheoCheDo('khao_sat').forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
    tenTheoCheDo('dang_nhap').forEach((t) => expect(screen.queryByText(t)).not.toBeInTheDocument());
    tenTheoCheDo('khao_sat').forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    const cuoi = gioiThieu.loTrinh.buoc[gioiThieu.loTrinh.buoc.length - 1];
    expect(screen.getByText(cuoi.ten)).toBeInTheDocument();
  });

  it('menu có mục "Khảo sát" trỏ tới #khao-sat', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Khảo sát' })).toHaveAttribute('href', '#khao-sat');
  });
});

describe('M0 — chế độ "dang_nhap" (đã mở cổng học viên / địa phương bổ sung thông tin trên hệ thống)', () => {
  it('nút chính dẫn tới /dang-nhap', async () => {
    datCauHinhKhaoSatMock(cauHinh({ che_do_hoc_vien: 'dang_nhap' }));
    renderTrang(<TrangGioiThieu />);
    const nut = await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(nut).toHaveAttribute('href', '/dang-nhap');
  });

  it('hiện hướng dẫn đăng nhập + FAQ đăng nhập; ẩn FAQ + bước lộ trình của chế độ khảo sát', async () => {
    datCauHinhKhaoSatMock(cauHinh({ che_do_hoc_vien: 'dang_nhap' }));
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.huongDan.tieuDe });
    expect(screen.getByText(gioiThieu.huongDan.buoc[0].ten)).toBeInTheDocument();
    hoiTheoCheDo('dang_nhap').forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
    hoiTheoCheDo('khao_sat').forEach((h) => expect(screen.queryByText(h)).not.toBeInTheDocument());
    tenTheoCheDo('khao_sat').forEach((t) => expect(screen.queryByText(t)).not.toBeInTheDocument());
  });

  it('có nút "Xem hướng dẫn chi tiết từng bước" dưới khối 4 bước, trỏ /huong-dan', async () => {
    datCauHinhKhaoSatMock(cauHinh({ che_do_hoc_vien: 'dang_nhap' }));
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('heading', { name: gioiThieu.huongDan.tieuDe });
    expect(screen.getByRole('link', { name: gioiThieu.huongDanSuDung.nutChiTiet })).toHaveAttribute('href', '/huong-dan');
  });

  it('tắt khối khảo sát -> không render khối và không có mục menu', async () => {
    datCauHinhKhaoSatMock(cauHinh({ che_do_hoc_vien: 'dang_nhap', hien_khao_sat: false }));
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh });
    expect(screen.queryByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Khảo sát' })).not.toBeInTheDocument();
  });

  it('khảo sát vẫn bật song song được mà nút chính vẫn là đăng nhập', async () => {
    datCauHinhKhaoSatMock(cauHinh({ che_do_hoc_vien: 'dang_nhap' }));
    renderTrang(<TrangGioiThieu />);
    expect(await screen.findByRole('link', { name: gioiThieu.moDau.nutChinh })).toHaveAttribute('href', '/dang-nhap');
    expect(screen.getByRole('heading', { name: gioiThieu.khaoSatDauVao.tieuDe })).toBeInTheDocument();
  });
});

describe('M0 — tách biệt giữa các khối nội dung', () => {
  /** Nền của các khối xen kẽ theo thứ tự hiển thị (bỏ qua khối khảo sát / liên hệ có màu riêng). */
  function nenCacKhoi(container: HTMLElement) {
    return [...container.querySelectorAll<HTMLElement>('section[id]')].map((s) => ({
      id: s.id,
      nen: s.style.background || s.style.backgroundColor,
    }));
  }

  it.each(['khao_sat', 'dang_nhap'] as const)(
    'chế độ "%s": không có 2 khối liền kề trùng nền, mỗi khối có đường kẻ mép trên',
    async (cheDo) => {
      datCauHinhKhaoSatMock(cauHinh({ che_do_hoc_vien: cheDo }));
      const { container } = renderTrang(<TrangGioiThieu />);
      // Chờ cấu hình áp dụng: chế độ đăng nhập có khối "Hướng dẫn", chế độ khảo sát thì không.
      if (cheDo === 'dang_nhap') await screen.findByRole('heading', { name: gioiThieu.huongDan.tieuDe });
      else await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });

      const khoi = nenCacKhoi(container);
      expect(khoi.length).toBeGreaterThanOrEqual(5);
      for (let i = 1; i < khoi.length; i++) {
        expect(khoi[i].nen, `${khoi[i - 1].id} và ${khoi[i].id} trùng nền`).not.toBe(khoi[i - 1].nen);
      }
      container
        .querySelectorAll<HTMLElement>('section[id]')
        .forEach((s) => expect(s.style.borderTop).toContain('1px solid'));
    },
  );
});

describe('M0 — hiệu ứng hiện dần & nhấn tiêu đề', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('trình duyệt KHÔNG có IntersectionObserver -> không phần tử nào bị ẩn chờ hiệu ứng', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    // jsdom vốn không có IntersectionObserver; xóa hẳn khỏi window để `in` trả false.
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
    const { container } = renderTrang(<TrangGioiThieu />);
    await choTrang();
    expect(container.querySelectorAll('.gt-cho-hien')).toHaveLength(0);
  });

  it('có IntersectionObserver -> phần tử chờ hiện, cuộn tới (isIntersecting) thì hiện', async () => {
    const quanSat: { cb: IntersectionObserverCallback; el: Element[] }[] = [];
    class GiaLapIO {
      private muc: { cb: IntersectionObserverCallback; el: Element[] };
      constructor(cb: IntersectionObserverCallback) {
        this.muc = { cb, el: [] };
        quanSat.push(this.muc);
      }
      observe(el: Element) {
        this.muc.el.push(el);
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', GiaLapIO);
    const { container } = renderTrang(<TrangGioiThieu />);
    await choTrang();

    const choHien = container.querySelectorAll('.gt-cho-hien');
    expect(choHien.length).toBeGreaterThan(5);
    expect(container.querySelectorAll('.gt-da-hien')).toHaveLength(0);

    act(() => {
      for (const q of quanSat) {
        q.cb(q.el.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry), {} as IntersectionObserver);
      }
    });
    expect(container.querySelectorAll('.gt-cho-hien:not(.gt-da-hien)')).toHaveLength(0);
  });

  it('tiêu đề mỗi khối nội dung có gạch nhấn (ẩn với trình đọc màn hình)', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    const { container } = renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    for (const tieuDe of [gioiThieu.khaoSatDauVao.tieuDe, gioiThieu.loTrinh.tieuDe, gioiThieu.hoiDap.tieuDe]) {
      const h = screen.getByRole('heading', { level: 2, name: tieuDe });
      const gach = h.parentElement?.querySelector('.gt-gach');
      expect(gach, tieuDe).not.toBeNull();
      expect(gach).toHaveAttribute('aria-hidden', 'true');
    }
    expect(container.querySelectorAll('.gt-the').length).toBeGreaterThan(5);
  });
});

describe('M0 — chọn tỉnh/thành (cấu hình khảo sát theo khóa, 2026-10-02)', () => {
  const phieuRieng = (ten: string) => [{ ten, mo_ta: '', lien_ket: [{ nhan: 'Mở phiếu riêng', url: 'https://forms.example/rieng' }] }];

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    try {
      localStorage.removeItem('gt_tinh');
    } catch {
      // bỏ qua
    }
  });

  function coKhoaRieng() {
    datCauHinhKhaoSatMock(cauHinh());
    datCauHinhKhoaMock({
      khoa_id: 'k-1',
      ma_khoa: 'K-1',
      ten_khoa: 'Khóa tỉnh thử',
      tinh: { tinh_id: 't-thu', ten_tinh: 'Tỉnh Thử' },
      cau_hinh: { ...cauHinh(), phieu: phieuRieng('Phiếu riêng của tỉnh') },
    });
  }

  it('chưa tỉnh nào có cấu hình riêng -> không hiện ô chọn tỉnh', async () => {
    datCauHinhKhaoSatMock(cauHinh());
    renderTrang(<TrangGioiThieu />);
    await screen.findByRole('link', { name: 'Mở phiếu khảo sát' });
    expect(screen.queryByLabelText(/công tác tại tỉnh\/thành nào/)).not.toBeInTheDocument();
  });

  it('chọn tỉnh -> hiện phiếu của khóa gắn tỉnh đó, link cập nhật ?tinh=; bỏ chọn -> về cấu hình chung', async () => {
    coKhoaRieng();
    const user = userEvent.setup();
    renderTrang(<TrangGioiThieu />);
    const o = await screen.findByLabelText(/công tác tại tỉnh\/thành nào/);
    expect(await screen.findByText('Phiếu 1: Phiếu khảo sát kĩ năng số')).toBeInTheDocument();

    await user.selectOptions(o, 't-thu');
    expect(await screen.findByText('Phiếu 1: Phiếu riêng của tỉnh')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('tinh')).toBe('t-thu');

    await user.selectOptions(o, '');
    expect(await screen.findByText('Phiếu 1: Phiếu khảo sát kĩ năng số')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('mở link có ?tinh= -> chọn sẵn tỉnh, hiện đúng phiếu của tỉnh', async () => {
    coKhoaRieng();
    window.history.replaceState(null, '', '/?tinh=t-thu');
    renderTrang(<TrangGioiThieu />);
    expect(await screen.findByText('Phiếu 1: Phiếu riêng của tỉnh')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/công tác tại tỉnh\/thành nào/)).toHaveValue('t-thu'));
  });
});
