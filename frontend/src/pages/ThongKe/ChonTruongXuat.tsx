import { Group, MultiSelect, Radio } from '@mantine/core';
import { useBoLocThongKe } from '@/api/thongKe';
import { locTiengViet } from '@/lib/timKiemTiengViet';

// Khớp TOI_DA_DON_VI_LOC ở backend (giới hạn độ dài URL).
export const TOI_DA_TRUONG = 100;

export type CheDoTruong = 'tat_ca' | 'chon';

export interface ChonTruong {
  cheDo: CheDoTruong;
  truong: string[];
}

export const CHON_TRUONG_MAC_DINH: ChonTruong = { cheDo: 'tat_ca', truong: [] };

/** Đã chọn "chọn trường" nhưng chưa chọn trường nào -> chưa được xuất. */
export const thieuTruong = (v: ChonTruong) => v.cheDo === 'chon' && v.truong.length === 0;

/** don_vi_ids gửi API: rỗng = toàn phạm vi bộ lọc. */
export const donViIdsXuat = (v: ChonTruong) => (v.cheDo === 'chon' ? v.truong : []);

/** Chọn phạm vi trường khi xuất Excel: tất cả (theo bộ lọc) hoặc một/nhiều trường.
 * Vai trò trường / người hỗ trợ không có danh sách đơn vị -> không hiện gì. */
export function ChonTruongXuat({ value, onChange }: { value: ChonTruong; onChange: (v: ChonTruong) => void }) {
  const boLoc = useBoLocThongKe();
  const dsTruong = (boLoc.data?.don_vi ?? []).filter((d) => d.loai_don_vi === 'truong');
  if (dsTruong.length === 0) return null;
  const { cheDo, truong } = value;
  return (
    <>
      <Radio.Group value={cheDo} onChange={(v) => onChange({ ...value, cheDo: v as CheDoTruong })} label="Phạm vi trường">
        <Group gap="lg" mt={4}>
          <Radio value="tat_ca" label="Tất cả trường (theo bộ lọc)" />
          <Radio value="chon" label="Chọn một hoặc nhiều trường" />
        </Group>
      </Radio.Group>
      {cheDo === 'chon' && (
        <MultiSelect
          label="Trường"
          placeholder={truong.length ? undefined : 'Gõ tên trường để tìm'}
          searchable
          clearable
          filter={locTiengViet}
          limit={50}
          maxValues={TOI_DA_TRUONG}
          hidePickedOptions
          nothingFoundMessage="Không tìm thấy trường"
          data={dsTruong.map((d) => ({ value: d.id, label: d.ten_don_vi }))}
          value={truong}
          onChange={(t) => onChange({ ...value, truong: t })}
          description={`Đã chọn ${truong.length}/${TOI_DA_TRUONG} trường`}
          comboboxProps={{ withinPortal: true }}
        />
      )}
    </>
  );
}
