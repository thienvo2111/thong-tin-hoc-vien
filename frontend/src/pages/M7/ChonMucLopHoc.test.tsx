import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { db } from '@/test/mocks/db';
import { datTinhTrangBai } from '@/test/mocks/sso';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import type { MucNangLuc } from '@/api/types';
import ThongTinLopHoc from './ThongTinLopHoc';

const routes = [{ path: '/toi/lop-hoc', element: <ThongTinLopHoc /> }];

function datDangKy(
  muc_dau_vao: MucNangLuc | null,
  mo_dieu_chinh_muc: boolean,
  muc_hoc_chon: MucNangLuc | null = null,
  muc_hoc_chon_luc: string | null = null,
) {
  const dk = db.khoaHocToi[0];
  dk.muc_dau_vao = muc_dau_vao;
  dk.muc_danh_gia = muc_dau_vao;
  dk.nguon_muc_danh_gia = muc_dau_vao ? 'chot' : null;
  dk.muc_hoc_chon = muc_hoc_chon;
  dk.muc_hoc_chon_luc = muc_hoc_chon_luc;
  dk.khoa.mo_dieu_chinh_muc = mo_dieu_chinh_muc;
}

// Đếm số lần gọi PUT điều chỉnh mức (vẫn chuyển tiếp cho handler mặc định xử lý).
const goBoNghe: (() => void)[] = [];
afterEach(() => goBoNghe.splice(0).forEach((go) => go()));

function demGoiApi() {
  const dem = { soLan: 0 };
  const nghe = ({ request }: { request: Request }) => {
    if (request.method === 'PUT' && request.url.includes('/muc-hoc')) dem.soLan += 1;
  };
  server.events.on('request:start', nghe);
  goBoNghe.push(() => server.events.removeListener('request:start', nghe));
  return dem;
}

async function chonVaLuu(nhanMuc: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
  await userEvent.click(screen.getByRole('radio', { name: nhanMuc }));
  await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
}

function renderDaDangNhap() {
  datToken('token-gia-lap');
  return renderVoiRouter(routes, { initialEntries: ['/toi/lop-hoc'] });
}

const nutDieuChinh = () => screen.queryByRole('button', { name: 'Điều chỉnh mức lớp' });

