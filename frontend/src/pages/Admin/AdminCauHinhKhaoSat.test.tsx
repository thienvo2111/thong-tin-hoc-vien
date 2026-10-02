import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { datCauHinhKhaoSatMock, layCauHinhKhaoSatMock } from '@/test/mocks/cauHinhKhaoSat';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { cauHinhMacDinh } from '@/content/trienKhai';
import type { CauHinhKhaoSat } from '@/api/cauHinhKhaoSat';
import AdminCauHinhKhaoSat from './AdminCauHinhKhaoSat';

function renderTrang() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/cau-hinh-khao-sat', element: <AdminCauHinhKhaoSat /> }], {
    initialEntries: ['/admin/cau-hinh-khao-sat'],
  });
}

const DA_LUU: CauHinhKhaoSat = {
  che_do_hoc_vien: 'khao_sat',
  danh_gia_dau_vao_trong_cong: false,
  hien_khao_sat: true,
  phieu: [
    { ten: 'Phiếu A', mo_ta: 'Mô tả A', lien_ket: [{ nhan: 'Mở A', url: 'https://forms.example/a' }] },
    { ten: 'Phiếu B', mo_ta: '', lien_ket: [{ nhan: 'Mở B', url: '' }] },
  ],
};

const banDaLuu = () => layCauHinhKhaoSatMock().cau_hinh;

