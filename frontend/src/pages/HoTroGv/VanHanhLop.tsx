import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Checkbox, Group, Modal, Paper, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';
import { DIEM_HOC_HO_TRO_GV } from '@/api/diemHoc';
import {
  useLuuHauCan,
  useSuaBuoiGv,
  useThayThucDia,
  type HauCanGiangVien,
  type ThucDia,
  type TrangLop,
} from '@/api/hoTroGv';
import { SelectDiemHoc } from '@/components/SelectDiemHoc';
import { loiFieldsThanhMap, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { dinhDangNgayGio } from '@/lib/ngay';

type Buoi = TrangLop['buoi'][number];

function isoThanhInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Sửa giờ / điểm học / phòng 1 buổi chưa diễn ra — lý do bắt buộc (ADR 0004 G12, issue #16). */
export function ModalSuaBuoiGv({ buoi, onClose }: { buoi: Buoi | null; onClose: () => void }) {
  const sua = useSuaBuoiGv();
  const [form, setForm] = useState({ bat_dau: '', ket_thuc: '', diem_hoc_id: null as string | null, phong: '', ly_do: '' });
  const [loi, setLoi] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!buoi) return;
    setForm({
      bat_dau: isoThanhInput(buoi.thoi_gian_bat_dau),
      ket_thuc: isoThanhInput(buoi.thoi_gian_ket_thuc),
      diem_hoc_id: buoi.diem_hoc?.id ?? null,
      phong: buoi.phong ?? '',
      ly_do: '',
    });
    setLoi({});
  }, [buoi]);

  function luu() {
    if (!buoi) return;
    setLoi({});
    sua.mutate(
      {
        lichHocId: buoi.id,
        dto: {
          thoi_gian_bat_dau: new Date(form.bat_dau).toISOString(),
          thoi_gian_ket_thuc: new Date(form.ket_thuc).toISOString(),
          diem_hoc_id: form.diem_hoc_id ?? undefined,
          phong: form.phong.trim() || null,
          ly_do: form.ly_do.trim(),
        },
      },
      {
        onSuccess: (kq) => {
          notifications.show({ color: 'green', message: 'Đã lưu buổi học' });
          for (const cb of kq.canh_bao ?? []) notifications.show({ color: 'yellow', message: cb, autoClose: 8000 });
          onClose();
        },
        onError: (err) => {
          const f = loiFieldsThanhMap(err);
          if (Object.keys(f).length) setLoi(f);
          notifications.show({ color: 'red', message: thongDiepLoiChung(err) });
        },
      },
    );
  }

  const hopLe =
    form.bat_dau !== '' && form.ket_thuc !== '' && new Date(form.ket_thuc) > new Date(form.bat_dau) && form.ly_do.trim().length >= 5;

  return (
    <Modal opened={!!buoi} onClose={onClose} title={`Sửa buổi ${buoi?.buoi_so ?? ''}`} centered>
      <Stack gap="sm">
        <Group grow>
          <TextInput type="datetime-local" label="Bắt đầu" required value={form.bat_dau} error={loi.thoi_gian_bat_dau} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, bat_dau: v })); }} />
          <TextInput type="datetime-local" label="Kết thúc" required value={form.ket_thuc} error={loi.thoi_gian_ket_thuc} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, ket_thuc: v })); }} />
        </Group>
        <SelectDiemHoc base={DIEM_HOC_HO_TRO_GV} value={form.diem_hoc_id} onChange={(v) => setForm((f) => ({ ...f, diem_hoc_id: v }))} required error={loi.diem_hoc_id} />
        <TextInput label="Phòng" value={form.phong} onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, phong: v })); }} />
        <Textarea
          label="Lý do thay đổi"
          description="Bắt buộc (tối thiểu 5 ký tự) — ghi vào nhật ký để báo lại học viên, giảng viên"
          required
          autosize
          minRows={2}
          value={form.ly_do}
          error={loi.ly_do}
          onChange={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, ly_do: v })); }}
        />
        <Button mt="sm" loading={sua.isPending} disabled={!hopLe} onClick={luu} fullWidth>
          Lưu thay đổi
        </Button>
      </Stack>
    </Modal>
  );
}

type FormHauCan = Required<Omit<HauCanGiangVien, 'id' | 'giang_vien_id' | 'cap_nhat_luc' | 'nguoi_sua'>>;
const HAU_CAN_RONG: FormHauCan = {
  noi_o_ten: '',
  noi_o_dia_chi: '',
  nhan_phong: '',
  tra_phong: '',
  phuong_tien: '',
  don_luc: '',
  diem_don: '',
  lien_he_don: '',
  ghi_chu: '',
  da_xac_nhan_noi_o: false,
  da_xac_nhan_di_chuyen: false,
};

function rongThanhNull(v: string | null): string | null {
  return v && v.trim() ? v.trim() : null;
}