// Điều chỉnh mức lớp học (2026-10-08) — khối "Kết quả đánh giá" ở M7.
describe('M7 — Điều chỉnh mức lớp học', () => {
  it('khóa mở + đánh giá nâng cao: hiện mức lớp học và nút điều chỉnh', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    expect(await screen.findByText('Nâng cao', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/Mức lớp học:/)).toBeInTheDocument();
    expect(nutDieuChinh()).toBeInTheDocument();
  });

  it('khóa đóng: chỉ hiện dòng mức, không có nút', async () => {
    datDangKy('nang_cao', false, 'thanh_thao');
    renderDaDangNhap();
    expect(await screen.findByText(/đã điều chỉnh từ Nâng cao/)).toBeInTheDocument();
    expect(screen.getByText('Thành thạo', { selector: 'b' })).toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('đánh giá cơ bản: không có mức thấp hơn -> ẩn nút', async () => {
    datDangKy('co_ban', true);
    renderDaDangNhap();
    expect(await screen.findByText(/Mức lớp học:/)).toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('chưa có kết quả đánh giá: không hiện dòng mức lớp học', async () => {
    datDangKy(null, true);
    renderDaDangNhap();
    await screen.findAllByTestId('the-giai-doan');
    expect(screen.queryByText(/Mức lớp học:/)).not.toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('chỉ liệt kê các mức ≤ mức đánh giá, mức bằng ghi "(theo kết quả đánh giá)"', async () => {
    datDangKy('thanh_thao', true);
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.closest('.mantine-Radio-root')?.textContent)).toEqual([
      'Cơ bản',
      'Thành thạo (theo kết quả đánh giá)',
    ]);
    expect(screen.getByRole('radio', { name: 'Thành thạo (theo kết quả đánh giá)' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Nâng cao/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/chỉ có thể chọn học ở mức bằng kết quả đánh giá hoặc thấp hơn 1 mức/),
    ).toBeInTheDocument();
  });

  // 2026-10-09: chỉ được thấp hơn ĐÚNG 1 mức.
  it('đánh giá nâng cao: chỉ có Thành thạo và Nâng cao, không có Cơ bản', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    expect(screen.getAllByRole('radio').map((r) => r.closest('.mantine-Radio-root')?.textContent)).toEqual([
      'Thành thạo',
      'Nâng cao (theo kết quả đánh giá)',
    ]);
    expect(screen.queryByRole('radio', { name: 'Cơ bản' })).not.toBeInTheDocument();
  });

  it('lựa chọn cũ Cơ bản dưới mốc Nâng cao: vẫn hiện là mức hiện tại, mở chọn thì chọn sẵn mốc', async () => {
    datDangKy('nang_cao', true, 'co_ban');
    renderDaDangNhap();
    expect(await screen.findByText('Cơ bản', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByText(/đã điều chỉnh từ Nâng cao/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh mức lớp' }));
    expect(screen.queryByRole('radio', { name: 'Cơ bản' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Nâng cao (theo kết quả đánh giá)' })).toBeChecked();
  });

  it('lựa chọn cũ Cơ bản: lưu mốc -> quay về Nâng cao (lưu NULL)', async () => {
    datDangKy('nang_cao', true, 'co_ban');
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đã lưu mức lớp học/)).toBeInTheDocument();
    expect(db.khoaHocToi[0].muc_hoc_chon).toBeNull();
  });

  it('lưu thành công: gửi mức đã chọn, báo thành công, cập nhật dòng mức', async () => {
    datDangKy('thanh_thao', true);
    let body: unknown;
    server.use(
      http.put('/hoc-vien/toi/khoa-hoc/:khoaId/muc-hoc', async ({ request }) => {
        body = await request.json();
        db.khoaHocToi[0].muc_hoc_chon = 'co_ban';
        return HttpResponse.json({ muc_dau_vao: 'thanh_thao', muc_hoc_chon: 'co_ban', muc_hoc: 'co_ban' });
      }),
    );
    renderDaDangNhap();
    await chonVaLuu('Cơ bản');

    // Bấm Lưu chỉ mở hộp xác nhận, chưa gọi API.
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    expect(within(hop).getByText(/chuyển từ mức/)).toHaveTextContent(
      'Thầy/Cô xác nhận chuyển từ mức Thành thạo sang mức Cơ bản? Lớp học sẽ được xếp theo mức đã chọn.',
    );
    expect(body).toBeUndefined();

    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đã lưu mức lớp học/)).toBeInTheDocument();
    expect(body).toEqual({ muc: 'co_ban' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByText(/đã điều chỉnh từ Thành thạo/)).toBeInTheDocument());
    expect(screen.getByText('Cơ bản', { selector: 'b' })).toBeInTheDocument();
  });

  it('lỗi 403 DIEU_CHINH_MUC_DONG: hiện "Đã hết thời gian điều chỉnh mức lớp học"', async () => {
    datDangKy('nang_cao', true);
    server.use(
      http.put('/hoc-vien/toi/khoa-hoc/:khoaId/muc-hoc', () =>
        HttpResponse.json(
          { error: { code: 'DIEU_CHINH_MUC_DONG', message: 'Khóa học chưa mở điều chỉnh mức lớp học' } },
          { status: 403 },
        ),
      ),
    );
    renderDaDangNhap();
    await chonVaLuu('Thành thạo');
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    // Lỗi hiện ngay trong hộp xác nhận.
    expect(await within(hop).findByText('Đã hết thời gian điều chỉnh mức lớp học')).toBeInTheDocument();
  });

  it('bấm Quay lại trong hộp xác nhận: không gọi API, giữ khu chọn', async () => {
    datDangKy('nang_cao', true);
    const dem = demGoiApi();
    renderDaDangNhap();
    await chonVaLuu('Thành thạo');
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    await userEvent.click(within(hop).getByRole('button', { name: 'Quay lại' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' })).not.toBeInTheDocument(),
    );
    expect(dem.soLan).toBe(0);
    expect(screen.getByRole('radio', { name: 'Thành thạo' })).toBeChecked();
    expect(db.khoaHocToi[0].muc_hoc_chon).toBeNull();
  });

  it('chọn đúng mức đang học rồi Lưu: không hỏi xác nhận, không gọi API, đóng khu chọn', async () => {
    datDangKy('nang_cao', true, 'thanh_thao');
    const dem = demGoiApi();
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    expect(screen.getByRole('radio', { name: 'Thành thạo' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(nutDieuChinh()).toBeInTheDocument();
    expect(dem.soLan).toBe(0);
  });

  it('đã điều chỉnh: hiện thời điểm điều chỉnh theo giờ Việt Nam', async () => {
    datDangKy('nang_cao', true, 'thanh_thao', '2026-10-08T03:05:00.000Z');
    renderDaDangNhap();
    expect(await screen.findByText('Đã điều chỉnh lúc 08/10/2026 10:05')).toBeInTheDocument();
  });

  it('chưa điều chỉnh: không hiện dòng thời điểm', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    await screen.findByText(/Mức lớp học:/);
    expect(screen.queryByText(/Đã điều chỉnh lúc/)).not.toBeInTheDocument();
  });

  it('xác nhận qua handler mặc định: dòng thời điểm xuất hiện sau khi lưu', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    await chonVaLuu('Thành thạo');
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đã điều chỉnh lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeInTheDocument();
    expect(db.khoaHocToi[0].muc_hoc_chon).toBe('thanh_thao');
  });

  // 2026-10-09: quản trị chưa chốt muc_dau_vao, mốc lấy từ bài khảo sát đầu vào (M4 -> nâng cao).
  describe('mốc theo khảo sát (chưa chốt)', () => {
    const NHAN_GOC: Record<MucNangLuc, [string, string]> = {
      co_ban: ['M2', 'M2 – Cơ bản'],
      thanh_thao: ['M3', 'M3 – Thành thạo'],
      nang_cao: ['M4', 'M4 – Nâng cao'],
    };
    function datKhaoSat(muc_danh_gia: MucNangLuc, goc = NHAN_GOC[muc_danh_gia]) {
      datDangKy(null, true);
      const dk = db.khoaHocToi[0];
      dk.muc_danh_gia = muc_danh_gia;
      dk.nguon_muc_danh_gia = 'khao_sat';
      [dk.muc_goc_danh_gia, dk.nhan_muc_goc_danh_gia] = goc;
    }

    it('khảo sát M1: badge giữ "M1 – Chưa đạt", dòng lớp "Cơ bản" kèm ghi chú xếp lớp, không có nút', async () => {
      datKhaoSat('co_ban', ['M1', 'M1 – Chưa đạt']);
      datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'hoan_thanh', muc_goc: 'M1', nhan_muc_goc: 'M1 – Chưa đạt' });
      renderDaDangNhap();
      expect(await screen.findByText(/Đầu vào: M1 – Chưa đạt/)).toBeInTheDocument();
      expect(screen.queryByText(/Đầu vào: Cơ bản/)).not.toBeInTheDocument();
      expect(screen.getByText('Cơ bản', { selector: 'b' })).toBeInTheDocument();
      expect(screen.getByText(/xếp lớp Cơ bản theo kết quả M1 – Chưa đạt/)).toBeInTheDocument();
      expect(nutDieuChinh()).not.toBeInTheDocument();
    });

    it('khảo sát M2: nhãn trùng tên mức lớp -> không có ghi chú xếp lớp', async () => {
      datKhaoSat('co_ban');
      renderDaDangNhap();
      expect(await screen.findByText('Cơ bản', { selector: 'b' })).toBeInTheDocument();
      expect(screen.queryByText(/xếp lớp/)).not.toBeInTheDocument();
    });

    it('chỉ có kết quả khảo sát M4: hiện mức lớp học + nút điều chỉnh', async () => {
      datKhaoSat('nang_cao');
      renderDaDangNhap();
      expect(await screen.findByText('Nâng cao', { selector: 'b' })).toBeInTheDocument();
      expect(nutDieuChinh()).toBeInTheDocument();
    });

    it('các mức chọn giới hạn theo mốc khảo sát', async () => {
      datKhaoSat('thanh_thao');
      renderDaDangNhap();
      await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
      expect(screen.getAllByRole('radio').map((r) => r.closest('.mantine-Radio-root')?.textContent)).toEqual([
        'Cơ bản',
        'Thành thạo (theo kết quả đánh giá)',
      ]);
    });

    it('lưu qua handler mặc định: mức thấp hơn mốc được ghi, dòng hiện "đã điều chỉnh từ"', async () => {
      datKhaoSat('nang_cao');
      renderDaDangNhap();
      await chonVaLuu('Thành thạo');
      const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
      await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
      expect(await screen.findByText(/đã điều chỉnh từ Nâng cao/)).toBeInTheDocument();
      expect(db.khoaHocToi[0].muc_hoc_chon).toBe('thanh_thao');
    });

    it('mốc khảo sát cơ bản: ẩn nút', async () => {
      datKhaoSat('co_ban');
      renderDaDangNhap();
      expect(await screen.findByText(/Mức lớp học:/)).toBeInTheDocument();
      expect(nutDieuChinh()).not.toBeInTheDocument();
    });
  });

  it('bấm Hủy: đóng khu chọn, không gọi API', async () => {
    datDangKy('nang_cao', true);
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(nutDieuChinh()).toBeInTheDocument();
  });
});
