import { beforeEach, describe, expect, it } from 'vitest';
import { notifications } from '@mantine/notifications';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { loi } from '@/test/mocks/handlers';
import { db } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import AdminHocVienChiTiet from './AdminHocVienChiTiet';

// Thêm 2026-09-30 (QĐ10, docs/api-contract.md mục 3) — phần "Khóa & lớp" mới thêm vào trang
// AdminHocVienChiTiet (placeholder tối thiểu, xem comment đầu file .tsx): sửa tay phân lớp theo
// giai đoạn (spec 2026-10-02) + cụm hỗ trợ Zalo cho từng khóa mà học viên (đã da_duyet) ghi danh — GET /hoc-vien/{id}/khoa-hoc,
// PUT /dang-ky-hoc/{id}/giai-doan/{gd}/lop, PATCH /dang-ky-hoc/{id}/cum (mock ở test/mocks/handlers.ts,
// dữ liệu mẫu ở test/mocks/db.ts#taoKhoaHocCuaHocVienMau + taoChiTietKhoaMau).
function renderTrang(id: string) {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/admin/hoc-vien/:id', element: <AdminHocVienChiTiet /> }], {
    initialEntries: [`/admin/hoc-vien/${id}`],
  });
}

describe('Admin — Chi tiết hồ sơ học viên — Khóa & lớp (QĐ10)', () => {
  it('hiện tên khóa đã ghi danh + 1 dòng phân lớp mỗi giai đoạn + dòng cụm hỗ trợ Zalo', async () => {
    renderTrang('hv-duyet-1');

    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    // getByRole('textbox', ...) thay vì getByLabelText: dropdown (role=listbox, ẩn/portal) của Select
    // cũng mang aria-labelledby trỏ tới đúng label này — getByLabelText khớp cả 2, gây lỗi "multiple
    // elements", trong khi getByRole('textbox') chỉ khớp đúng ô input (giống quy ước AdminKhoaBoiDuong.test.tsx).
    // Phân lớp theo giai đoạn (spec 2026-10-02): khoa-1 có 4 giai đoạn active.
    expect(await screen.findByRole('textbox', { name: 'GĐ1 · Đánh giá đầu vào' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: /^GĐ\d/ })).toHaveLength(4);
    expect(screen.getByRole('textbox', { name: 'Cụm hỗ trợ Zalo' })).toBeInTheDocument();
  });

  it('học viên chưa ghi danh khóa nào -> thông báo "Chưa ghi danh khóa nào."', async () => {
    renderTrang('hv-cho-1');
    expect(await screen.findByText('Chưa ghi danh khóa nào.')).toBeInTheDocument();
  });

  it('chọn lớp cho GĐ2 rồi bấm Lưu -> gọi PUT /dang-ky-hoc/{id}/giai-doan/{gd}/lop, hiện thông báo thành công', async () => {
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(await screen.findByRole('textbox', { name: 'GĐ2 · Học trực tiếp' }));
    await user.click(await screen.findByRole('option', { name: 'Lớp 01 – Nhóm cơ bản A (Trực tiếp)' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);

    expect(await screen.findByText('Đã lưu phân lớp')).toBeInTheDocument();
  });

  it('chọn cụm hỗ trợ Zalo rồi bấm Lưu -> gọi đúng API PATCH /dang-ky-hoc/{id}/cum, hiện thông báo thành công', async () => {
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    const dongCum = within(await screen.findByTestId('dong-cum'));
    await user.click(dongCum.getByRole('textbox', { name: 'Cụm hỗ trợ Zalo' }));
    await user.click(await screen.findByRole('option', { name: 'Cụm Long Xuyên' }));
    await user.click(dongCum.getByRole('button', { name: 'Lưu' }));

    expect(await screen.findByText('Đã lưu cụm')).toBeInTheDocument();
  });

  it('lỗi từ API khi lưu phân lớp -> hiện notification màu đỏ với thông điệp lỗi', async () => {
    server.use(http.put('/dang-ky-hoc/:id/giai-doan/:gdId/lop', () => HttpResponse.error()));
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    await user.click(await screen.findByRole('textbox', { name: 'GĐ2 · Học trực tiếp' }));
    await user.click(await screen.findByRole('option', { name: 'Lớp 01 – Nhóm cơ bản A (Trực tiếp)' }));
    await user.click(screen.getAllByRole('button', { name: 'Lưu' })[1]);

    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
  });
});

// 2026-10-08: mức lớp học hiệu lực + Quản trị sửa hộ (PATCH /dang-ky-hoc/{id}/muc-hoc).
describe('Admin — Chi tiết hồ sơ học viên — Mức lớp học', () => {
  function datMuc(muc_dau_vao: 'co_ban' | 'thanh_thao' | 'nang_cao' | null, muc_hoc_chon: 'co_ban' | 'thanh_thao' | null = null) {
    const dk = db.khoaHocCuaHocVien['hv-duyet-1'][0];
    dk.muc_dau_vao = muc_dau_vao;
    dk.muc_danh_gia = muc_dau_vao;
    dk.nguon_muc_danh_gia = muc_dau_vao ? 'chot' : null;
    dk.muc_hoc_chon = muc_hoc_chon;
  }

  // 2026-10-09: chưa chốt muc_dau_vao, mốc lấy từ bài khảo sát đầu vào.
  function datMucKhaoSat(muc_danh_gia: 'co_ban' | 'thanh_thao' | 'nang_cao') {
    const dk = db.khoaHocCuaHocVien['hv-duyet-1'][0];
    dk.muc_dau_vao = null;
    dk.muc_danh_gia = muc_danh_gia;
    dk.nguon_muc_danh_gia = 'khao_sat';
    dk.muc_goc_danh_gia = 'M3';
    dk.nhan_muc_goc_danh_gia = 'M3 – Thành thạo';
    dk.muc_hoc_chon = null;
  }

  it('mốc theo khảo sát chưa chốt -> "Kết quả: M3 – Thành thạo (khảo sát, chưa chốt) → xếp lớp", Select theo mốc', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMucKhaoSat('thanh_thao');
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText('Thành thạo', { selector: 'b' })).toBeInTheDocument();
    expect(dong.getByText(/Kết quả: M3 – Thành thạo \(khảo sát, chưa chốt\) → xếp lớp Thành thạo/)).toBeInTheDocument();
    await user.click(dong.getByRole('textbox', { name: 'Sửa mức lớp học' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['Cơ bản', 'Thành thạo (theo kết quả đánh giá)']),
    );
    expect(screen.queryByRole('option', { name: /Nâng cao/ })).not.toBeInTheDocument();
  });

  it('mốc đã chốt -> không có ghi chú khảo sát', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('thanh_thao');
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.queryByText(/khảo sát, chưa chốt/)).not.toBeInTheDocument();
  });

  it('khảo sát M1 -> giữ nhãn kết quả "M1 – Chưa đạt", xếp lớp Cơ bản', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMucKhaoSat('co_ban');
    const dk = db.khoaHocCuaHocVien['hv-duyet-1'][0];
    dk.muc_goc_danh_gia = 'M1';
    dk.nhan_muc_goc_danh_gia = 'M1 – Chưa đạt';
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText(/Kết quả: M1 – Chưa đạt \(khảo sát, chưa chốt\) → xếp lớp Cơ bản/)).toBeInTheDocument();
  });

  it('chưa có kết quả đánh giá -> chỉ hiện dòng thông báo, không có ô sửa', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc(null);
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Mức lớp học: chưa có kết quả đánh giá đầu vào')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Sửa mức lớp học' })).not.toBeInTheDocument();
  });

  it('đã tự điều chỉnh -> hiện mức hiệu lực kèm mức đánh giá gốc', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('nang_cao', 'thanh_thao');
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText('Thành thạo', { selector: 'b' })).toBeInTheDocument();
    expect(dong.getByText(/học viên tự điều chỉnh từ Nâng cao/)).toBeInTheDocument();
    expect(dong.queryByText(/Đã điều chỉnh lúc/)).not.toBeInTheDocument();
  });

  it('có thời điểm điều chỉnh -> hiện "Đã điều chỉnh lúc" theo giờ Việt Nam', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('nang_cao', 'thanh_thao');
    db.khoaHocCuaHocVien['hv-duyet-1'][0].muc_hoc_chon_luc = '2026-10-08T03:05:00.000Z';
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText('Đã điều chỉnh lúc 08/10/2026 10:05')).toBeInTheDocument();
  });

  it('quản trị: Select chỉ có các mức ≤ đánh giá; chọn + Lưu mức -> PATCH đúng body, báo thành công', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('thanh_thao');
    let body: unknown;
    server.use(
      http.patch('/dang-ky-hoc/:id/muc-hoc', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ muc_dau_vao: 'thanh_thao', muc_hoc_chon: 'co_ban', muc_hoc: 'co_ban' });
      }),
    );
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    await user.click(dong.getByRole('textbox', { name: 'Sửa mức lớp học' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['Cơ bản', 'Thành thạo (theo kết quả đánh giá)']),
    );
    expect(screen.queryByRole('option', { name: /Nâng cao/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Cơ bản' }));
    await user.click(dong.getByRole('button', { name: 'Lưu mức' }));
    expect(await screen.findByText('Đã lưu mức lớp học')).toBeInTheDocument();
    expect(body).toEqual({ muc: 'co_ban' });
  });

  // 2026-10-09: quản trị cũng chỉ được thấp hơn 1 mức.
  it('quản trị, mốc nâng cao: Select chỉ có Thành thạo + Nâng cao', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('nang_cao');
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    await user.click(dong.getByRole('textbox', { name: 'Sửa mức lớp học' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Thành thạo',
      'Nâng cao (theo kết quả đánh giá)',
    ]);
  });

  it('lựa chọn cũ Cơ bản dưới mốc Nâng cao: dòng mức vẫn hiện Cơ bản, Select chọn sẵn mốc', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    datMuc('nang_cao', 'co_ban');
    renderTrang('hv-duyet-1');
    const dong = within(await screen.findByTestId('dong-muc-hoc'));
    expect(dong.getByText('Cơ bản', { selector: 'b' })).toBeInTheDocument();
    expect(dong.getByText(/học viên tự điều chỉnh từ Nâng cao/)).toBeInTheDocument();
    expect(dong.getByRole('textbox', { name: 'Sửa mức lớp học' })).toHaveValue('Nâng cao (theo kết quả đánh giá)');
  });

  it('tài khoản đơn vị (trường) -> chỉ xem mức, không có ô sửa', async () => {
    db.nguoiDung.vai_tro = 'truong';
    datMuc('nang_cao');
    renderTrang('hv-duyet-1');
    expect(await screen.findByTestId('dong-muc-hoc')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Sửa mức lớp học' })).not.toBeInTheDocument();
  });
});

