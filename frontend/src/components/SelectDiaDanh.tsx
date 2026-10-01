import { useMemo } from 'react';
import { Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { layDiaDanh } from '@/api/danhMuc';
import { locTiengViet } from '@/lib/timKiemTiengViet';

interface Props {
  label: string;
  placeholder?: string;
  cap: 'tinh_thanh' | 'phuong_xa_dac_khu';
  parentId?: string | null;
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  required?: boolean;
  /** Khi cap=phuong_xa_dac_khu mà chưa chọn tỉnh/thành thì vô hiệu hóa (dependent select). */
  disabled?: boolean;
  /**
   * Tùy chọn — lọc theo `dia_danh.phien_ban` (thêm 2026-09-30). Không truyền
   * -> KHÔNG lọc, giữ nguyên hành vi cũ (trả về mọi phiên bản, dùng cho các
   * màn hình quản trị cần thấy cả xã lịch sử/đặc biệt).
   */
  phienBan?: 'hien_tai' | 'lich_su' | 'dac_biet';
}

/** Select tìm kiếm cho danh mục địa danh — dùng chung nơi sinh (tỉnh/thành) và phường/xã phụ thuộc. */
export function SelectDiaDanh({ label, placeholder, cap, parentId, value, onChange, error, required, disabled, phienBan }: Props) {
  const enabled = cap === 'tinh_thanh' || !!parentId;

  // Tải trọn danh sách theo (cap, parentId) 1 lần — KHÔNG truyền q lên server. Để Mantine tự lọc "data"
  // theo searchValue phía client: nếu để Select tự đồng bộ searchValue theo nhãn của lựa chọn hiện tại
  // (hành vi mặc định khi đã có value) rồi đem chính searchValue đó lọc server-side, dropdown sẽ chỉ còn
  // đúng 1 lựa chọn (chính nó) mỗi khi mở lại — không chọn sang địa danh khác được nữa.
  const { data, isLoading } = useQuery({
    queryKey: ['danh-muc', 'dia-danh', cap, parentId ?? null, phienBan ?? null],
    queryFn: () => layDiaDanh({ cap, parent_id: parentId ?? undefined, phien_ban: phienBan }),
    enabled: enabled && !disabled,
  });

  const options = useMemo(() => (data?.data ?? []).map((d) => ({ value: d.id, label: d.ten })), [data]);

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={options}
      value={value}
      onChange={onChange}
      searchable
      filter={locTiengViet}
      nothingFoundMessage={isLoading ? 'Đang tải…' : 'Không tìm thấy'}
      error={error}
      required={required}
      disabled={disabled || !enabled}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