/** Thẻ hậu cần 1 giảng viên (chỗ ở + phương tiện) — khóa lạc quan: 409 → báo + tải lại bản mới. */
export function TheHauCan({
  lopId,
  gdId,
  giangVien,
  hauCan,
}: {
  lopId: string;
  gdId: string;
  giangVien: { id: string; ho_ten: string; so_dien_thoai?: string };
  hauCan: HauCanGiangVien | undefined;
}) {
  const luu = useLuuHauCan(lopId, gdId);
  const [form, setForm] = useState<FormHauCan>(HAU_CAN_RONG);

  useEffect(() => {
    setForm(
      hauCan
        ? {
            noi_o_ten: hauCan.noi_o_ten ?? '',
            noi_o_dia_chi: hauCan.noi_o_dia_chi ?? '',
            nhan_phong: hauCan.nhan_phong?.slice(0, 10) ?? '',
            tra_phong: hauCan.tra_phong?.slice(0, 10) ?? '',
            phuong_tien: hauCan.phuong_tien ?? '',
            don_luc: hauCan.don_luc ? isoThanhInput(hauCan.don_luc) : '',
            diem_don: hauCan.diem_don ?? '',
            lien_he_don: hauCan.lien_he_don ?? '',
            ghi_chu: hauCan.ghi_chu ?? '',
            da_xac_nhan_noi_o: hauCan.da_xac_nhan_noi_o,
            da_xac_nhan_di_chuyen: hauCan.da_xac_nhan_di_chuyen,
          }
        : HAU_CAN_RONG,
    );
  }, [hauCan]);

  function dat<K extends keyof FormHauCan>(k: K, v: FormHauCan[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function xuLyLuu() {
    luu.mutate(
      {
        giangVienId: giangVien.id,
        dto: {
          cap_nhat_luc: hauCan?.cap_nhat_luc,
          noi_o_ten: rongThanhNull(form.noi_o_ten),
          noi_o_dia_chi: rongThanhNull(form.noi_o_dia_chi),
          nhan_phong: rongThanhNull(form.nhan_phong),
          tra_phong: rongThanhNull(form.tra_phong),
          phuong_tien: rongThanhNull(form.phuong_tien),
          don_luc: form.don_luc ? new Date(form.don_luc).toISOString() : null,
          diem_don: rongThanhNull(form.diem_don),
          lien_he_don: rongThanhNull(form.lien_he_don),
          ghi_chu: rongThanhNull(form.ghi_chu),
          da_xac_nhan_noi_o: form.da_xac_nhan_noi_o,
          da_xac_nhan_di_chuyen: form.da_xac_nhan_di_chuyen,
        },
      },
      {
        onSuccess: () => notifications.show({ color: 'green', message: `Đã lưu hậu cần — ${giangVien.ho_ten}` }),
        onError: (err) =>
          notifications.show({
            color: err instanceof ApiError && err.status === 409 ? 'yellow' : 'red',
            message: thongDiepLoiXungDot(err),
            autoClose: 8000,
          }),
      },
    );
  }

  return (
    <Paper withBorder radius={12} p="md" data-testid={`hau-can-${giangVien.id}`}>
      <Group justify="space-between" mb="xs">
        <Text fw={700}>{giangVien.ho_ten}</Text>
        <Group gap={6}>
          <Badge color={form.da_xac_nhan_noi_o ? 'green' : 'gray'} variant="light">
            Chỗ ở {form.da_xac_nhan_noi_o ? 'đã xác nhận' : 'chưa xác nhận'}
          </Badge>
          <Badge color={form.da_xac_nhan_di_chuyen ? 'green' : 'gray'} variant="light">
            Di chuyển {form.da_xac_nhan_di_chuyen ? 'đã xác nhận' : 'chưa xác nhận'}
          </Badge>
        </Group>
      </Group>
      <Stack gap="xs">
        <Group grow align="flex-start">
          <TextInput label="Nơi ở" placeholder="Khách sạn, nhà khách..." value={form.noi_o_ten ?? ''} onChange={(e) => dat('noi_o_ten', e.currentTarget.value)} />
          <TextInput label="Địa chỉ nơi ở" value={form.noi_o_dia_chi ?? ''} onChange={(e) => dat('noi_o_dia_chi', e.currentTarget.value)} />
        </Group>
        <Group grow align="flex-start">
          <TextInput type="date" label="Nhận phòng" value={form.nhan_phong ?? ''} onChange={(e) => dat('nhan_phong', e.currentTarget.value)} />
          <TextInput type="date" label="Trả phòng" value={form.tra_phong ?? ''} onChange={(e) => dat('tra_phong', e.currentTarget.value)} />
        </Group>
        <Group grow align="flex-start">
          <TextInput label="Phương tiện" placeholder="Xe HCMUE, tự túc..." value={form.phuong_tien ?? ''} onChange={(e) => dat('phuong_tien', e.currentTarget.value)} />
          <TextInput type="datetime-local" label="Giờ đón" value={form.don_luc ?? ''} onChange={(e) => dat('don_luc', e.currentTarget.value)} />
        </Group>
        <Group grow align="flex-start">
          <TextInput label="Điểm đón" value={form.diem_don ?? ''} onChange={(e) => dat('diem_don', e.currentTarget.value)} />
          <TextInput label="Liên hệ đón" placeholder="Tài xế, SĐT" value={form.lien_he_don ?? ''} onChange={(e) => dat('lien_he_don', e.currentTarget.value)} />
        </Group>
        <Textarea label="Ghi chú" autosize minRows={1} value={form.ghi_chu ?? ''} onChange={(e) => dat('ghi_chu', e.currentTarget.value)} />
        <Group gap="lg">
          <Checkbox label="Đã xác nhận chỗ ở" checked={form.da_xac_nhan_noi_o} onChange={(e) => dat('da_xac_nhan_noi_o', e.currentTarget.checked)} />
          <Checkbox label="Đã xác nhận di chuyển" checked={form.da_xac_nhan_di_chuyen} onChange={(e) => dat('da_xac_nhan_di_chuyen', e.currentTarget.checked)} />
        </Group>
        <Group justify="space-between">
          <Text fz="xs" c="dimmed">
            {hauCan ? `Cập nhật ${dinhDangNgayGio(hauCan.cap_nhat_luc)}${hauCan.nguoi_sua ? ` bởi ${hauCan.nguoi_sua}` : ''}` : 'Chưa nhập'}
          </Text>
          <Button size="xs" loading={luu.isPending} onClick={xuLyLuu}>
            Lưu hậu cần
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

/** Người hỗ trợ thực địa của đợt — sửa danh sách rồi lưu (thay toàn bộ). */
export function KhungThucDia({ lopId, gdId, thucDia }: { lopId: string; gdId: string; thucDia: ThucDia[] }) {
  const luu = useThayThucDia(lopId, gdId);
  const [ds, setDs] = useState<{ ho_ten: string; so_dien_thoai: string; nhiem_vu: string }[]>([]);

  useEffect(() => {
    setDs(thucDia.map((t) => ({ ho_ten: t.ho_ten, so_dien_thoai: t.so_dien_thoai, nhiem_vu: t.nhiem_vu ?? '' })));
  }, [thucDia]);

  function xuLyLuu() {
    luu.mutate(
      ds
        .filter((d) => d.ho_ten.trim() || d.so_dien_thoai.trim())
        .map((d) => ({ ho_ten: d.ho_ten.trim(), so_dien_thoai: d.so_dien_thoai.trim(), nhiem_vu: d.nhiem_vu.trim() || undefined })),
      {
        onSuccess: () => notifications.show({ color: 'green', message: 'Đã lưu người hỗ trợ thực địa' }),
        onError: (err) => notifications.show({ color: 'red', message: thongDiepLoiChung(err) }),
      },
    );
  }

  return (
    <Paper withBorder radius={12} p="md">
      <Text fw={700} mb="xs">
        Người hỗ trợ thực địa (cả đợt)
      </Text>
      <Stack gap="xs">
        {ds.length === 0 && (
          <Text fz="sm" c="dimmed">
            Chưa có người hỗ trợ thực địa.
          </Text>
        )}
        {ds.map((d, i) => (
          <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
            <TextInput aria-label="Họ tên thực địa" placeholder="Họ tên" value={d.ho_ten} onChange={(e) => { const v = e.currentTarget.value; setDs((x) => x.map((y, j) => (j === i ? { ...y, ho_ten: v } : y))); }} style={{ flex: 1 }} />
            <TextInput aria-label="SĐT thực địa" placeholder="SĐT" value={d.so_dien_thoai} onChange={(e) => { const v = e.currentTarget.value; setDs((x) => x.map((y, j) => (j === i ? { ...y, so_dien_thoai: v } : y))); }} w={140} />
            <TextInput aria-label="Nhiệm vụ" placeholder="Nhiệm vụ (mở phòng, đón GV...)" value={d.nhiem_vu} onChange={(e) => { const v = e.currentTarget.value; setDs((x) => x.map((y, j) => (j === i ? { ...y, nhiem_vu: v } : y))); }} style={{ flex: 1 }} />
            <ActionIcon variant="subtle" color="red" aria-label="Gỡ" onClick={() => setDs((x) => x.filter((_, j) => j !== i))} mb={4}>
              ✕
            </ActionIcon>
          </Group>
        ))}
        <Group justify="space-between">
          <Button variant="light" size="xs" onClick={() => setDs((x) => [...x, { ho_ten: '', so_dien_thoai: '', nhiem_vu: '' }])}>
            + Thêm người
          </Button>
          <Button size="xs" loading={luu.isPending} onClick={xuLyLuu}>
            Lưu thực địa
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
