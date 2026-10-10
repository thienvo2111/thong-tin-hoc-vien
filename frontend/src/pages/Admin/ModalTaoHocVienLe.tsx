import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useTaoHocVienLe, type TaoHocVienLeDto, type TaoHocVienLeResult } from '@/api/admin';
import { loiFieldsThanhMap, thongDiepLoiXungDot } from '@/lib/loiApi';
import { chuanHoaNfc } from '@/lib/nfc';
import { SelectDonViTimKiem } from '@/components/SelectDonViTimKiem';
import { ChonKhoaVaCum } from './ChonKhoaVaCum';

const FORM_RONG = {
  ma_dinh_danh_moet: '',
  so_dinh_danh_ca_nhan: '',
  ho_ten: '',
  ngay_sinh: '',
  thang_sinh: '',
  nam_sinh: '',
  chuc_vu: '',
  don_vi_cong_tac_id: '',
  so_dien_thoai_lien_he: '',
  chuyen_mon: '',
  khoa_id: '',
  cum_id: '',
};
type FormTaoLe = typeof FORM_RONG;

const tuyChon = (v: string) => (v.trim() ? chuanHoaNfc(v.trim()) : undefined);

function kiemTraForm(f: FormTaoLe): Record<string, string> {
  const loi: Record<string, string> = {};
  if (!f.ma_dinh_danh_moet.trim() && !f.so_dinh_danh_ca_nhan.trim()) {
    loi.ma_dinh_danh_moet = 'Cần ít nhất 1 trong 2: Mã định danh MOET hoặc Số ĐDCN/CCCD';
  }
  if (!f.ho_ten.trim()) loi.ho_ten = 'Bắt buộc';
  for (const k of ['ngay_sinh', 'thang_sinh', 'nam_sinh'] as const) {
    if (!/^\d+$/.test(f[k].trim())) loi[k] = 'Nhập số';
  }
  if (!f.don_vi_cong_tac_id) loi.don_vi_cong_tac_id = 'Bắt buộc';
  return loi;
}

function thanhDto(f: FormTaoLe): TaoHocVienLeDto {
  return {
    ma_dinh_danh_moet: tuyChon(f.ma_dinh_danh_moet),
    so_dinh_danh_ca_nhan: tuyChon(f.so_dinh_danh_ca_nhan),
    ho_ten: chuanHoaNfc(f.ho_ten.trim()),
    ngay_sinh: Number(f.ngay_sinh),
    thang_sinh: Number(f.thang_sinh),
    nam_sinh: Number(f.nam_sinh),
    chuc_vu: tuyChon(f.chuc_vu),
    don_vi_cong_tac_id: f.don_vi_cong_tac_id,
    so_dien_thoai_lien_he: tuyChon(f.so_dien_thoai_lien_he),
    chuyen_mon: f.chuyen_mon
      .split(',')
      .map((c) => chuanHoaNfc(c.trim()))
      .filter(Boolean),
    khoa_id: f.khoa_id || undefined,
    cum_id: f.cum_id || undefined,
  };
}

