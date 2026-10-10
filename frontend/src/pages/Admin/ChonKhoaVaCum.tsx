import { Group, Select } from '@mantine/core';
import { useChiTietKhoa, useDanhSachKhoa } from '@/api/khoaBoiDuong';

interface Props {
  khoaId: string;
  cumId: string;
  onChange: (khoaId: string, cumId: string) => void;
  /** Khóa đã ghi danh — không cho chọn lại. */
  boQuaKhoaIds?: string[];
  loiKhoa?: string;
  loiCum?: string;
  khoaBatBuoc?: boolean;
}

/** Chọn khóa bồi dưỡng + cụm hỗ trợ (tùy chọn) của khóa đó — dùng khi tạo học viên lẻ và ghi danh lẻ. */
export function ChonKhoaVaCum({ khoaId, cumId, onChange, boQuaKhoaIds = [], loiKhoa, loiCum, khoaBatBuoc }: Props) {
  const dsKhoa = useDanhSachKhoa({ page_size: 200 });
  const chiTiet = useChiTietKhoa(khoaId || undefined);

  const tuyChonKhoa = (dsKhoa.data?.data ?? [])
    .filter((k) => !boQuaKhoaIds.includes(k.id))
    .map((k) => ({ value: k.id, label: `${k.ten_khoa} (${k.ma_khoa})` }));
  const tuyChonCum = (chiTiet.data?.cum_hoc_vien ?? [])
    .filter((c) => c.trang_thai === 'active')
    .map((c) => ({ value: c.id, label: c.ten_cum }));

  return (
    <Group gap="sm" wrap="wrap" align="flex-start" grow>
      <Select
        label="Khóa bồi dưỡng"
        placeholder={dsKhoa.isLoading ? 'Đang tải...' : khoaBatBuoc ? 'Chọn khóa' : 'Không ghi danh'}
        data={tuyChonKhoa}
        value={khoaId || null}
        onChange={(v) => onChange(v ?? '', '')}
        searchable
        clearable={!khoaBatBuoc}
        required={khoaBatBuoc}
        nothingFoundMessage="Không có khóa phù hợp"
        error={loiKhoa}
        comboboxProps={{ withinPortal: true }}
      />
      <Select
        label="Cụm hỗ trợ"
        placeholder={khoaId ? 'Không gán cụm' : 'Chọn khóa trước'}
        data={tuyChonCum}
        value={cumId || null}
        onChange={(v) => onChange(khoaId, v ?? '')}
        disabled={!khoaId}
        clearable
        nothingFoundMessage="Khóa chưa có cụm"
        error={loiCum}
        comboboxProps={{ withinPortal: true }}
      />
    </Group>
  );
}
