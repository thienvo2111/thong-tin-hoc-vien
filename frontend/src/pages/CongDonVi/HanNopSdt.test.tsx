import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { db } from '@/test/mocks/db';
import { danhSachMau, dbTruongDanhSach, theDotMau } from '@/test/mocks/truongDanhSach';
import { routesCongDonVi } from '@/router';

// Issue #66: khi content Cổng đơn vị có SĐT hỗ trợ thật (ở đây là SỐ BỊA của test), thông điệp hết hạn kèm SĐT.
vi.mock('react-router-dom', async (goc) => ({
  ...(await goc<typeof import('react-router-dom')>()),
  createBrowserRouter: vi.fn(),
}));
vi.mock('@/content/congDonVi', async (goc) => {
  const that = await goc<typeof import('@/content/congDonVi')>();
  return { congDonVi: { ...that.congDonVi, soDienThoaiHoTro: '0900 000 000' } };
});

beforeEach(() => vi.stubEnv('VITE_CONG_DON_VI_HOSTNAME', window.location.hostname));
afterEach(() => vi.unstubAllEnvs());

const HET_HAN = { han_hieu_luc: '2026-12-02T16:59:59.000Z', han_hieu_luc_ngay: '2026-12-02', da_het_han: true };

function moTrang(duongDan: string) {
  db.nguoiDung.vai_tro = 'truong';
  datToken('token-gia-lap');
  renderVoiRouter(routesCongDonVi, { initialEntries: [duongDan] });
}

describe('Hết hạn — có SĐT hỗ trợ', () => {
  it('trang chủ: "Đã hết hạn ngày dd/mm – liên hệ HCMUE (SĐT)"', async () => {
    dbTruongDanhSach.the = [theDotMau(HET_HAN)];
    moTrang('/trang-chu');
    const the = await screen.findByRole('article', { name: 'HSG Đợt Bịa 2026' });
    expect(within(the).getByText('Đã hết hạn ngày 02/12 – liên hệ HCMUE (0900 000 000)')).toBeInTheDocument();
  });

  it('màn danh sách: banner kèm SĐT', async () => {
    dbTruongDanhSach.danhSach['dot-hsg-1'] = danhSachMau(HET_HAN);
    moTrang('/dot/dot-hsg-1/danh-sach');
    expect(
      await screen.findByText('Đã hết hạn ngày 02/12/2026 — chỉ xem. Liên hệ HCMUE (0900 000 000) để được gia hạn.'),
    ).toBeInTheDocument();
  });
});