/** Quản trị tạo lẻ 1 học viên (POST /hoc-vien/tao-le) — thay import MOET cho vài trường hợp lẻ. */
export function ModalTaoHocVienLe({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const tao = useTaoHocVienLe();
  const [form, setForm] = useState<FormTaoLe>(FORM_RONG);
  const [loi, setLoi] = useState<Record<string, string>>({});
  const [ketQua, setKetQua] = useState<TaoHocVienLeResult | null>(null);

  function dat<K extends keyof FormTaoLe>(k: K) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.currentTarget.value;
      setForm((f) => ({ ...f, [k]: v }));
    };
  }

  function lamMoi() {
    setForm(FORM_RONG);
    setLoi({});
    setKetQua(null);
    tao.reset();
  }

  function dong() {
    lamMoi();
    onClose();
  }

  function luu() {
    const loiMoi = kiemTraForm(form);
    setLoi(loiMoi);
    if (Object.keys(loiMoi).length > 0) return;
    tao.mutate(thanhDto(form), {
      onSuccess: setKetQua,
      onError: (err) => setLoi(loiFieldsThanhMap(err)),
    });
  }

  const coLoiField = Object.keys(loiFieldsThanhMap(tao.error)).length > 0;

  return (
    <Modal opened={opened} onClose={dong} title="Thêm học viên" centered size="lg">
      {ketQua ? (
        <Stack gap="md">
          <Alert color="green" title="Đã tạo tài khoản học viên">
            <Text fz="sm">
              Tên đăng nhập: <b>{ketQua.ten_dang_nhap}</b>
            </Text>
            <Text fz="sm">
              Mật khẩu ban đầu: ngày sinh dạng ddmmyyyy (vd 05031985); học viên phải đổi ở lần đăng nhập đầu.
            </Text>
            {ketQua.dang_ky_hoc_id && <Text fz="sm">Đã ghi danh vào khóa đã chọn.</Text>}
          </Alert>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={lamMoi}>
              Thêm học viên khác
            </Button>
            <Button onClick={() => navigate(`/admin/hoc-vien/${ketQua.hoc_vien_id}`)}>Xem hồ sơ</Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text fz="sm" c="dimmed">
            Cùng quy tắc với nhập danh sách MOET: hồ sơ được duyệt ngay, tên đăng nhập là mã MOET (nếu không có thì
            dùng số ĐDCN/CCCD).
          </Text>
          {tao.isError && !coLoiField && <Alert color="red">{thongDiepLoiXungDot(tao.error)}</Alert>}
          <Group grow align="flex-start" gap="sm" wrap="wrap">
            <TextInput
              label="Mã định danh MOET"
              inputMode="numeric"
              autoComplete="off"
              value={form.ma_dinh_danh_moet}
              onChange={dat('ma_dinh_danh_moet')}
              error={loi.ma_dinh_danh_moet}
            />
            <TextInput
              label="Số ĐDCN/CCCD"
              description="Cần ít nhất 1 trong 2 mã"
              inputMode="numeric"
              autoComplete="off"
              value={form.so_dinh_danh_ca_nhan}
              onChange={dat('so_dinh_danh_ca_nhan')}
              error={loi.so_dinh_danh_ca_nhan}
            />
          </Group>
          <TextInput label="Họ và tên" required value={form.ho_ten} onChange={dat('ho_ten')} error={loi.ho_ten} />
          <Group grow align="flex-start" gap="sm">
            <TextInput
              label="Ngày sinh"
              required
              inputMode="numeric"
              value={form.ngay_sinh}
              onChange={dat('ngay_sinh')}
              error={loi.ngay_sinh}
            />
            <TextInput
              label="Tháng sinh"
              required
              inputMode="numeric"
              value={form.thang_sinh}
              onChange={dat('thang_sinh')}
              error={loi.thang_sinh}
            />
            <TextInput
              label="Năm sinh"
              required
              inputMode="numeric"
              value={form.nam_sinh}
              onChange={dat('nam_sinh')}
              error={loi.nam_sinh}
            />
          </Group>
          <SelectDonViTimKiem
            label="Trường (đơn vị công tác)"
            placeholder="Gõ tên trường để tìm"
            loaiDonVi="truong"
            required
            value={form.don_vi_cong_tac_id || null}
            onChange={(id) => setForm((f) => ({ ...f, don_vi_cong_tac_id: id ?? '' }))}
            error={loi.don_vi_cong_tac_id}
          />
          <Group grow align="flex-start" gap="sm" wrap="wrap">
            <TextInput label="Chức vụ" value={form.chuc_vu} onChange={dat('chuc_vu')} error={loi.chuc_vu} />
            <TextInput
              label="Số điện thoại"
              inputMode="tel"
              value={form.so_dien_thoai_lien_he}
              onChange={dat('so_dien_thoai_lien_he')}
              error={loi.so_dien_thoai_lien_he}
            />
          </Group>
          <TextInput
            label="Chuyên môn"
            description="Nhiều chuyên môn cách nhau bằng dấu phẩy"
            value={form.chuyen_mon}
            onChange={dat('chuyen_mon')}
            error={loi.chuyen_mon}
          />
          <ChonKhoaVaCum
            khoaId={form.khoa_id}
            cumId={form.cum_id}
            onChange={(khoa_id, cum_id) => setForm((f) => ({ ...f, khoa_id, cum_id }))}
            loiKhoa={loi.khoa_id}
            loiCum={loi.cum_id}
          />
          <Group justify="flex-end" gap="sm" mt="sm">
            <Button variant="default" onClick={dong}>
              Hủy
            </Button>
            <Button loading={tao.isPending} onClick={luu}>
              Tạo học viên
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