describe('Admin — Cấu hình khảo sát', () => {
  it('chưa lưu lần nào -> báo đang dùng mặc định, form điền sẵn phiếu mặc định', async () => {
    renderTrang();
    expect(await screen.findByText('Chưa lưu cấu hình')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Tên phiếu').map((el) => (el as HTMLInputElement).value)).toEqual(
      cauHinhMacDinh.phieu.map((p) => p.ten),
    );
    expect(screen.getByRole('radio', { name: 'Khảo sát (chưa mở đăng nhập)' })).toBeChecked();
  });

  it('đã lưu -> hiện đúng dữ liệu + thời điểm cập nhật', async () => {
    datCauHinhKhaoSatMock(DA_LUU);
    renderTrang();
    expect(await screen.findByText(/Cập nhật lần cuối/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Phiếu A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://forms.example/a')).toBeInTheDocument();
    expect(screen.queryByText('Chưa lưu cấu hình')).not.toBeInTheDocument();
  });

  it('nhập đường dẫn rồi lưu -> PUT đúng dữ liệu (trim) + thông báo thành công', async () => {
    const user = userEvent.setup();
    renderTrang();
    const oUrl = (await screen.findAllByLabelText('Đường dẫn 1'))[0];
    await user.type(oUrl, '  https://forms.gle/ks1  ');
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(await screen.findByText('Đã lưu cấu hình khảo sát')).toBeInTheDocument();
    expect(banDaLuu()?.phieu[0].lien_ket[0].url).toBe('https://forms.gle/ks1');
    expect(banDaLuu()?.phieu.map((p) => p.ten)).toEqual(cauHinhMacDinh.phieu.map((p) => p.ten));
  });

  it('đường dẫn không phải http(s) -> báo lỗi tại ô, không gửi PUT', async () => {
    const user = userEvent.setup();
    renderTrang();
    const oUrl = (await screen.findAllByLabelText('Đường dẫn 1'))[0];
    await user.type(oUrl, 'forms.gle/abc');
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    expect(await screen.findByText('Đường dẫn phải bắt đầu bằng http:// hoặc https://')).toBeInTheDocument();
    expect(banDaLuu()).toBeNull();
  });

  it('tên phiếu trống -> báo lỗi, không gửi PUT', async () => {
    const user = userEvent.setup();
    renderTrang();
    const oTen = (await screen.findAllByLabelText('Tên phiếu'))[0];
    await user.clear(oTen);
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    expect(await screen.findByText('Nhập tên phiếu')).toBeInTheDocument();
    expect(banDaLuu()).toBeNull();
  });

  it('tách theo đối tượng: thêm đường dẫn thứ 2 cho 1 phiếu -> lưu đủ 2 đường dẫn', async () => {
    datCauHinhKhaoSatMock(DA_LUU);
    const user = userEvent.setup();
    renderTrang();
    await screen.findByDisplayValue('Phiếu A');
    await user.click(screen.getAllByRole('button', { name: '+ Thêm đường dẫn' })[0]);
    await user.type(screen.getByLabelText('Nhãn nút 2'), 'Dành cho cán bộ quản lý');
    await user.type(screen.getByLabelText('Đường dẫn 2'), 'https://forms.example/cbql');
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    await waitFor(() => expect(banDaLuu()?.phieu[0].lien_ket).toHaveLength(2));
    expect(banDaLuu()?.phieu[0].lien_ket).toEqual([
      { nhan: 'Mở A', url: 'https://forms.example/a' },
      { nhan: 'Dành cho cán bộ quản lý', url: 'https://forms.example/cbql' },
    ]);
  });

  it('đổi thứ tự, thêm và xóa phiếu -> PUT phản ánh đúng thứ tự mới', async () => {
    datCauHinhKhaoSatMock(DA_LUU);
    const user = userEvent.setup();
    renderTrang();
    await screen.findByDisplayValue('Phiếu A');

    await user.click(screen.getByRole('button', { name: 'Đưa phiếu 2 lên trước' }));
    await user.click(screen.getByRole('button', { name: '+ Thêm phiếu' }));
    await user.type(screen.getAllByLabelText('Tên phiếu')[2], 'Phiếu C');
    await user.click(screen.getByRole('button', { name: 'Xóa phiếu 2' }));
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    await waitFor(() => expect(banDaLuu()?.phieu.map((p) => p.ten)).toEqual(['Phiếu B', 'Phiếu C']));
  });

  it('nút lên/xuống bị khóa ở phiếu đầu/cuối', async () => {
    datCauHinhKhaoSatMock(DA_LUU);
    renderTrang();
    await screen.findByDisplayValue('Phiếu A');
    expect(screen.getByRole('button', { name: 'Đưa phiếu 1 lên trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa phiếu 2 xuống sau' })).toBeDisabled();
  });

  it('chế độ khảo sát mà tắt khối khảo sát -> báo lỗi, không gửi PUT', async () => {
    const user = userEvent.setup();
    renderTrang();
    await user.click(await screen.findByRole('switch', { name: 'Hiện khối khảo sát trên trang chủ' }));
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    expect(await screen.findByText('Phải bật khi chế độ là Khảo sát')).toBeInTheDocument();
    expect(banDaLuu()).toBeNull();
  });

  it('chuyển sang "Đăng nhập cổng học viên" + bật Đánh giá đầu vào + tắt khảo sát -> lưu được', async () => {
    datCauHinhKhaoSatMock(DA_LUU);
    const user = userEvent.setup();
    renderTrang();
    await screen.findByDisplayValue('Phiếu A');
    await user.click(screen.getByRole('radio', { name: 'Đăng nhập cổng học viên' }));
    await user.click(screen.getByRole('switch', { name: /Đánh giá đầu vào/ }));
    await user.click(screen.getByRole('switch', { name: 'Hiện khối khảo sát trên trang chủ' }));
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));

    await waitFor(() =>
      expect(banDaLuu()).toMatchObject({
        che_do_hoc_vien: 'dang_nhap',
        danh_gia_dau_vao_trong_cong: true,
        hien_khao_sat: false,
      }),
    );
  });

  it('backend trả VALIDATION_ERROR có fields -> hiện lỗi đúng ô', async () => {
    server.use(
      http.put('/cau-hinh-khao-sat', () =>
        loi(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', {
          fields: [{ field: 'phieu.0.lien_ket.0.url', message: 'Lỗi URL từ máy chủ' }],
        }),
      ),
    );
    datCauHinhKhaoSatMock(DA_LUU);
    const user = userEvent.setup();
    renderTrang();
    await screen.findByDisplayValue('Phiếu A');
    await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
    expect(await screen.findByText('Lỗi URL từ máy chủ')).toBeInTheDocument();
  });

  it('lỗi tải cấu hình -> hiện thông báo lỗi', async () => {
    server.use(http.get('/cau-hinh-khao-sat', () => loi(500, 'INTERNAL', 'Máy chủ lỗi')));
    renderTrang();
    expect(await screen.findByText('Máy chủ lỗi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Thêm phiếu' })).not.toBeInTheDocument();
  });
});