describe('Admin — Chi tiết hồ sơ học viên — Nhật ký hoạt động (2026-10-04)', () => {
  it('quản trị -> thấy mục Nhật ký hoạt động với dòng thời gian từ API', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Nhật ký hoạt động')).toBeInTheDocument();
    expect(await screen.findByText('Đăng nhập thất bại')).toBeInTheDocument();
    expect(screen.getByText('Được đặt lại mật khẩu')).toBeInTheDocument();
  });

  it('tài khoản đơn vị (trường) -> không hiện mục nhật ký, không gọi API', async () => {
    db.nguoiDung.vai_tro = 'truong';
    let daGoi = false;
    server.use(
      http.get('/hoc-vien/:id/nhat-ky', () => {
        daGoi = true;
        return HttpResponse.json(db.nhatKyHocVien);
      }),
    );
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.queryByText('Nhật ký hoạt động')).not.toBeInTheDocument();
    expect(daGoi).toBe(false);
  });

  it('API nhật ký lỗi -> báo lỗi trong mục, phần còn lại của trang vẫn dùng được', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    server.use(http.get('/hoc-vien/:id/nhat-ky', () => HttpResponse.error()));
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Nhật ký hoạt động')).toBeInTheDocument();
    expect(await screen.findByText('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')).toBeInTheDocument();
    expect(screen.getByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
  });
});

