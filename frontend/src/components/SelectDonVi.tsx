import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Loader, Stack, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { layDonViCongTac, layDonViCongTacTheoId } from '@/api/danhMuc';
import { SelectDiaDanh } from '@/components/SelectDiaDanh';
import { chuanHoaNfc } from '@/lib/nfc';
import { locTiengViet } from '@/lib/timKiemTiengViet';
import type { DonViCongTac } from '@/api/types';

interface Props {
  label: string;
  /** Nhãn hiển thị ban đầu khi hồ sơ đã có đơn vị công tác (đến từ HocVien.don_vi_cong_tac_ten). */
  nhanBanDau?: string | null;
  /**
   * id đơn vị công tác hiện tại của hồ sơ (nếu có) — dùng để tự động điền sẵn 2 Select địa giới
   * (Tỉnh/thành, Phường/xã) theo địa bàn của đơn vị đó, tránh bắt người dùng tự chọn lại từ đầu.
   */
  idBanDau?: string | null;
  onChange: (id: string | null, nhan: string | null) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

function nhanDonVi(d: DonViCongTac): string {
  return d.dia_ban_ten ? `${d.ten_don_vi} — ${d.dia_ban_ten}` : d.ten_don_vi;
}

/**
 * Autocomplete debounce 300ms, gõ ≥ 2 ký tự — dac-ta-cong-hoc-vien.md § M4 mục 3. Có thêm 2 Select
 * địa giới (tỉnh/thành → phường/xã) tùy chọn ở trên để thu hẹp phạm vi tìm kiếm qua dia_ban_id —
 * giá trị 2 Select này CHỈ để lọc, không phải giá trị gửi lên server (server chỉ cần don_vi_cong_tac_id).
 * Đã chọn Phường/xã thì danh sách trường thuộc xã đó tự hiện ra, không cần gõ (xem duDieuKienTimKiem).
 */
export function SelectDonVi({ label, nhanBanDau, idBanDau, onChange, error, required, disabled }: Props) {
  const [text, setText] = useState(nhanBanDau ?? '');
  const [debounced] = useDebouncedValue(text, 300);
  const daGoDuChu = debounced.trim().length >= 2;

  const [tinhId, setTinhId] = useState<string | null>(null);
  const [phuongXaId, setPhuongXaId] = useState<string | null>(null);
  // Mantine Autocomplete gọi onOptionSubmit RỒI gọi lại onChange với cùng nhãn ngay sau đó (đồng bộ
  // hóa value nội bộ) — nếu không lọc phát onChange "ăn theo" này ra, nó sẽ ghi đè id vừa chọn về null.
  const nhanVuaChonRef = useRef<string | null>(null);

  // Chỉ tự động điền sẵn 2 ô địa giới MỘT LẦN (khi hồ sơ đã có sẵn don_vi_cong_tac_id) — không lặp lại
  // nếu sau đó người dùng tự xóa/đổi Tỉnh/thành, tránh ghi đè lựa chọn thủ công của người dùng.
  const daTuDongDienRef = useRef(false);
  const { data: donViBanDau } = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', 'theo-id', idBanDau],
    queryFn: () => layDonViCongTacTheoId(idBanDau as string),
    enabled: !!idBanDau && tinhId === null && !disabled && !daTuDongDienRef.current,
  });

  useEffect(() => {
    if (donViBanDau && !daTuDongDienRef.current) {
      daTuDongDienRef.current = true;
      setTinhId(donViBanDau.tinh_id ?? null);
      setPhuongXaId(donViBanDau.dia_ban_id ?? null);
    }
  }, [donViBanDau]);

  // Đã chọn Phường/xã -> tự hiện toàn bộ trường thuộc xã đó, không bắt gõ tay (bug UX đã báo): chạy
  // truy vấn kể cả khi chưa gõ gì, lọc theo dia_ban_id, không gửi q, và xin page_size lớn hơn mức
  // mặc định (20) vì một xã có thể có hơn 20 trường — 100 là mức an toàn dưới giới hạn @Max(200) của
  // PaginationQueryDto. Đổi Tỉnh/thành (setPhuongXaId(null)) -> quay lại yêu cầu gõ ≥2 ký tự như cũ.
  const duDieuKienTimKiem = daGoDuChu || !!phuongXaId;
  const { data, isFetching } = useQuery({
    queryKey: ['danh-muc', 'don-vi-cong-tac', debounced, phuongXaId],
    queryFn: () =>
      layDonViCongTac({
        q: daGoDuChu ? chuanHoaNfc(debounced.trim()) : undefined,
        dia_ban_id: phuongXaId ?? undefined,
        page_size: !daGoDuChu && phuongXaId ? 100 : undefined,
      }),
    enabled: duDieuKienTimKiem && !disabled,
  });

  const danhSach = data?.data ?? [];
  const options = danhSach.map(nhanDonVi);

  return (
    <Stack gap="xs">
      <SelectDiaDanh
        label="Tỉnh/thành"
        cap="tinh_thanh"
        phienBan="hien_tai"
        value={tinhId}
        onChange={(id) => {
          setTinhId(id);
          setPhuongXaId(null);
        }}
        disabled={disabled}
      />
      <SelectDiaDanh
        label="Phường/xã"
        cap="phuong_xa_dac_khu"
        phienBan="hien_tai"
        parentId={tinhId}
        value={phuongXaId}
        onChange={setPhuongXaId}
        disabled={disabled}
      />
      <Text size="xs" c="dimmed">
        Chọn Tỉnh/thành và Phường/xã để tự động hiện danh sách trường thuộc xã đó (không bắt buộc),
        hoặc gõ trực tiếp tên trường vào ô dưới.
      </Text>
      <Autocomplete
        label={label}
        placeholder="Gõ tên trường (ít nhất 2 ký tự)"
        data={options}
        value={text}
        onChange={(v) => {
          setText(v);
          if (v === nhanVuaChonRef.current) {
            nhanVuaChonRef.current = null;
            return;
          }
          nhanVuaChonRef.current = null;
          onChange(null, null);
        }}
        onOptionSubmit={(submitted) => {
          const found = danhSach.find((d) => nhanDonVi(d) === submitted);
          setText(submitted);
          nhanVuaChonRef.current = submitted;
          onChange(found?.id ?? null, submitted);
        }}
        rightSection={isFetching ? <Loader size="xs" /> : null}
        filter={locTiengViet}
        error={error}
        required={required}
        disabled={disabled}
        comboboxProps={{ withinPortal: true }}
      />
    </Stack>
  );
}
