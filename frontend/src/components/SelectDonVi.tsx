import { useState } from 'react';
import { Autocomplete, Loader } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { layDonViCongTac } from '@/api/danhMuc';
import type { DonViCongTac } from '@/api/types';

interface Props {
  label: string;
  /** Nhãn hiển thị ban đầu khi hồ sơ đã có đơn vị công tác (đến từ HocVien.don_vi_cong_tac_ten). */
  nhanBanDau?: string | null;
  onChange: (id: string | null, nhan: string | null) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

function nhanDonVi(d: DonViCongTac): string {
  return d.ten_phuong_xa ? `${d.ten_don_vi} — ${d.ten_phuong_xa}` : d.ten_don_vi;
}

/** Autocomplete debounce 300ms, gõ ≥ 2 ký tự — dac-ta-cong-hoc-vien.md § M4 mục 3. */
export function SelectDonVi({ label, nhanBanDau, onChange, error, required, disabled }: Props) {
  const [text, setText] = useState(nhanBanDau ?? '');
  const [debounced] = useDebouncedValue(text, 300);
  const duDieuKienTimKiem = debounced.trim().length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', debounced],
    queryFn: () => layDonViCongTac({ q: debounced.trim() }),
    enabled: duDieuKienTimKiem && !disabled,
  });

  const danhSach = data?.data ?? [];
  const options = danhSach.map(nhanDonVi);

  return (
    <Autocomplete
      label={label}
      placeholder="Gõ tên trường (ít nhất 2 ký tự)"
      data={options}
      value={text}
      onChange={(v) => {
        setText(v);
        onChange(null, null);
      }}
      onOptionSubmit={(submitted) => {
        const found = danhSach.find((d) => nhanDonVi(d) === submitted);
        setText(submitted);
        onChange(found?.id ?? null, submitted);
      }}
      rightSection={isFetching ? <Loader size="xs" /> : null}
      error={error}
      required={required}
      disabled={disabled}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
