import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderTrang } from '@/test/testUtils';
import { CanhBaoZoomThieuLink } from './CanhBaoZoomThieuLink';

// ADR 0005 §9 (issue #28).
describe('CanhBaoZoomThieuLink', () => {
  it('N > 0 -> hiện cảnh báo vàng kèm số buổi', () => {
    renderTrang(<CanhBaoZoomThieuLink soBuoi={3} />);
    expect(screen.getByText('3 buổi Zoom sắp diễn ra chưa có link')).toBeInTheDocument();
  });

  it.each([0, undefined])('soBuoi = %s (hoặc vai trò không phải quan_tri) -> không hiện gì', (soBuoi) => {
    renderTrang(<CanhBaoZoomThieuLink soBuoi={soBuoi} />);
    expect(screen.queryByText(/buổi Zoom sắp diễn ra chưa có link/)).not.toBeInTheDocument();
  });
});
