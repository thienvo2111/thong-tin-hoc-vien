import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderTrang } from '@/test/testUtils';
import { TextMarkup } from './TextMarkup';

function lienKet(so: number): string | undefined {
  return so === 6 ? '#ho-so' : undefined;
}

describe('TextMarkup — lienKetPhan', () => {
  it('không truyền lienKetPhan -> "Phần N" giữ nguyên là văn bản, không tạo liên kết', () => {
    renderTrang(<TextMarkup text="Xem Phần 6 để biết thêm." />);
    expect(screen.getByText('Xem Phần 6 để biết thêm.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('truyền lienKetPhan -> "Phần N" hợp lệ thành liên kết đúng href, giữ nguyên chữ', () => {
    renderTrang(<TextMarkup text="Xem Phần 6 để biết thêm." lienKetPhan={lienKet} />);
    const link = screen.getByRole('link', { name: 'Phần 6' });
    expect(link).toHaveAttribute('href', '#ho-so');
    expect(screen.getByText(/để biết thêm\./)).toBeInTheDocument();
  });

  it('"Phần N" không có phần tương ứng -> giữ nguyên văn bản, không tạo liên kết', () => {
    renderTrang(<TextMarkup text="Xem Phần 99 để biết thêm." lienKetPhan={lienKet} />);
    expect(screen.getByText('Xem Phần 99 để biết thêm.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('"Phần N" nằm trong **đậm** vẫn thành liên kết, chữ vẫn đậm', () => {
    renderTrang(<TextMarkup text="Đọc kỹ **xem Phần 6** trước khi làm." lienKetPhan={lienKet} />);
    const link = screen.getByRole('link', { name: 'Phần 6' });
    expect(link).toHaveAttribute('href', '#ho-so');
    expect(link.closest('strong')).not.toBeNull();
  });
});
