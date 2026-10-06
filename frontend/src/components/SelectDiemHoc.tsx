import { useMemo } from 'react';
import { Select } from '@mantine/core';
import { useDiemHocDangHoatDong } from '@/api/diemHoc';
import { locTiengViet } from '@/lib/timKiemTiengViet';

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  required?: boolean;
  error?: string;
  description?: string;
  /** Đường dẫn API danh mục — mặc định của Quản trị. */
  base?: string;
}

/** Chọn điểm học đang hoạt động (T10, issue #2) — tìm không dấu theo tên/mã/địa chỉ phía client. */
export function SelectDiemHoc({ value, onChange, required, error, description, base }: Props) {
  const { data, isLoading } = useDiemHocDangHoatDong(base);
  const options = useMemo(
    () =>
      (data?.data ?? []).map((d) => ({
        value: d.id,
        label: `${d.ten} (${d.ma_diem_hoc}) — ${d.dia_chi}`,
      })),
    [data],
  );

  return (
    <Select
      label="Điểm học"
      placeholder={isLoading ? 'Đang tải...' : 'Chọn điểm học'}
      data={options}
      value={value}
      onChange={onChange}
      required={required}
      error={error}
      description={description}
      searchable
      clearable={!required}
      nothingFoundMessage="Không có điểm học phù hợp — thêm ở mục Điểm học"
      filter={locTiengViet}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
