import { useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useSuaHoSoHoTro, type SuaHoSoHoTroDto } from '@/api/hoTro';
import type { HocVienHoTroChiTiet } from '@/api/types';
import { SelectDonVi } from '@/components/SelectDonVi';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { CAP_GIANG_DAY_OPTIONS, DOI_TUONG_OPTIONS, GIOI_TINH_OPTIONS, TRINH_DO_OPTIONS } from '@/lib/tuyChonHoSo';

type HoSo = HocVienHoTroChiTiet['ho_so'];

interface Form {
  ho_ten: string;
  ngay_sinh: number | '';
  thang_sinh: number | '';
  nam_sinh: number | '';
  gioi_tinh: string;
  chuc_vu: string;
  doi_tuong: string;
  don_vi_cong_tac_id: string;
  so_dien_thoai_lien_he: string;
  email_lien_he: string;
  trinh_do_chuyen_mon: string;
  cap_giang_day: string;
}

function tuHoSo(h: HoSo): Form {
  return {
    ho_ten: h.ho_ten ?? '',
    ngay_sinh: h.ngay_sinh ?? '',
    thang_sinh: h.thang_sinh ?? '',
    nam_sinh: h.nam_sinh ?? '',
    gioi_tinh: h.gioi_tinh ?? '',
    chuc_vu: h.chuc_vu ?? '',
    doi_tuong: h.doi_tuong ?? '',
    don_vi_cong_tac_id: h.don_vi_cong_tac_id ?? '',
    so_dien_thoai_lien_he: h.so_dien_thoai_lien_he ?? '',
    email_lien_he: h.email_lien_he ?? '',
    trinh_do_chuyen_mon: h.trinh_do_chuyen_mon ?? '',
    cap_giang_day: h.cap_giang_day ?? '',
  };
}

/** Chỉ gửi trường thật sự đổi — lịch sử thay đổi ghi đúng trường đã sửa, kèm 1 lý do chung. */
function thayDoi(goc: Form, moi: Form): Omit<SuaHoSoHoTroDto, 'ly_do'> {
  const kq: Record<string, string | number> = {};
  for (const k of Object.keys(moi) as (keyof Form)[]) {
    const v = moi[k];
    if (v === goc[k] || v === '') continue;
    kq[k] = typeof v === 'string' ? chuanHoaNfc(v.trim()) : v;
  }
  return kq;
}

/** Sửa hồ sơ hộ học viên (ADR 0003 H7): không sửa CCCD/mã MOET; bắt buộc lý do; sửa email thì học viên phải
 * xác minh lại; đang có đợt xác nhận mở thì xác nhận cũ của học viên bị hủy. */
