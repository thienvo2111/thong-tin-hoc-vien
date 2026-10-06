import { useState } from 'react';
import { Badge, Button, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  MAU_TRANG_THAI_DE_NGHI,
  NHAN_TRANG_THAI_DE_NGHI,
  useBaoVang,
  useHuyBaoVang,
  useHuyDeNghiDoiLop,
  useLopCoTheDoi,
  useTaoDeNghiDoiLop,
  type BaoVangHocVien,
  type DeNghiDoiLopHocVien,
} from '@/api/doiLop';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

// ADR 0004 G13/G14 (issue #18): thao tác của người hỗ trợ học viên ở chi tiết học viên → Học tập.

/** Báo vắng 1 buổi chưa kết thúc: chưa báo → nút "Báo vắng"; đã báo → lý do + nút "Hủy". */
export function BaoVangBuoi({
  hocVienId,
  buoi,
  baoVang,
}: {
  hocVienId: string;
  buoi: { id: string; buoi_so: number; thoi_gian_ket_thuc: string };
  baoVang?: BaoVangHocVien;
}) {
  const [mo, setMo] = useState(false);
  const huy = useHuyBaoVang(hocVienId);
  if (new Date(buoi.thoi_gian_ket_thuc) <= new Date()) {
    return baoVang ? <Badge color="gray" variant="light">Đã báo vắng</Badge> : null;
  }
  if (baoVang) {
    return (
      <Group gap={4} wrap="nowrap">
        <Badge color="orange" variant="light" title={baoVang.ly_do}>
          Báo vắng: {baoVang.ly_do}
        </Badge>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          loading={huy.isPending}
          onClick={() =>
            huy.mutate(buoi.id, {
              onSuccess: () => notifications.show({ color: 'green', message: 'Đã hủy báo vắng' }),
              onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
            })
          }
        >
          Hủy
        </Button>
      </Group>
    );
  }
  return (
    <>
      <Button size="compact-xs" variant="light" color="orange" onClick={() => setMo(true)}>
        Báo vắng
      </Button>
      <ModalBaoVang hocVienId={hocVienId} buoi={mo ? buoi : null} onClose={() => setMo(false)} />
    </>
  );
}

function ModalBaoVang({
  hocVienId,
  buoi,
  onClose,
}: {
  hocVienId: string;
  buoi: { id: string; buoi_so: number } | null;
  onClose: () => void;
}) {
  const bao = useBaoVang(hocVienId);
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState<string | undefined>();

  function luu() {
    if (!buoi) return;
    bao.mutate(
      { lich_hoc_id: buoi.id, ly_do: lyDo.trim() },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: `Đã báo vắng buổi ${buoi.buoi_so}` });
          setLyDo('');
          onClose();
        },
        onError: (err) => {
          setLoi(loiFieldsThanhMap(err).ly_do);
          notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
        },
      },
    );
  }

  return (
    <Modal opened={!!buoi} onClose={onClose} title={`Báo vắng buổi ${buoi?.buoi_so ?? ''}`} centered>
      <Stack gap="sm">
        <Text fz="sm" c="dimmed">
          Nhóm hỗ trợ giảng viên và giảng viên sẽ thấy trên danh sách lớp; mẫu điểm danh điền sẵn "Vắng có phép".
        </Text>
        <Textarea
          label="Lý do"
          required
          autosize
          minRows={2}
          maxLength={500}
          value={lyDo}
          error={loi}
          onChange={(e) => setLyDo(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={luu} loading={bao.isPending} disabled={lyDo.trim().length < 2}>
            Ghi báo vắng
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Đề nghị đổi lớp của 1 giai đoạn: đang có đề nghị chờ → trạng thái + "Hủy đề nghị"; ngược lại nút tạo. */
export function DeNghiGiaiDoan({
  hocVienId,
  gd,
  deNghi,
}: {
  hocVienId: string;
  gd: { id: string; thu_tu: number; ten_giai_doan: string };
  deNghi: DeNghiDoiLopHocVien[];
}) {
  const [mo, setMo] = useState(false);
  const huy = useHuyDeNghiDoiLop();
  const cuaGd = deNghi.filter((d) => d.giai_doan_id === gd.id);
  const dangCho = cuaGd.find((d) => d.trang_thai === 'cho_duyet');
  const ganNhat = cuaGd[0];

  return (
    <Stack gap={4} mt={4}>
      {ganNhat && (
        <Group gap={6} wrap="wrap">
          <Badge color={MAU_TRANG_THAI_DE_NGHI[ganNhat.trang_thai]} variant="light">
            Đổi lớp: {NHAN_TRANG_THAI_DE_NGHI[ganNhat.trang_thai]}
          </Badge>
          <Text fz="xs" c="dimmed">
            {ganNhat.lop_hien_tai?.ten_lop ?? 'Chưa phân lớp'} → {ganNhat.lop_de_nghi.ten_lop} · {dinhDangNgayGio(ganNhat.tao_luc)}
            {ganNhat.ghi_chu_xu_ly ? ` · ${ganNhat.ghi_chu_xu_ly}` : ''}
          </Text>
        </Group>
      )}
      <Group gap="xs">
        {dangCho ? (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            loading={huy.isPending}
            onClick={() =>
              huy.mutate(dangCho.id, {
                onSuccess: () => notifications.show({ color: 'green', message: 'Đã hủy đề nghị đổi lớp' }),
                onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) }),
              })
            }
          >
            Hủy đề nghị
          </Button>
        ) : (
          <Button size="compact-xs" variant="light" onClick={() => setMo(true)}>
            Đề nghị đổi lớp
          </Button>
        )}
      </Group>
      <ModalDeNghiDoiLop hocVienId={hocVienId} gd={mo ? gd : null} onClose={() => setMo(false)} />
    </Stack>
  );
}

