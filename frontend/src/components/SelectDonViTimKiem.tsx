import { useState } from 'react';
import { Loader, Select, type ComboboxItem } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQueries, useQuery } from '@tanstack/react-query';
import { layDonViCongTac, layDonViCongTacTheoId } from '@/api/danhMuc';
import { chuanHoaNfc } from '@/lib/nfc';
import type { DonViCongTac } from '@/api/types';

interface Props {
  label?: string;
  placeholder?: string;
  value: string | null;
  onChange: (id: string | null, donVi: DonViCongTac | null) => void;
  /** Bỏ trống -> layDonViCongTac tự mặc định 'truong' (xem api/danhMuc.ts). Truyền mảng -> tìm gộp
   * nhiều loại (1 truy vấn/loại). */
  loaiDonVi?: string | string[];
  size?: string;
  w?: number | string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  'aria-label'?: string;
}

function nhanDonVi(d: DonViCongTac): string {
  return d.dia_ban_ten ? `${d.ten_don_vi} — ${d.dia_ban_ten}` : d.ten_don_vi;
}

// 2 đơn vị trùng nhãn -> Mantine Select ném lỗi "Duplicate options" làm sập trang. Nhãn trùng thì
// thêm mã đơn vị (duy nhất) để phân biệt — giống SelectDonVi.tsx#ganNhan.
function ganNhan(ds: DonViCongTac[]): ComboboxItem[] {
  const dem = new Map<string, number>();
  for (const d of ds) dem.set(nhanDonVi(d), (dem.get(nhanDonVi(d)) ?? 0) + 1);
  return ds.map((d) => {
    const nhan = nhanDonVi(d);
    return { value: d.id, label: (dem.get(nhan) ?? 0) > 1 ? `${nhan} (mã ${d.ma_don_vi})` : nhan };
  });
}

/**
 * Select tìm đơn vị công tác qua SERVER (debounce 300ms, gõ ≥ 2 ký tự, GET /danh-muc/don-vi-cong-tac
 * đã hỗ trợ q không phân biệt dấu/hoa-thường) — thay cho tải cả danh sách (tối đa page_size=200) rồi
 * lọc phía client, vốn bỏ sót đơn vị xếp sau trang đầu khi danh mục có hàng nghìn dòng (bug: tìm
 * "Trường THPT Châu Thị Tế" không ra vì đơn vị này nằm ngoài 200 dòng đầu).
 *
 * Giá trị đang chọn luôn hiện đúng nhãn kể cả khi KHÔNG còn nằm trong kết quả tìm hiện tại: giữ lại
 * object vừa chọn (daChonNoiBo), và khi `value` được set từ ngoài (vd URL) mà chưa biết thì tự tra
 * theo id qua layDonViCongTacTheoId.
 */
export function SelectDonViTimKiem({
  label,
  placeholder,
  value,
  onChange,
  loaiDonVi,
  size,
  w,
  disabled,
  error,
  required,
  ...rest
}: Props) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 300);
  const daGoDuChu = debounced.trim().length >= 2;
  const qGui = daGoDuChu ? chuanHoaNfc(debounced.trim()) : undefined;

  const danhSachLoai = loaiDonVi === undefined ? [undefined] : Array.isArray(loaiDonVi) ? loaiDonVi : [loaiDonVi];

  const ketQua = useQueries({
    queries: danhSachLoai.map((loai) => ({
      queryKey: ['danh-muc', 'don-vi-cong-tac', 'tim-kiem', loai ?? null, qGui ?? null],
      queryFn: () => layDonViCongTac({ q: qGui, loai_don_vi: loai, page_size: 50 }),
      enabled: daGoDuChu && !disabled,
    })),
  });
  const dangTimKiem = ketQua.some((k) => k.isFetching);
  const ketQuaTimKiem = ketQua.flatMap((k) => k.data?.data ?? []);

  // Object của lựa chọn hiện tại (để hiện nhãn) — ưu tiên object vừa chọn trong phiên này, nếu
  // `value` đổi từ ngoài (chưa từng chọn qua ô này) thì tra theo id.
  const [daChonNoiBo, setDaChonNoiBo] = useState<DonViCongTac | null>(null);
  const chuaBietGiaTri = !!value && daChonNoiBo?.id !== value;
  const { data: donViTheoId } = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'theo-id', value],
    queryFn: () => layDonViCongTacTheoId(value as string),
    enabled: chuaBietGiaTri && !disabled,
  });

  const donViHienTai =
    value == null ? null : daChonNoiBo?.id === value ? daChonNoiBo : donViTheoId?.id === value ? donViTheoId : null;

  const dsHienThi = [...ketQuaTimKiem];
  if (donViHienTai && !dsHienThi.some((d) => d.id === donViHienTai.id)) dsHienThi.push(donViHienTai);
  const options = ganNhan(dsHienThi);

  function xuLyChon(id: string | null) {
    const found = id ? dsHienThi.find((d) => d.id === id) ?? null : null;
    setDaChonNoiBo(found);
    onChange(id, found);
  }

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={options}
      value={value}
      onChange={xuLyChon}
      searchValue={search}
      onSearchChange={setSearch}
      searchable
      clearable
      filter={({ options: opts }) => opts}
      nothingFoundMessage={daGoDuChu ? 'Không tìm thấy đơn vị' : 'Gõ ít nhất 2 ký tự để tìm'}
      rightSection={dangTimKiem ? <Loader size="xs" /> : undefined}
      size={size}
      w={w}
      disabled={disabled}
      error={error}
      required={required}
      comboboxProps={{ withinPortal: true }}
      {...rest}
    />
  );
}
