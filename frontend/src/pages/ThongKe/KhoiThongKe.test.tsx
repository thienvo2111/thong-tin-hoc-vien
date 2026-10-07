import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UseQueryResult } from '@tanstack/react-query';
import { renderTrang } from '@/test/testUtils';
import { ApiError } from '@/api/client';
import { KhoiThongKe, NgoaiPhamViContext } from './KhoiThongKe';

function gia(p: Partial<UseQueryResult<unknown>>): UseQueryResult<unknown> {
  return { isLoading: false, isError: false, error: null, refetch: vi.fn(), ...p } as UseQueryResult<unknown>;
}

describe('KhoiThongKe', () => {
  it('loading → skeleton', () => {
    renderTrang(
      <KhoiThongKe tieu_de="Khối A" query={gia({ isLoading: true })} rong={false}>
        <div>nội dung</div>
      </KhoiThongKe>,
    );
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0);
    expect(screen.queryByText('nội dung')).not.toBeInTheDocument();
    expect(screen.getByText('Khối A')).toBeInTheDocument();
  });

  it("lỗi → nút 'Thử lại' gọi refetch", async () => {
    const refetch = vi.fn();
    renderTrang(
      <KhoiThongKe
        tieu_de="Khối A"
        query={gia({ isError: true, error: new ApiError(500, { code: 'INTERNAL', message: 'Hỏng rồi' }), refetch })}
        rong={false}
      >
        <div>nội dung</div>
      </KhoiThongKe>,
    );
    expect(screen.getByText('Hỏng rồi')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('rong → thong_bao_rong', () => {
    renderTrang(
      <KhoiThongKe tieu_de="Khối A" query={gia({})} rong thong_bao_rong="Chọn một khóa để xem">
        <div>nội dung</div>
      </KhoiThongKe>,
    );
    expect(screen.getByText('Chọn một khóa để xem')).toBeInTheDocument();
    expect(screen.queryByText('nội dung')).not.toBeInTheDocument();
  });

  it('có dữ liệu → hiện children', () => {
    renderTrang(
      <KhoiThongKe tieu_de="Khối A" query={gia({})} rong={false}>
        <div>nội dung</div>
      </KhoiThongKe>,
    );
    expect(screen.getByText('nội dung')).toBeInTheDocument();
  });

  it('lỗi 403 → báo ngoài phạm vi qua context', () => {
    const onNgoai = vi.fn();
    renderTrang(
      <NgoaiPhamViContext.Provider value={onNgoai}>
        <KhoiThongKe
          tieu_de="Khối A"
          query={gia({ isError: true, error: new ApiError(403, { code: 'FORBIDDEN', message: 'Cấm' }) })}
          rong={false}
        >
          <div>nội dung</div>
        </KhoiThongKe>
      </NgoaiPhamViContext.Provider>,
    );
    expect(onNgoai).toHaveBeenCalled();
  });
});
