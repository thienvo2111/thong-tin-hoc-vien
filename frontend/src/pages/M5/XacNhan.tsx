import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Center, Checkbox, Container, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { kiemTraTruocXacNhan, useHoSoToi, xacNhanHoSo } from '@/api/hocVien';
import type { HocVien, XacNhanResponse } from '@/api/types';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { dinhDangNgayGio } from '@/lib/ngay';
import { CAP_GIANG_DAY_OPTIONS, GIOI_TINH_OPTIONS, TRINH_DO_OPTIONS, nhanTuTuyChon } from '@/lib/tuyChonHoSo';
import { StatusBanner } from '@/components/StatusBanner';

function dongHoSo(hoSo: HocVien): { truong: string; giaTri: string }[] {
  const ngaySinh =
    hoSo.ngay_sinh && hoSo.thang_sinh && hoSo.nam_sinh
      ? `${String(hoSo.ngay_sinh).padStart(2, '0')}/${String(hoSo.thang_sinh).padStart(2, '0')}/${hoSo.nam_sinh}`
      : '';
  let trinhDo = nhanTuTuyChon(TRINH_DO_OPTIONS, hoSo.trinh_do_chuyen_mon);
  if (hoSo.trinh_do_chuyen_mon === 'khac' && hoSo.trinh_do_chuyen_mon_khac) {
    trinhDo = hoSo.trinh_do_chuyen_mon_khac;
  }
  return [
    { truong: 'ma_dinh_danh_moet', giaTri: hoSo.ma_dinh_danh_moet ?? '' },
    { truong: 'ho_ten', giaTri: hoSo.ho_ten ?? '' },
    { truong: 'ngay_sinh', giaTri: ngaySinh },
    { truong: 'gioi_tinh', giaTri: nhanTuTuyChon(GIOI_TINH_OPTIONS, hoSo.gioi_tinh) },
    { truong: 'so_dinh_danh_ca_nhan', giaTri: hoSo.so_dinh_danh_ca_nhan ?? '' },
    { truong: 'noi_sinh_id', giaTri: hoSo.noi_sinh_ten ?? '' },
    { truong: 'phuong_xa_id', giaTri: hoSo.phuong_xa_ten ?? '' },
    { truong: 'don_vi_cong_tac_id', giaTri: hoSo.don_vi_cong_tac_ten ?? '' },
    { truong: 'chuc_vu', giaTri: hoSo.chuc_vu ?? '' },
    { truong: 'so_dien_thoai_lien_he', giaTri: hoSo.so_dien_thoai_lien_he ?? '' },
    { truong: 'email_lien_he', giaTri: hoSo.email_lien_he ?? '' },
    { truong: 'trinh_do_chuyen_mon', giaTri: trinhDo },
    { truong: 'chuyen_mon', giaTri: hoSo.chuyen_mon.join(', ') },
    { truong: 'cap_giang_day', giaTri: nhanTuTuyChon(CAP_GIANG_DAY_OPTIONS, hoSo.cap_giang_day) },
    { truong: 'mon_giang_day_id', giaTri: hoSo.mon_giang_day_ten ?? '' },
  ];
}

/** M5 — Xem lại & xác nhận (dac-ta-cong-hoc-vien.md § M5). */
export default function XacNhan() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: hoSo, isLoading: dangTaiHoSo } = useHoSoToi();
  const kiemTra = useQuery({
    queryKey: ['hoc-vien', 'toi', 'kiem-tra-truoc-xac-nhan'],
    queryFn: kiemTraTruocXacNhan,
  });
  const [daTick, setDaTick] = useState(false);
  const [ketQua, setKetQua] = useState<XacNhanResponse | null>(null);

  const xacNhanMutation = useMutation({
    mutationFn: xacNhanHoSo,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['hoc-vien'] });
      setKetQua(res);
    },
  });

  function xuLySua(truong: string) {
    navigate('/toi/ho-so', { state: { focusField: truong } });
  }

  if (ketQua) {
    return (
      <Container size="xs" py="xl">
        <Stack gap="lg" align="center" ta="center">
          <Title order={1} size="h2">
            Đã xác nhận
          </Title>
          <Text>
            Đã xác nhận lúc {dinhDangNgayGio(ketQua.xac_nhan_luc)}.
            {ketQua.email_lien_he ? ` Bản sao hồ sơ đã gửi tới ${ketQua.email_lien_he}.` : ''}
          </Text>
          <Button onClick={() => navigate('/toi')} size="lg">
            Về trang chính
          </Button>
        </Stack>
      </Container>
    );
  }

  const dangTai = dangTaiHoSo || kiemTra.isLoading;

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Xem lại &amp; xác nhận
        </Title>

        {dangTai && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {kiemTra.isError && <StatusBanner loai="error">{thongDiepLoiChung(kiemTra.error)}</StatusBanner>}

        {!dangTai && kiemTra.data && kiemTra.data.loi.length > 0 && (
          <StatusBanner loai="error" tieuDe="Cần sửa trước khi xác nhận">
            <Stack gap="xs">
              {kiemTra.data.loi.map((l) => (
                <Group key={l.field} justify="space-between" wrap="nowrap">
                  <Text size="sm">
                    {nhanCuaTruong(l.field)}: {l.message}
                  </Text>
                  <Button size="xs" variant="light" onClick={() => xuLySua(l.field)}>
                    Sửa
                  </Button>
                </Group>
              ))}
            </Stack>
          </StatusBanner>
        )}

        {!dangTai && kiemTra.data && kiemTra.data.canh_bao.length > 0 && (
          <StatusBanner loai="warning" tieuDe="Lưu ý">
            <Stack gap={4}>
              {kiemTra.data.canh_bao.map((c) => (
                <Text size="sm" key={c.field}>
                  {nhanCuaTruong(c.field)}: {c.message}
                </Text>
              ))}
            </Stack>
          </StatusBanner>
        )}

        {!dangTai && hoSo && (
          <Table withRowBorders={false} verticalSpacing="xs">
            <Table.Tbody>
              {dongHoSo(hoSo).map((d) => (
                <Table.Tr key={d.truong}>
                  <Table.Td w="45%" fw={500} c="dimmed">
                    {nhanCuaTruong(d.truong)}
                  </Table.Td>
                  <Table.Td>{d.giaTri || '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {!dangTai && (
          <>
            <Checkbox
              label="Tôi xác nhận các thông tin trên là chính xác và chịu trách nhiệm về thông tin đã khai."
              checked={daTick}
              onChange={(e) => setDaTick(e.currentTarget.checked)}
            />

            {xacNhanMutation.isError && <StatusBanner loai="error">{thongDiepLoiChung(xacNhanMutation.error)}</StatusBanner>}

            <Button
              size="lg"
              fullWidth
              disabled={!daTick || (kiemTra.data?.loi.length ?? 0) > 0}
              loading={xacNhanMutation.isPending}
              onClick={() => xacNhanMutation.mutate()}
            >
              Xác nhận
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
}
