import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Group, Modal, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { layFormVleThu, type VleFormThuDto } from '@/api/sso';
import type { MucNangLuc } from '@/api/types';
import { StatusBanner } from '@/components/StatusBanner';
import { guiFormVle } from '@/lib/guiFormVle';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { NHAN_MUC_NANG_LUC, THU_TU_MUC } from '@/lib/mucNangLuc';
import { chuanHoaNfc } from '@/lib/nfc';

/** Tên cửa sổ/tab VLE thử — form ẩn submit vào đúng tab đã mở sẵn trong lúc bấm. */
const TEN_CUA_SO_VLE_THU = 'vle-thu';

const TUY_CHON_MUC = THU_TU_MUC.map((m) => ({ value: m, label: NHAN_MUC_NANG_LUC[m] }));

/** Có '@' -> gửi như email, không thì username (backend: có cả hai thì username thắng). */
function dtoThuVaoVle(giaTri: string, muc: MucNangLuc): VleFormThuDto {
  return giaTri.includes('@') ? { email: giaTri, muc } : { username: giaTri, muc };
}

/**
 * Quản trị "Thử vào VLE" (api-contract.md mục 10.2, POST /sso/vle/form-thu): nhập username/email VLE bất kỳ +
 * mức để kiểm external-login và VLE_COURSE_MAP trên production — không cần tài khoản học viên, chạy cả khi
 * khóa đang tắt nút. Tab mới mở NGAY trong lúc bấm (trước khi chờ API) để không bị chặn popup.
 */
export function ModalThuVaoVle({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [giaTri, setGiaTri] = useState('');
  const [muc, setMuc] = useState<MucNangLuc>('co_ban');
  const [loiNhap, setLoiNhap] = useState<string | null>(null);
  const [loiApi, setLoiApi] = useState<string | null>(null);
  // undefined = chưa thử; null = đã gửi nhưng không kèm id_course.
  const [idCourseDaGui, setIdCourseDaGui] = useState<number | null | undefined>(undefined);
  const thu = useMutation({ mutationFn: layFormVleThu });

  function dong() {
    setGiaTri('');
    setMuc('co_ban');
    setLoiNhap(null);
    setLoiApi(null);
    setIdCourseDaGui(undefined);
    onClose();
  }

  async function moVle(e: FormEvent) {
    e.preventDefault();
    const v = chuanHoaNfc(giaTri.trim());
    if (!v) {
      setLoiNhap('Nhập username hoặc email VLE');
      return;
    }
    setLoiNhap(null);
    setLoiApi(null);
    setIdCourseDaGui(undefined);
    // Mở tab đồng bộ trong sự kiện bấm — sau await trình duyệt sẽ chặn popup.
    const cuaSo = window.open('', TEN_CUA_SO_VLE_THU);
    try {
      const kq = await thu.mutateAsync(dtoThuVaoVle(v, muc));
      guiFormVle(kq.action, kq.fields, TEN_CUA_SO_VLE_THU);
      setIdCourseDaGui(kq.id_course);
    } catch (err) {
      cuaSo?.close();
      setLoiApi(thongDiepLoiChung(err));
    }
  }

  return (
    <Modal opened={opened} onClose={dong} title="Thử vào VLE" centered>
      <form onSubmit={moVle} noValidate>
        <Stack gap="md">
          <TextInput
            label="Username hoặc email VLE"
            value={giaTri}
            onChange={(e) => setGiaTri(e.currentTarget.value)}
            error={loiNhap}
            autoComplete="off"
            data-autofocus
          />
          <Stack gap={4}>
            <Text id="muc-thu-vao-vle" fz="sm" fw={500}>
              Mức
            </Text>
            <SegmentedControl
              role="radiogroup"
              aria-labelledby="muc-thu-vao-vle"
              data={TUY_CHON_MUC}
              value={muc}
              onChange={(v) => setMuc(v as MucNangLuc)}
            />
          </Stack>
          <Text fz="sm" c="dimmed">
            Mở VLE ở tab mới, đăng nhập đúng tài khoản VLE đã nhập — chỉ dùng tài khoản thử hoặc được phép. Mỗi lần
            thử được ghi nhật ký, không tính lượt vào của học viên. Hoạt động cả khi khóa đang tắt nút.
          </Text>
          {loiApi && <StatusBanner loai="error">{loiApi}</StatusBanner>}
          {idCourseDaGui !== undefined && (
            <Text fz="sm" role="status">
              {idCourseDaGui === null
                ? 'Không gửi id_course — mức chưa có trong VLE_COURSE_MAP.'
                : `Đã gửi id_course ${idCourseDaGui}`}
            </Text>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={dong}>
              Đóng
            </Button>
            <Button type="submit" loading={thu.isPending}>
              Mở VLE
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