// Spec 2026-10-09 Q-E: Quản trị sửa mã định danh MOET (PATCH /hoc-vien/{id}/ma-dinh-danh-moet).
describe('Admin — Chi tiết hồ sơ học viên — Sửa mã MOET (2026-10-09)', () => {
  async function moModal() {
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await user.click(await screen.findByRole('button', { name: 'Sửa mã MOET' }));
    const modal = within(await screen.findByRole('dialog', { name: 'Sửa mã định danh MOET' }));
    const oMa = modal.getByRole('textbox', { name: /Mã định danh MOET mới/ });
    const oLyDo = modal.getByRole('textbox', { name: /Lý do/ });
    return { user, modal, oMa, oLyDo };
  }

  function batBody() {
    const bodies: unknown[] = [];
    server.use(
      http.patch('/hoc-vien/:id/ma-dinh-danh-moet', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: 'hv-duyet-1', ma_dinh_danh_moet: '09115131099', ten_dang_nhap: '09115131099', da_doi_ten_dang_nhap: true });
      }),
    );
    return bodies;
  }

  it('tài khoản đơn vị (trường) -> không có nút "Sửa mã MOET"', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('hv-duyet-1');
    expect(await screen.findByText('Bồi dưỡng NLS – Mức cơ bản')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa mã MOET' })).not.toBeInTheDocument();
  });

  it('mở modal -> điền sẵn mã hiện tại', async () => {
    const { oMa } = await moModal();
    expect(oMa).toHaveValue('9115131099');
  });

  it('thiếu lý do -> báo "Bắt buộc nhập lý do", không gọi API', async () => {
    const bodies = batBody();
    const { user, modal, oMa } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '09115131099');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));
    expect(await modal.findByText('Bắt buộc nhập lý do')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('mã có ký tự không phải số -> báo lỗi, không gọi API', async () => {
    const bodies = batBody();
    const { user, modal, oMa, oLyDo } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '0911513a099');
    await user.type(oLyDo, 'Sai mã');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));
    expect(await modal.findByText('Mã định danh MOET chỉ gồm chữ số')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('độ dài khác 11/12 -> chỉ cảnh báo, vẫn lưu được', async () => {
    const bodies = batBody();
    const { user, modal, oMa, oLyDo } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '12345678');
    expect(modal.getByText(/Mã có 8 chữ số — mã MOET thường có 11 hoặc 12 chữ số/)).toBeInTheDocument();
    await user.type(oLyDo, 'Mã đúng theo Sở');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));
    expect(await screen.findByText(/Đã sửa mã định danh MOET/)).toBeInTheDocument();
    expect(bodies).toEqual([{ ma_dinh_danh_moet: '12345678', ly_do: 'Mã đúng theo Sở' }]);
  });

  it('mã 11 hoặc 12 chữ số -> không cảnh báo độ dài', async () => {
    const { user, modal, oMa } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '091151310991');
    expect(modal.queryByText(/mã MOET thường có 11 hoặc 12 chữ số/)).not.toBeInTheDocument();
  });

  it('thành công -> gửi đúng body, báo đổi cả tên đăng nhập, đóng modal, tải lại hồ sơ', async () => {
    const bodies = batBody();
    let soLanTaiHoSo = 0;
    server.use(
      http.get('/hoc-vien/:id', ({ params }) => {
        soLanTaiHoSo += 1;
        const found = db.danhSachHocVien.find((h) => h.id === params.id);
        return HttpResponse.json({ ...found, chuyen_mon: [], don_vi_cong_tac_ten: 'THPT Long Xuyên' });
      }),
    );
    const { user, modal, oMa, oLyDo } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '09115131099');
    await user.type(oLyDo, '  Mất số 0 đầu  ');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));

    expect(await screen.findByText('Đã sửa mã định danh MOET, tên đăng nhập đổi theo mã mới')).toBeInTheDocument();
    expect(bodies).toEqual([{ ma_dinh_danh_moet: '09115131099', ly_do: 'Mất số 0 đầu' }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(soLanTaiHoSo).toBe(2));
  });

  it('409 đã vào hệ thống khảo sát -> hiện thông điệp server trong modal, modal vẫn mở', async () => {
    server.use(
      http.patch('/hoc-vien/:id/ma-dinh-danh-moet', () =>
        loi(409, 'CONFLICT', 'Học viên đã vào hệ thống khảo sát, không thể đổi mã định danh MOET.'),
      ),
    );
    const { user, modal, oMa, oLyDo } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '09115131099');
    await user.type(oLyDo, 'Mất số 0');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));

    expect(
      await modal.findByText('Học viên đã vào hệ thống khảo sát, không thể đổi mã định danh MOET.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('409 trùng học viên khác -> hiện đúng thông điệp server (không phải câu về CCCD)', async () => {
    server.use(
      http.patch('/hoc-vien/:id/ma-dinh-danh-moet', () =>
        loi(409, 'CONFLICT', 'Mã định danh MOET trùng với học viên khác (kể cả khác số 0 đầu)'),
      ),
    );
    const { user, modal, oMa, oLyDo } = await moModal();
    await user.clear(oMa);
    await user.type(oMa, '09115131099');
    await user.type(oLyDo, 'Mất số 0');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));

    expect(await modal.findByText('Mã định danh MOET trùng với học viên khác (kể cả khác số 0 đầu)')).toBeInTheDocument();
    expect(modal.queryByText(/CCCD/)).not.toBeInTheDocument();
  });

  it('400 VALIDATION_ERROR (mã trùng mã hiện tại) -> lỗi gắn vào ô mã', async () => {
    server.use(
      http.patch('/hoc-vien/:id/ma-dinh-danh-moet', () =>
        loi(400, 'VALIDATION_ERROR', 'Mã mới trùng mã hiện tại', {
          fields: [{ field: 'ma_dinh_danh_moet', message: 'Phải khác mã hiện tại' }],
        }),
      ),
    );
    const { user, modal, oLyDo } = await moModal();
    await user.type(oLyDo, 'Thử');
    await user.click(modal.getByRole('button', { name: 'Lưu mã mới' }));

    expect(await modal.findByText('Phải khác mã hiện tại')).toBeInTheDocument();
    expect(modal.getByText('Mã mới trùng mã hiện tại')).toBeInTheDocument();
  });
});

