import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ThanhSiSo, mauSiSo } from './ThanhSiSo';

const ve = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>);

describe('ThanhSiSo', () => {
  it('màu theo mức đầy: dưới 80% xanh, 80–99% vàng, đủ/vượt đỏ', () => {
    expect(mauSiSo(10, 30)).toBe('teal');
    expect(mauSiSo(24, 30)).toBe('yellow');
    expect(mauSiSo(29, 30)).toBe('yellow');
    expect(mauSiSo(30, 30)).toBe('red');
    expect(mauSiSo(32, 30)).toBe('red');
  });

  it('có tối đa: hiện thanh với nhãn truy cập + số và phần đang chờ', () => {
    ve(<ThanhSiSo siSo={28} toiDa={30} cho={2} />);
    expect(screen.getByTestId('thanh-si-so')).toBeInTheDocument();
    expect(screen.getByLabelText('Sĩ số 28/30, 2 đang chờ')).toBeInTheDocument();
    expect(screen.getByText(/28\/30/)).toHaveTextContent('28/30 · +2 chờ');
  });

  it('không có tối đa: chỉ hiện số, không có thanh', () => {
    ve(<ThanhSiSo siSo={12} toiDa={null} />);
    expect(screen.queryByTestId('thanh-si-so')).toBeNull();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
