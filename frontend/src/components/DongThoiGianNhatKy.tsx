import { useState } from 'react';
import { Button, Select, Stack, Text, Timeline } from '@mantine/core';
import type { MucNhatKy, NhomNhatKy } from '@/api/types';
import { dinhDangNgayGio } from '@/lib/ngay';
import { nhanCuaTruong } from '@/lib/nhanTruong';

const NHAN_NHOM: Record<NhomNhatKy, string> = {
  tai_khoan: 'Tài khoản & đăng nhập',
  ho_so: 'Hồ sơ & xác nhận',
  khao_sat: 'Khảo sát',
  hoc_tap: 'Kết quả & phân lớp',
  thong_bao: 'Email',
  ho_tro: 'Hỗ trợ',
};

const MAU_NHOM: Record<NhomNhatKy, string> = {
  tai_khoan: 'gray',
  ho_so: 'blue',
  khao_sat: 'violet',
  hoc_tap: 'green',
  thong_bao: 'orange',
  ho_tro: 'cyan',
};

const SO_MUC_MOI_TRANG = 50;

/** Dòng thời gian nhật ký 1 học viên (GET /hoc-vien/{id}/nhat-ky) — lọc theo nhóm, hiện dần 50 mục. */
export function DongThoiGianNhatKy({ muc }: { muc: MucNhatKy[] }) {
  const [nhom, setNhom] = useState<NhomNhatKy | null>(null);
  const [soHien, setSoHien] = useState(SO_MUC_MOI_TRANG);
  const daLoc = nhom ? muc.filter((m) => m.nhom === nhom) : muc;

  return (
    <Stack gap="md">
      <Select
        label="Lọc theo nhóm"
        placeholder="Tất cả hoạt động"
        clearable
        data={Object.entries(NHAN_NHOM).map(([value, label]) => ({ value, label }))}
        value={nhom}
        onChange={(v) => {
          setNhom(v as NhomNhatKy | null);
          setSoHien(SO_MUC_MOI_TRANG);
        }}
        maw={280}
      />
      {daLoc.length === 0 ? (
        <Text c="dimmed" fz="sm">
          Chưa có hoạt động nào được ghi nhận.
        </Text>
      ) : (
        <Timeline bulletSize={12} lineWidth={2}>
          {daLoc.slice(0, soHien).map((m) => (
            <Timeline.Item key={m.id} title={m.tieu_de} color={MAU_NHOM[m.nhom]}>
              <Text fz="xs" c="dimmed">
                {dinhDangNgayGio(m.thoi_gian)}
                {m.nguoi_thuc_hien ? ` · ${m.nguoi_thuc_hien}` : ''}
              </Text>
              {m.noi_dung && (
                <Text fz="sm">
                  {m.truong ? `${nhanCuaTruong(m.truong)}: ` : ''}
                  {m.noi_dung}
                </Text>
              )}
              {(m.ip || m.thiet_bi) && (
                <Text fz="xs" c="dimmed" truncate="end" title={m.thiet_bi ?? undefined}>
                  {[m.ip && `IP ${m.ip}`, m.thiet_bi].filter(Boolean).join(' · ')}
                </Text>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      )}
      {daLoc.length > soHien && (
        <Button variant="light" onClick={() => setSoHien((n) => n + SO_MUC_MOI_TRANG)}>
          Xem thêm ({daLoc.length - soHien} mục)
        </Button>
      )}
    </Stack>
  );
}