// POST /dang-ky-hoc — Quản trị ghi danh lẻ học viên đã duyệt vào khóa.
describe('Admin — Chi tiết hồ sơ học viên — Ghi danh vào khóa', () => {
  // Store notifications của Mantine là toàn cục — thông báo còn hạn từ test trước chiếm chỗ (giới hạn 5).
  beforeEach(() => notifications.clean());

  it('chọn khóa + cụm rồi bấm Ghi danh -> gửi hoc_vien_id/khoa_id/cum_id, hiện thông báo thành công', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get('/hoc-vien/:id/khoa-hoc', () => HttpResponse.json([])),
      http.post('/dang-ky-hoc', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'dk-moi' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');

    const khoi = within(await screen.findByTestId('ghi-danh-vao-khoa'));
    await user.click(khoi.getByRole('textbox', { name: 'Khóa bồi dưỡng' }));
    await user.click(await screen.findByRole('option', { name: 'Bồi dưỡng NLS – Mức cơ bản (AG-2026-014)' }));
    await user.click(khoi.getByRole('textbox', { name: 'Cụm hỗ trợ' }));
    await user.click(await screen.findByRole('option', { name: 'Cụm Long Xuyên' }));
    await user.click(khoi.getByRole('button', { name: 'Ghi danh' }));

    expect(await screen.findByText('Đã ghi danh vào khóa')).toBeInTheDocument();
    expect(body).toEqual({ hoc_vien_id: 'hv-duyet-1', khoa_id: 'khoa-1', cum_id: 'cum-1' });
  });

  it('không chọn cụm -> không gửi cum_id; khóa đã ghi danh không có trong danh sách chọn', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post('/dang-ky-hoc', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 'dk-moi' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');

    const khoi = within(await screen.findByTestId('ghi-danh-vao-khoa'));
    await user.click(khoi.getByRole('textbox', { name: 'Khóa bồi dưỡng' }));
    expect(screen.queryByRole('option', { name: /AG-2026-014/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Bồi dưỡng NLS – Mức thành thạo (AG-2026-015)' }));
    await user.click(khoi.getByRole('button', { name: 'Ghi danh' }));

    await waitFor(() => expect(body).toEqual({ hoc_vien_id: 'hv-duyet-1', khoa_id: 'khoa-2' }));
  });

  it('API trả 409 -> hiện thông điệp của server', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    server.use(
      http.get('/hoc-vien/:id/khoa-hoc', () => HttpResponse.json([])),
      http.post('/dang-ky-hoc', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Học viên đã được ghi danh vào khóa này' } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang('hv-duyet-1');
    const khoi = within(await screen.findByTestId('ghi-danh-vao-khoa'));
    await user.click(khoi.getByRole('textbox', { name: 'Khóa bồi dưỡng' }));
    await user.click(await screen.findByRole('option', { name: 'Bồi dưỡng NLS – Mức cơ bản (AG-2026-014)' }));
    await user.click(khoi.getByRole('button', { name: 'Ghi danh' }));

    expect(await screen.findByText('Học viên đã được ghi danh vào khóa này')).toBeInTheDocument();
  });

  it('hồ sơ chưa duyệt -> không hiện khối ghi danh', async () => {
    db.nguoiDung.vai_tro = 'quan_tri';
    renderTrang('hv-cho-1');
    expect(await screen.findByText('Chưa ghi danh khóa nào.')).toBeInTheDocument();
    await screen.findByText('Chờ duyệt');
    expect(screen.queryByTestId('ghi-danh-vao-khoa')).not.toBeInTheDocument();
  });

  it('không phải quản trị -> không hiện khối ghi danh', async () => {
    db.nguoiDung.vai_tro = 'truong';
    renderTrang('hv-duyet-1');
    await screen.findByText('Bồi dưỡng NLS – Mức cơ bản');
    expect(screen.queryByTestId('ghi-danh-vao-khoa')).not.toBeInTheDocument();
  });
});