export function ModalSuaHoSoHoTro({ hoSo, mo, onDong }: { hoSo: HoSo; mo: boolean; onDong: () => void }) {
  const [goc] = useState(() => tuHoSo(hoSo));
  const [form, setForm] = useState<Form>(goc);
  const [lyDo, setLyDo] = useState('');
  const [loi, setLoi] = useState<Record<string, string>>({});
  const sua = useSuaHoSoHoTro(hoSo.id);
  const dto = thayDoi(goc, form);
  const coThayDoi = Object.keys(dto).length > 0;
  const lyDoHopLe = lyDo.trim().length >= 5;

  const dat = <K extends keyof Form>(k: K) => (v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function luu() {
    setLoi({});
    sua.mutate(
      { ...dto, ly_do: chuanHoaNfc(lyDo.trim()) },
      {
        onSuccess: (kq) => {
          notifications.show({
            color: 'green',
            message: kq.xac_nhan_bi_huy
              ? 'Đã lưu. Xác nhận hồ sơ trước đó của học viên đã bị hủy — học viên cần xác nhận lại.'
              : 'Đã lưu thay đổi hồ sơ',
          });
          onDong();
        },
        onError: (err) => {
          const fields = loiFieldsThanhMap(err);
          if (Object.keys(fields).length > 0) setLoi(fields);
          else notifications.show({ color: 'red', message: thongDiepLoiXungDot(err) });
        },
      },
    );
  }

  return (
    <Modal opened={mo} onClose={onDong} title={`Sửa hồ sơ: ${hoSo.ho_ten ?? ''}`} size="lg" centered>
      <Stack gap="sm">
        <Text fz="sm" c="dimmed">
          Mã MOET và số CCCD không sửa được ở đây. Mọi thay đổi được ghi lịch sử kèm lý do.
        </Text>
        <TextInput label="Họ tên" value={form.ho_ten} error={loi.ho_ten} onChange={(e) => dat('ho_ten')(e.currentTarget.value)} />
        <SimpleGrid cols={3} spacing="xs">
          <NumberInput label="Ngày sinh" min={1} max={31} value={form.ngay_sinh} error={loi.ngay_sinh} onChange={(v) => dat('ngay_sinh')(v === '' ? '' : Number(v))} />
          <NumberInput label="Tháng" min={1} max={12} value={form.thang_sinh} error={loi.thang_sinh} onChange={(v) => dat('thang_sinh')(v === '' ? '' : Number(v))} />
          <NumberInput label="Năm" min={1940} max={2010} value={form.nam_sinh} error={loi.nam_sinh} onChange={(v) => dat('nam_sinh')(v === '' ? '' : Number(v))} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <Select label="Giới tính" data={GIOI_TINH_OPTIONS} value={form.gioi_tinh || null} error={loi.gioi_tinh} onChange={(v) => dat('gioi_tinh')(v ?? '')} />
          <Select label="Đối tượng" data={DOI_TUONG_OPTIONS} value={form.doi_tuong || null} error={loi.doi_tuong} onChange={(v) => dat('doi_tuong')(v ?? '')} />
          <TextInput label="Chức vụ" value={form.chuc_vu} error={loi.chuc_vu} onChange={(e) => dat('chuc_vu')(e.currentTarget.value)} />
          <TextInput label="Số điện thoại" value={form.so_dien_thoai_lien_he} error={loi.so_dien_thoai_lien_he} onChange={(e) => dat('so_dien_thoai_lien_he')(e.currentTarget.value)} />
          <Select label="Trình độ chuyên môn" data={TRINH_DO_OPTIONS} value={form.trinh_do_chuyen_mon || null} error={loi.trinh_do_chuyen_mon} onChange={(v) => dat('trinh_do_chuyen_mon')(v ?? '')} />
          <Select label="Cấp giảng dạy" data={CAP_GIANG_DAY_OPTIONS} value={form.cap_giang_day || null} error={loi.cap_giang_day} onChange={(v) => dat('cap_giang_day')(v ?? '')} />
        </SimpleGrid>
        <TextInput label="Email" value={form.email_lien_he} error={loi.email_lien_he} onChange={(e) => dat('email_lien_he')(e.currentTarget.value)} />
        {form.email_lien_he.trim() !== goc.email_lien_he && (
          <Alert color="yellow" variant="light">
            Đổi email: học viên sẽ phải tự xác minh email mới trước khi dùng được link đặt lại mật khẩu.
          </Alert>
        )}
        <SelectDonVi
          label="Đơn vị công tác"
          nhanBanDau={hoSo.don_vi_cong_tac_ten}
          idBanDau={hoSo.don_vi_cong_tac_id}
          error={loi.don_vi_cong_tac_id}
          onChange={(id) => dat('don_vi_cong_tac_id')(id ?? goc.don_vi_cong_tac_id)}
        />
        <Textarea
          label="Lý do điều chỉnh"
          required
          description="Bắt buộc, 5–500 ký tự — vd: học viên báo sai ngày sinh qua Zalo cụm."
          minRows={2}
          autosize
          value={lyDo}
          error={loi.ly_do}
          onChange={(e) => setLyDo(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDong}>
            Hủy
          </Button>
          <Button onClick={luu} loading={sua.isPending} disabled={!coThayDoi || !lyDoHopLe}>
            Lưu thay đổi
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
