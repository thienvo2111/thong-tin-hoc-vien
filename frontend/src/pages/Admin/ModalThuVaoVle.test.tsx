import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { renderTrang } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { guiFormVle } from '@/lib/guiFormVle';
import { ModalThuVaoVle } from './ModalThuVaoVle';

vi.mock('@/lib/guiFormVle', () => ({ guiFormVle: vi.fn() }));

const ACTION = 'https://vlebdhvs.hcmue.edu.vn/users/external-login';

// POST /sso/vle/form-thu giả lập: ghi lại body + liệu tab đã mở TRƯỚC khi API trả về chưa.
function datApi(idCourse: number | null = 12) {
  const bodies: Record<string, unknown>[] = [];
  const tabDaMoKhiGoiApi: boolean[] = [];
  server.use(
    http.post('/sso/vle/form-thu', async ({ request }) => {
      tabDaMoKhiGoiApi.push(vi.mocked(window.open).mock.calls.length > 0);
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      const fields: Record<string, string> = {
        key: 'khoa-thu',
        email: (body.email as string | undefined) ?? '',
        username: (body.username as string | undefined) ?? '',
      };
      if (idCourse !== null) fields.id_course = String(idCourse);
      return HttpResponse.json({ action: ACTION, fields, id_course: idCourse });
    }),
  );
  return { bodies, tabDaMoKhiGoiApi };
}

describe('ModalThuVaoVle (Quản trị thử vào VLE)', () => {
  const cuaSo = { close: vi.fn() };
  let openSpy: { mockRestore: () => void };

  beforeEach(() => {
    datToken('token-gia-lap');
    vi.mocked(guiFormVle).mockClear();
    cuaSo.close.mockClear();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(cuaSo as unknown as Window);
  });

  afterEach(() => {
    // Chỉ khôi phục window.open — restoreAllMocks sẽ xóa luôn mock matchMedia của setup.ts.
    openSpy.mockRestore();
  });

  function moModal() {
    const onClose = vi.fn();
    renderTrang(<ModalThuVaoVle opened onClose={onClose} />);
    return { onClose, user: userEvent.setup() };
  }

  it('hiện ô nhập, chọn mức (mặc định Cơ bản) và ghi chú tab mới / nhật ký / khóa tắt', async () => {
    moModal();
    expect(await screen.findByLabelText('Username hoặc email VLE')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Cơ bản' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Thành thạo' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Nâng cao' })).not.toBeChecked();
    expect(screen.getByText(/Mở VLE ở tab mới/)).toBeInTheDocument();
    expect(screen.getByText(/không tính lượt vào của học viên/)).toBeInTheDocument();
    expect(screen.getByText(/Hoạt động cả khi khóa đang tắt nút/)).toBeInTheDocument();
  });

  it.each([
    ['ô trống', ''],
    ['chỉ khoảng trắng', '   '],
  ])('%s -> chặn gửi, báo lỗi, không mở tab, không gọi API', async (_ten, giaTri) => {
    const { bodies } = datApi();
    const { user } = moModal();
    const o = await screen.findByLabelText('Username hoặc email VLE');
    if (giaTri) await user.type(o, giaTri);
    await user.click(screen.getByRole('button', { name: 'Mở VLE' }));
    expect(await screen.findByText('Nhập username hoặc email VLE')).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    expect(bodies).toEqual([]);
    expect(guiFormVle).not.toHaveBeenCalled();
  });

  it('không có "@" -> gửi username + mức; mở tab trước khi gọi API; submit form vào tab "vle-thu"', async () => {
    const { bodies, tabDaMoKhiGoiApi } = datApi(12);
    const { user } = moModal();
    await user.type(await screen.findByLabelText('Username hoặc email VLE'), '  thu01  ');
    await user.click(screen.getByRole('button', { name: 'Mở VLE' }));

    expect(await screen.findByText('Đã gửi id_course 12')).toBeInTheDocument();
    expect(bodies).toEqual([{ username: 'thu01', muc: 'co_ban' }]);
    expect(window.open).toHaveBeenCalledWith('', 'vle-thu');
    expect(tabDaMoKhiGoiApi).toEqual([true]);
    expect(guiFormVle).toHaveBeenCalledWith(
      ACTION,
      { key: 'khoa-thu', email: '', username: 'thu01', id_course: '12' },
      'vle-thu',
    );
    expect(cuaSo.close).not.toHaveBeenCalled();
  });

  it('có "@" -> gửi như email (không gửi username)', async () => {
    const { bodies } = datApi(12);
    const { user } = moModal();
    await user.type(await screen.findByLabelText('Username hoặc email VLE'), 'thu.vle@hcmue.edu.vn');
    await user.click(screen.getByRole('button', { name: 'Mở VLE' }));
    await waitFor(() => expect(guiFormVle).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ email: 'thu.vle@hcmue.edu.vn', muc: 'co_ban' }]);
  });

  it('chọn mức Nâng cao -> gửi muc nang_cao; mức chưa có trong map -> báo không gửi id_course', async () => {
    const { bodies } = datApi(null);
    const { user } = moModal();
    await user.type(await screen.findByLabelText('Username hoặc email VLE'), 'thu01');
    await user.click(screen.getByRole('radio', { name: 'Nâng cao' }));
    await user.click(screen.getByRole('button', { name: 'Mở VLE' }));

    expect(
      await screen.findByText('Không gửi id_course — mức chưa có trong VLE_COURSE_MAP.'),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ username: 'thu01', muc: 'nang_cao' }]);
    expect(guiFormVle).toHaveBeenCalledWith(
      ACTION,
      { key: 'khoa-thu', email: '', username: 'thu01' },
      'vle-thu',
    );
  });

  it('lỗi API (503 chưa cấu hình) -> đóng tab đã mở, hiện banner lỗi, không submit form', async () => {
    server.use(
      http.post('/sso/vle/form-thu', () =>
        HttpResponse.json(
          { error: { code: 'VLE_CHUA_CAU_HINH', message: 'Chức năng vào học VLE chưa được cấu hình.' } },
          { status: 503 },
        ),
      ),
    );
    const { user } = moModal();
    await user.type(await screen.findByLabelText('Username hoặc email VLE'), 'thu01');
    await user.click(screen.getByRole('button', { name: 'Mở VLE' }));

    expect(await screen.findByText('Chức năng vào học VLE chưa được cấu hình.')).toBeInTheDocument();
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(cuaSo.close).toHaveBeenCalledTimes(1);
    expect(guiFormVle).not.toHaveBeenCalled();
    expect(screen.queryByText(/Đã gửi id_course/)).not.toBeInTheDocument();
  });

  it('lỗi API khi trình duyệt chặn tab (window.open trả null) -> vẫn hiện lỗi, không vỡ', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    server.use(
      http.post('/sso/vle/form-thu', () =>
        HttpResponse.json({ error: { code: 'FORBIDDEN', message: 'Không có quyền' } }, { status: 403 }),
      ),
    );
    const { user } = moModal();
    await user.type(await screen.findByLabelText('Username hoặc email VLE'), 'thu01');
    await user.click(screen.getByRole('button', { name: 'Mở VLE' }));
    expect(await screen.findByText('Không có quyền')).toBeInTheDocument();
    expect(guiFormVle).not.toHaveBeenCalled();
  });

  it('bấm "Đóng" -> gọi onClose', async () => {
    const { user, onClose } = moModal();
    await screen.findByLabelText('Username hoặc email VLE');
    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
