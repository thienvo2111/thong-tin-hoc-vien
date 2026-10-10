import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import AdminKhoaChiTiet from './AdminKhoaChiTiet';

// ADR 0005 Z7 (issue #26): Quản trị mở bảng điểm danh của 1 lớp từ chi tiết khóa.
describe('Admin — điểm danh lớp', () => {
  it('nút "Điểm danh" ở dòng lớp mở bảng điểm danh có ô sửa được', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'quan_tri';
    const user = userEvent.setup();
    renderVoiRouter([{ path: '/admin/khoa-boi-duong/:id', element: <AdminKhoaChiTiet /> }], {
      initialEntries: ['/admin/khoa-boi-duong/khoa-1'],
    });
    const dong = (await screen.findByText('Lớp 01 – Nhóm cơ bản A')).closest('tr') as HTMLElement;
    await user.click(within(dong).getByRole('button', { name: 'Điểm danh' }));
    const modal = await screen.findByRole('dialog', { name: /Điểm danh — Lớp 01/ });
    expect(await within(modal).findByText('Trần Thị Học')).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Sửa điểm danh Trần Thị Học buổi 1' })).toBeInTheDocument();
  });

  it('vai trò không phải Quản trị → không có nút "Điểm danh"', async () => {
    datToken('token-gia-lap');
    db.nguoiDung.vai_tro = 'truong';
    renderVoiRouter([{ path: '/admin/khoa-boi-duong/:id', element: <AdminKhoaChiTiet /> }], {
      initialEntries: ['/admin/khoa-boi-duong/khoa-1'],
    });
    await screen.findByText('Lớp 01 – Nhóm cơ bản A');
    expect(screen.queryByRole('button', { name: 'Điểm danh' })).not.toBeInTheDocument();
  });
});