function ModalDeNghiDoiLop({
  hocVienId,
  gd,
  onClose,
}: {
  hocVienId: string;
  gd: { id: string; thu_tu: number; ten_giai_doan: string } | null;
  onClose: () => void;
}) {
  const ds = useLopCoTheDoi(hocVienId, gd?.id ?? null);
  const tao = useTaoDeNghiDoiLop(hocVienId);
  const [lopId, setLopId] = useState<string | null>(null);
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState<Record<string, string>>({});

  const options = (ds.data?.lop ?? [])
    .filter((l) => l.id !== ds.data?.lop_hien_tai_id)
    .map((l) => ({
      value: l.id,
      label: `${l.ten_lop} — sĩ số ${l.si_so}${l.si_so_toi_da ? `/${l.si_so_toi_da}` : ''}`,
    }));

  function dong() {
    setLopId(null);
    setLyDo('');
    setLoi({});
    onClose();
  }

  function luu() {
    if (!gd || !lopId) return;
    tao.mutate(
      { giai_doan_id: gd.id, lop_de_nghi_id: lopId, ly_do: lyDo.trim() },
      {
        onSuccess: () => {
          notifications.show({ color: 'green', message: 'Đã gửi đề nghị — chờ nhóm hỗ trợ giảng viên duyệt' });
          dong();
        },
        onError: (err) => {
          setLoi(loiFieldsThanhMap(err));
          notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
        },
      },
    );
  }

  return (
    <Modal opened={!!gd} onClose={dong} title={`Đề nghị đổi lớp — GĐ${gd?.thu_tu ?? ''} ${gd?.ten_giai_doan ?? ''}`} centered>
      <Stack gap="sm">
        <Select
          label="Lớp đề nghị chuyển sang"
          placeholder={ds.isLoading ? 'Đang tải…' : 'Chọn lớp'}
          data={options}
          value={lopId}
          onChange={setLopId}
          required
          nothingFoundMessage="Không có lớp khác trong giai đoạn này"
          error={loi.lop_de_nghi_id}
          comboboxProps={{ withinPortal: false }}
        />
        <Textarea
          label="Lý do"
          description="Tối thiểu 5 ký tự"
          required
          autosize
          minRows={2}
          maxLength={500}
          value={lyDo}
          error={loi.ly_do}
          onChange={(e) => setLyDo(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={dong}>
            Đóng
          </Button>
          <Button onClick={luu} loading={tao.isPending} disabled={!lopId || lyDo.trim().length < 5}>
            Gửi đề nghị
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
