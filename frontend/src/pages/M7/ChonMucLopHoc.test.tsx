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

const NHAN_GOC: Record<MucNangLuc, string> = {
  co_ban: 'M2 – Cơ bản',
  thanh_thao: 'M3 – Thành thạo',
  nang_cao: 'M4 – Nâng cao',
};

// ADR 0006: 3 nguồn mức — heThong (bài khảo sát quy đổi), chon (nhu cầu), chot (muc_dau_vao).
function datDangKy({
  heThong = null,
  chot = null,
  chon = null,
  luc = null,
  mo = true,
  nhanGoc,
}: {
  heThong?: MucNangLuc | null;
  chot?: MucNangLuc | null;
  chon?: MucNangLuc | null;
  luc?: string | null;
  mo?: boolean;
  nhanGoc?: string;
}) {
  const dk = db.khoaHocToi[0];
  dk.muc_he_thong = heThong;
  dk.nhan_muc_goc_danh_gia = heThong ? (nhanGoc ?? NHAN_GOC[heThong]) : null;
  dk.muc_goc_danh_gia = dk.nhan_muc_goc_danh_gia?.slice(0, 2) ?? null;
  dk.muc_dau_vao = chot;
  dk.muc_danh_gia = chot ?? heThong;
  dk.nguon_muc_danh_gia = chot ? 'chot' : heThong ? 'khao_sat' : null;
  dk.muc_hoc_chon = chon;
  dk.muc_hoc_chon_luc = luc;
  dk.khoa.mo_dieu_chinh_muc = mo;
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
// Dòng của 1 nguồn mức trong khối "cac-nguon-muc-hoc".
const dongNguon = async (nhan: string) =>
  within(await screen.findByTestId('cac-nguon-muc-hoc')).getByText((noiDung) => noiDung.startsWith(nhan));

describe('M7 — 3 nguồn mức đầu vào (ADR 0006)', () => {
  it('chưa chốt, chưa chọn: hệ thống M4, nhu cầu "Học theo kết quả đánh giá", chính thức "Chưa chốt"', async () => {
    datDangKy({ heThong: 'nang_cao' });
    renderDaDangNhap();
    expect(await dongNguon('Kết quả hệ thống:')).toHaveTextContent('Kết quả hệ thống: M4 – Nâng cao');
    expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Nhu cầu đã chọn: Học theo kết quả đánh giá');
    expect(await dongNguon('Mức chính thức')).toHaveTextContent('Mức chính thức (xếp lớp): Chưa chốt');
    expect(nutDieuChinh()).toBeInTheDocument();
  });

  it('đã chốt: hiện đủ 3 giá trị khác nhau, ẩn nút điều chỉnh, ghi "Mức đã được chốt"', async () => {
    datDangKy({ heThong: 'nang_cao', chon: 'thanh_thao', chot: 'co_ban' });
    renderDaDangNhap();
    expect(await dongNguon('Kết quả hệ thống:')).toHaveTextContent('M4 – Nâng cao');
    expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Nhu cầu đã chọn: Thành thạo');
    expect(await dongNguon('Mức chính thức')).toHaveTextContent('Mức chính thức (xếp lớp): Cơ bản');
    expect(screen.getByText('Mức đã được chốt')).toBeInTheDocument();
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('đã chốt nhưng chưa có bài hệ thống: kết quả hệ thống "Chưa có kết quả", nhu cầu "Chưa chọn"', async () => {
    datDangKy({ chot: 'thanh_thao' });
    renderDaDangNhap();
    expect(await dongNguon('Kết quả hệ thống:')).toHaveTextContent('Chưa có kết quả');
    expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Chưa chọn');
    expect(await dongNguon('Mức chính thức')).toHaveTextContent('Thành thạo');
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('khảo sát M1: giữ nhãn "M1 – Chưa đạt" kèm quy đổi Cơ bản, không có nút (mốc cơ bản)', async () => {
    datDangKy({ heThong: 'co_ban', nhanGoc: 'M1 – Chưa đạt' });
    datTinhTrangBai({ loai: 'danh-gia', trang_thai: 'hoan_thanh', muc_goc: 'M1', nhan_muc_goc: 'M1 – Chưa đạt' });
    renderDaDangNhap();
    expect(await dongNguon('Kết quả hệ thống:')).toHaveTextContent('M1 – Chưa đạt (quy đổi: Cơ bản)');
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });

  it('chưa có nguồn nào: vẫn hiện 3 dòng mặc định, không có nút', async () => {
    datDangKy({});
    renderDaDangNhap();
    await screen.findAllByTestId('the-giai-doan');
    expect(await dongNguon('Kết quả hệ thống:')).toHaveTextContent('Chưa có kết quả');
    expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Chưa chọn');
    expect(await dongNguon('Mức chính thức')).toHaveTextContent('Chưa chốt');
    expect(nutDieuChinh()).not.toBeInTheDocument();
  });
});

describe('M7 — Điều chỉnh nhu cầu mức lớp học (trước khi chốt)', () => {
  it('khóa đóng: chỉ hiện các mức, không có nút', async () => {
    datDangKy({ heThong: 'nang_cao', chon: 'thanh_thao', mo: false });
    renderDaDangNhap();
    expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Thành thạo');
    expect(nutDieuChinh()).not.toBeInTheDocument();
    expect(screen.queryByText('Mức đã được chốt')).not.toBeInTheDocument();
  });

  it('chỉ liệt kê mốc hệ thống và thấp hơn 1 mức, mức bằng ghi "(theo kết quả đánh giá)"', async () => {
    datDangKy({ heThong: 'thanh_thao' });
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    expect(screen.getAllByRole('radio').map((r) => r.closest('.mantine-Radio-root')?.textContent)).toEqual([
      'Cơ bản',
      'Thành thạo (theo kết quả đánh giá)',
    ]);
    expect(screen.getByRole('radio', { name: 'Thành thạo (theo kết quả đánh giá)' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: /Nâng cao/ })).not.toBeInTheDocument();
    expect(screen.getByText(/xếp theo mức chính thức do Ban tổ chức chốt/)).toBeInTheDocument();
  });

  it('mốc nâng cao: chỉ có Thành thạo và Nâng cao', async () => {
    datDangKy({ heThong: 'nang_cao' });
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    expect(screen.getAllByRole('radio').map((r) => r.closest('.mantine-Radio-root')?.textContent)).toEqual([
      'Thành thạo',
      'Nâng cao (theo kết quả đánh giá)',
    ]);
  });

  it('lựa chọn cũ Cơ bản dưới mốc Nâng cao: nhu cầu vẫn hiện Cơ bản, mở chọn thì chọn sẵn mốc', async () => {
    datDangKy({ heThong: 'nang_cao', chon: 'co_ban' });
    renderDaDangNhap();
    expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Cơ bản');
    await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh mức lớp' }));
    expect(screen.queryByRole('radio', { name: 'Cơ bản' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Nâng cao (theo kết quả đánh giá)' })).toBeChecked();
  });

  it('lựa chọn cũ Cơ bản: lưu mốc -> quay về theo kết quả đánh giá (lưu NULL)', async () => {
    datDangKy({ heThong: 'nang_cao', chon: 'co_ban' });
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đã lưu nhu cầu mức lớp học/)).toBeInTheDocument();
    expect(db.khoaHocToi[0].muc_hoc_chon).toBeNull();
  });

  it('lưu thành công: hỏi xác nhận, gửi mức đã chọn, cập nhật dòng nhu cầu; mức chính thức vẫn "Chưa chốt"', async () => {
    datDangKy({ heThong: 'thanh_thao' });
    let body: unknown;
    server.use(
      http.put('/hoc-vien/toi/khoa-hoc/:khoaId/muc-hoc', async ({ request }) => {
        body = await request.json();
        db.khoaHocToi[0].muc_hoc_chon = 'co_ban';
        return HttpResponse.json({ muc_dau_vao: null, muc_hoc_chon: 'co_ban', muc_hoc: null });
      }),
    );
    renderDaDangNhap();
    await chonVaLuu('Cơ bản');

    // Bấm Lưu chỉ mở hộp xác nhận, chưa gọi API.
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    expect(within(hop).getByText(/chuyển từ mức/)).toHaveTextContent(
      'Thầy/Cô xác nhận chuyển từ mức Thành thạo sang mức Cơ bản? Lớp học được xếp theo mức chính thức do Ban tổ chức chốt.',
    );
    expect(body).toBeUndefined();

    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đã lưu nhu cầu mức lớp học/)).toBeInTheDocument();
    expect(body).toEqual({ muc: 'co_ban' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' })).not.toBeInTheDocument(),
    );
    await waitFor(async () => expect(await dongNguon('Nhu cầu đã chọn:')).toHaveTextContent('Nhu cầu đã chọn: Cơ bản'));
    expect(await dongNguon('Mức chính thức')).toHaveTextContent('Chưa chốt');
  });

  it('lỗi 403 DIEU_CHINH_MUC_DONG: hiện "Đã hết thời gian điều chỉnh mức lớp học"', async () => {
    datDangKy({ heThong: 'nang_cao' });
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
    datDangKy({ heThong: 'nang_cao' });
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

  it('chọn đúng nhu cầu hiện tại rồi Lưu: không hỏi xác nhận, không gọi API, đóng khu chọn', async () => {
    datDangKy({ heThong: 'nang_cao', chon: 'thanh_thao' });
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
    datDangKy({ heThong: 'nang_cao', chon: 'thanh_thao', luc: '2026-10-08T03:05:00.000Z' });
    renderDaDangNhap();
    expect(await screen.findByText('Đã điều chỉnh lúc 08/10/2026 10:05')).toBeInTheDocument();
  });

  it('chưa điều chỉnh: không hiện dòng thời điểm', async () => {
    datDangKy({ heThong: 'nang_cao' });
    renderDaDangNhap();
    await screen.findByTestId('cac-nguon-muc-hoc');
    expect(screen.queryByText(/Đã điều chỉnh lúc/)).not.toBeInTheDocument();
  });

  it('xác nhận qua handler mặc định: nhu cầu được ghi, dòng thời điểm xuất hiện', async () => {
    datDangKy({ heThong: 'nang_cao' });
    renderDaDangNhap();
    await chonVaLuu('Thành thạo');
    const hop = await screen.findByRole('dialog', { name: 'Xác nhận điều chỉnh mức lớp học' });
    await userEvent.click(within(hop).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đã điều chỉnh lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeInTheDocument();
    expect(db.khoaHocToi[0].muc_hoc_chon).toBe('thanh_thao');
  });

  it('bấm Hủy: đóng khu chọn, không gọi API', async () => {
    datDangKy({ heThong: 'nang_cao' });
    renderDaDangNhap();
    await userEvent.click(await screen.findByRole('button', { name: 'Điều chỉnh mức lớp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(nutDieuChinh()).toBeInTheDocument();
  });
});
