import { useState } from 'react';
import { Button, Group, NumberInput, Paper, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCapNhatKhoa } from '@/api/khoaBoiDuong';
import type { KhoaBoiDuong } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';

type TruongSo = 'so_buoi_doi_toi_da' | 'so_buoi_hoc_bu_toi_da';

/** Nội dung từng ô: nhãn, mô tả, nút, thông báo sau khi lưu. */
const CAU_HINH: Record<
  TruongSo,
  { nhan: string; moTa: string; nut: string; bat: (n: number) => string; tat: string }
> = {
  so_buoi_doi_toi_da: {
    nhan: 'Số buổi tối đa học viên được đề nghị đổi (0 = tắt)',
    moTa: 'Học viên đổi sang buổi tương đương của lớp khác, chờ người hỗ trợ duyệt.',
    nut: 'Lưu số buổi đổi',
    bat: (n) => `Học viên được đề nghị đổi tối đa ${n} buổi`,
    tat: 'Đã tắt đề nghị đổi buổi',
  },
  so_buoi_hoc_bu_toi_da: {
    nhan: 'Số buổi học bù tối đa mỗi học viên (0 = tắt)',
    moTa: 'Học viên đã vắng một buổi đăng ký học bù ở buổi tương đương của lớp khác, chờ người hỗ trợ duyệt.',
    nut: 'Lưu số buổi học bù',
    bat: (n) => `Học viên được đăng ký học bù tối đa ${n} buổi`,
    tat: 'Đã tắt đăng ký học bù',
  },
};

/** ADR 0007 + 0012: số buổi đổi / học bù tối đa mỗi học viên (0 = tắt) — chỉ quan_tri. */
export function CauHinhDoiBuoi({ khoa }: { khoa: KhoaBoiDuong }) {
  return (
    <Paper withBorder radius={14} p="md">
      <Stack gap="md">
        <OSoBuoi key={`doi-${khoa.so_buoi_doi_toi_da}`} khoa={khoa} truong="so_buoi_doi_toi_da" />
        <OSoBuoi key={`hb-${khoa.so_buoi_hoc_bu_toi_da ?? 0}`} khoa={khoa} truong="so_buoi_hoc_bu_toi_da" />
      </Stack>
    </Paper>
  );
}

function OSoBuoi({ khoa, truong }: { khoa: KhoaBoiDuong; truong: TruongSo }) {
  const capNhat = useCapNhatKhoa(khoa.id);
  const ch = CAU_HINH[truong];
  const giaTri = khoa[truong] ?? 0;
  const [soBuoi, setSoBuoi] = useState<number | string>(giaTri);

  // Khoảng khớp UpdateKhoaBoiDuongDto + CHECK trong DB.
  const hopLe = typeof soBuoi === 'number' && Number.isInteger(soBuoi) && soBuoi >= 0 && soBuoi <= 50;

  function luu() {
    if (typeof soBuoi !== 'number') return;
    capNhat.mutate(
      { [truong]: soBuoi },
      {
        onSuccess: (k) => {
          const n = k[truong] ?? 0;
          notifications.show({ color: 'green', message: n > 0 ? ch.bat(n) : ch.tat });
        },
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Group align="flex-end" gap="sm">
      <NumberInput
        label={ch.nhan}
        description={ch.moTa}
        min={0}
        max={50}
        allowDecimal={false}
        allowNegative={false}
        value={soBuoi}
        onChange={setSoBuoi}
        error={hopLe ? undefined : 'Nhập số nguyên từ 0 đến 50'}
        w={340}
      />
      <Button onClick={luu} loading={capNhat.isPending} disabled={!hopLe || soBuoi === giaTri}>
        {ch.nut}
      </Button>
    </Group>
  );
}
