import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Anchor, Box, Button, Card, Center, Checkbox, Container, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { kiemTraTruocXacNhan, useDotXacNhan, useHoSoToi, xacNhanHoSo } from '@/api/hocVien';
import type { DotXacNhan, HocVien, XacNhanResponse } from '@/api/types';
import { laLoiDotDong, thongDiepLoiChung, thongDiepLoiXungDot } from '@/lib/loiApi';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { dinhDangNgayGio } from '@/lib/ngay';
import { CAP_GIANG_DAY_OPTIONS, DOI_TUONG_OPTIONS, GIOI_TINH_OPTIONS, TRINH_DO_OPTIONS, nhanTuTuyChon } from '@/lib/tuyChonHoSo';
import { StatusBanner } from '@/components/StatusBanner';
import { CountdownTimer } from '@/components/CountdownTimer';

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
    {
      truong: 'noi_sinh',
      giaTri: [hoSo.noi_sinh_xa, hoSo.noi_sinh_huyen, hoSo.noi_sinh_tinh].filter(Boolean).join(', '),
    },
    {
      truong: 'cu_tru',
      giaTri: [hoSo.cu_tru_phuong_xa_ten, hoSo.cu_tru_tinh_ten].filter(Boolean).join(', '),
    },
    { truong: 'don_vi_cong_tac_id', giaTri: hoSo.don_vi_cong_tac_ten ?? '' },
    { truong: 'chuc_vu', giaTri: hoSo.chuc_vu ?? '' },
    { truong: 'doi_tuong', giaTri: nhanTuTuyChon(DOI_TUONG_OPTIONS, hoSo.doi_tuong) },
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
  const { data: dotXacNhan } = useDotXacNhan();
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
  // 2026-10-05: hồ sơ import MOET gắn với đợt xác nhận. Đã xác nhận -> khóa (chỉ mở lại khi sửa hồ sơ);
  // không có đợt mở (đã quá đợt) hoặc server báo đợt đóng -> không xác nhận được, hướng dẫn gửi Hỗ trợ.
  const apDungDot = dotXacNhan?.ap_dung_dot ?? false;
  const daQuaDot = (apDungDot && !dotXacNhan?.dot) || laLoiDotDong(xacNhanMutation.error);
  const daKhoa = apDungDot && !!dotXacNhan?.dot && dotXacNhan.da_xac_nhan;
  const choXacNhan = !dangTai && !daQuaDot && !daKhoa && (!apDungDot || !!dotXacNhan?.dot);

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Xem lại &amp; xác nhận
        </Title>

        {daQuaDot && dotXacNhan && <KhoiQuaDot dotXacNhan={dotXacNhan} />}

        {daKhoa && dotXacNhan?.dot && (
          <StatusBanner loai="success" tieuDe="Thầy/Cô đã xác nhận hồ sơ">
            <Text size="sm">
              Đã xác nhận lúc {dotXacNhan.xac_nhan_luc ? dinhDangNgayGio(dotXacNhan.xac_nhan_luc) : ''}. Không cần xác
              nhận lại nếu thông tin không thay đổi. Nếu cần sửa, bấm <b>Chỉnh sửa thông tin</b>; sau khi sửa, Thầy/Cô
              phải xác nhận lại trước {dinhDangNgayGio(dotXacNhan.dot.dong_luc)}.
            </Text>
          </StatusBanner>
        )}

        {!daKhoa && !daQuaDot && dotXacNhan?.can_xac_nhan_lai && (
          <StatusBanner loai="warning" tieuDe="Thông tin hồ sơ đã được điều chỉnh">
            <Text size="sm">
              Hồ sơ của Thầy/Cô có điều chỉnh
              {dotXacNhan.dieu_chinh_luc ? ` lúc ${dinhDangNgayGio(dotXacNhan.dieu_chinh_luc)}` : ''} sau lần xác nhận
              trước, nên lần xác nhận đó không còn hiệu lực. Vui lòng kiểm tra lại thông tin bên dưới và{' '}
              <b>xác nhận lại</b>.
            </Text>
          </StatusBanner>
        )}

        {!daKhoa && !daQuaDot && dotXacNhan?.dot && (
          <StatusBanner loai="warning">
            <Stack gap={4}>
              <Text size="sm">
                Đợt <b>{dotXacNhan.dot.ten}</b> đang mở — hạn chót {dinhDangNgayGio(dotXacNhan.dot.dong_luc)}. Vui lòng
                kiểm tra kỹ thông tin trước khi xác nhận.
              </Text>
              <CountdownTimer dongLuc={dotXacNhan.dot.dong_luc} />
            </Stack>
          </StatusBanner>
        )}

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
          <Card withBorder radius="md" p={0}>
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
            {!daQuaDot && (
              <Box p="md" ta="right">
                <Anchor component={Link} to="/toi/ho-so" fz="sm" fw={700}>
                  Chỉnh sửa thông tin →
                </Anchor>
              </Box>
            )}
          </Card>
        )}

        {choXacNhan && (
          <>
            <Card withBorder radius="md">
              <Checkbox
                label="Tôi xác nhận các thông tin trên là chính xác và chịu trách nhiệm về thông tin đã khai."
                checked={daTick}
                onChange={(e) => setDaTick(e.currentTarget.checked)}
              />
            </Card>

            {xacNhanMutation.isError && !laLoiDotDong(xacNhanMutation.error) && (
              <StatusBanner loai="error">{thongDiepLoiXungDot(xacNhanMutation.error)}</StatusBanner>
            )}

            <Button
              size="lg"
              fullWidth
              disabled={!daTick || (kiemTra.data?.loi.length ?? 0) > 0}
              loading={xacNhanMutation.isPending}
              onClick={() => xacNhanMutation.mutate()}
            >
              {dotXacNhan?.can_xac_nhan_lai ? 'Xác nhận lại' : 'Xác nhận'}
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
}

/** Đã quá đợt xác nhận: không còn tự xác nhận/sửa được — hướng dẫn gửi Hỗ trợ cho Ban tổ chức xử lý. */
function KhoiQuaDot({ dotXacNhan }: { dotXacNhan: DotXacNhan }) {
  const { dot_sap_mo, xac_nhan_gan_nhat } = dotXacNhan;
  if (dot_sap_mo) {
    return (
      <StatusBanner loai="info" tieuDe={`Đợt ${dot_sap_mo.ten}`}>
        <Text size="sm">
          Đợt xác nhận tiếp theo mở lúc {dinhDangNgayGio(dot_sap_mo.mo_luc)}. Thầy/Cô quay lại xác nhận khi đợt mở.
        </Text>
      </StatusBanner>
    );
  }
  return (
    <StatusBanner loai="warning" tieuDe="Đã hết thời gian xác nhận">
      <Stack gap="xs">
        {xac_nhan_gan_nhat && (
          <Text size="sm">
            Thầy/Cô đã xác nhận hồ sơ lúc {dinhDangNgayGio(xac_nhan_gan_nhat.xac_nhan_luc)} (đợt{' '}
            {xac_nhan_gan_nhat.dot_ten}).
          </Text>
        )}
        <Text size="sm">
          Đợt xác nhận đã kết thúc. Nếu cần điều chỉnh hoặc xác nhận lại thông tin, Thầy/Cô vui lòng gửi yêu cầu Hỗ trợ
          để Ban tổ chức xử lý.
        </Text>
        <Button component={Link} to="/toi/yeu-cau-ho-tro" variant="default" w="fit-content">
          Gửi yêu cầu hỗ trợ
        </Button>
      </Stack>
    </StatusBanner>
  );
}
