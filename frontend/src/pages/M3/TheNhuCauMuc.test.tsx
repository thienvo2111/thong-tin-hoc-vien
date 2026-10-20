import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { nhuCauMucToiKey } from '@/api/nhuCauMuc';
import { db, taoNhuCauMucMau } from '@/test/mocks/db';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { dinhDangNgayGio } from '@/lib/ngay';
import { TheNhuCauMuc } from './TheNhuCauMuc';

function render() {
  datToken('token-gia-lap');
  return renderVoiRouter([{ path: '/toi', element: <TheNhuCauMuc /> }], { initialEntries: ['/toi'] });
}

describe('TheNhuCauMuc — thẻ nhu cầu mức học ở /toi (ADR 0013)', () => {
  it('đợt chưa chọn: tên đợt, hạn chót, "Chưa chọn", link tới trang chọn', async () => {
    const nc = taoNhuCauMucMau();
    db.nhuCauMuc = [nc];
    render();
    expect(await screen.findByText(nc.dot.ten_dot)).toBeInTheDocument();
    expect(screen.getByText(`Hạn chót: ${dinhDangNgayGio(nc.dot.dong_luc)}`)).toBeInTheDocument();
    expect(screen.getByText('Chưa chọn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chọn nhu cầu' })).toHaveAttribute(
      'href',
      `/toi/nhu-cau-muc?dot=${nc.dot.id}`,
    );
  });

  it('đã chọn: hiện "Đã chọn: Cơ bản"', async () => {
    db.nhuCauMuc = [
      taoNhuCauMucMau({
        lua_chon: {
          muc_chon: 'co_ban',
          muc_moc: 'thanh_thao',
          nguon_moc: 'lop',
          chon_luc: '2026-10-05T01:00:00.000Z',
          cap_nhat_luc: '2026-10-05T01:00:00.000Z',
        },
      }),
    ];
    render();
    expect(await screen.findByText('Đã chọn: Cơ bản')).toBeInTheDocument();
    expect(screen.queryByText('Chưa chọn')).not.toBeInTheDocument();
  });

  it('mảng rỗng: không render gì', async () => {
    db.nhuCauMuc = [];
    const { queryClient } = render();
    await waitFor(() => expect(queryClient.getQueryData(nhuCauMucToiKey)).toEqual([]));
    expect(screen.queryByTestId('the-nhu-cau-muc')).not.toBeInTheDocument();
  });

  it('2 đợt: 2 thẻ', async () => {
    db.nhuCauMuc = [
      taoNhuCauMucMau(),
      taoNhuCauMucMau({ dot: { ...taoNhuCauMucMau().dot, id: '22222222-2222-4222-8222-222222222222', ten_dot: 'Đợt 2' } }),
    ];
    render();
    expect(await screen.findAllByTestId('the-nhu-cau-muc')).toHaveLength(2);
  });
});
