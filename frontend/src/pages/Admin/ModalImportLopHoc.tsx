import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, FileInput, Modal, SegmentedControl, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { taiMauExcel, useTaiLenImport } from '@/api/nhapDuLieu';
import { chiTietKhoaKey } from '@/api/khoaBoiDuong';
import type { LoaiDanhMucImport } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { taiFileTuBlob } from '@/lib/taiFile';
import { PanelXemTruocImport } from '@/components/PanelXemTruocImport';

type LoaiImportLop = Extract<LoaiDanhMucImport, 'lop_va_lich_hoc' | 'nhan_su_lop'>;

const TUY_CHON_LOAI: { value: LoaiImportLop; label: string }[] = [
  { value: 'lop_va_lich_hoc', label: 'Lớp & lịch học (mỗi dòng 1 buổi)' },
  { value: 'nhan_su_lop', label: 'Nhân sự lớp' },
];

/** Import lớp/lịch học hoặc nhân sự lớp ngay trong trang chi tiết khóa — dùng lại luồng 2 bước của
 * /import (tải lên + kiểm tra, rồi xác nhận), gửi kèm ?ma_khoa= để file không cần ghi mã khóa. */
export function ModalImportLopHoc({
  opened,
  onClose,
  khoaId,
  maKhoa,
}: {
  opened: boolean;
  onClose: () => void;
  khoaId: string;
  maKhoa: string;
}) {
  const queryClient = useQueryClient();
  const [loai, setLoai] = useState<LoaiImportLop>('lop_va_lich_hoc');
  const [file, setFile] = useState<File | null>(null);
  const [importId, setImportId] = useState<string | undefined>();

  const upload = useTaiLenImport();
  const taiMau = useMutation({
    mutationFn: () => taiMauExcel(loai),
    onSuccess: (blob) => taiFileTuBlob(blob, `mau-${loai}.xlsx`),
    onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
  });

  function dong() {
    setImportId(undefined);
    setFile(null);
    onClose();
  }

  function xuLyTaiLen() {
    if (!file) return;
    upload.mutate(
      { loai, file, maKhoa },
      {
        onSuccess: (res) => setImportId(res.import_id),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Modal opened={opened} onClose={dong} title="Import lớp học từ Excel" size="lg" centered>
      {importId ? (
        <PanelXemTruocImport
          importId={importId}
          onDaNap={() => queryClient.invalidateQueries({ queryKey: chiTietKhoaKey(khoaId) })}
          onXongViec={dong}
        />
      ) : (
        <Stack gap="md">
          <SegmentedControl
            aria-label="Loại dữ liệu"
            data={TUY_CHON_LOAI}
            value={loai}
            onChange={(v) => setLoai(v as LoaiImportLop)}
            fullWidth
          />
          <Text fz={13} c="dimmed">
            Cột ma_khoa có thể để trống — hệ thống tự gán khóa <b>{maKhoa}</b>. Dòng ghi khóa khác sẽ bị báo lỗi.
            {loai === 'nhan_su_lop' && ' Lớp phải được tạo trước.'}
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            loading={taiMau.isPending}
            onClick={() => taiMau.mutate()}
            style={{ alignSelf: 'flex-start' }}
          >
            ⇩ Tải file mẫu Excel
          </Button>
          <FileInput label="File Excel" placeholder="Chọn file .xlsx" accept=".xlsx" value={file} onChange={setFile} clearable />
          <Button color="danger" loading={upload.isPending} disabled={!file} onClick={xuLyTaiLen} fullWidth>
            Tải lên &amp; kiểm tra
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
