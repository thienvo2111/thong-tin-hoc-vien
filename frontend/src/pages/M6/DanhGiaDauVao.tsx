import { useState } from 'react';
import { Box, Button, Center, Container, CopyButton, Group, List, Loader, Stack, Text, TextInput, Title } from '@mantine/core';
import { EMAIL_HO_TRO } from '@/content/hoTro';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { capMaSso, useDanhGiaDauVao, type SsoTarget } from '@/api/hocVien';
import type { DanhGiaDauVao, DanhGiaDauVaoDuDieuKien } from '@/api/types';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';

// Câu tiếng Việt cố định do backend dựng cho lý do "chưa xác nhận đợt 2"
// (hoc-vien.service.ts#danhGiaDauVaoCuaToi) — dùng để chọn nút M5 hay M4 bên dưới. ly_do là
// string[] không có mã lý do có cấu trúc, nên đây là cách duy nhất phân biệt được 2 trường hợp;
// nếu backend đổi câu chữ, FE sẽ rơi về nhánh "hồ sơ chưa đầy đủ" (vẫn có 1 nút hợp lý, không vỡ UI).
const LY_DO_CHUA_XAC_NHAN = 'Chưa xác nhận hồ sơ ở đợt xác nhận trước đánh giá (đợt 2)';

/** M6 — Làm bài đánh giá đầu vào (dac-ta-cong-hoc-vien.md § M6). */
export default function DanhGiaDauVaoPage() {
  const { data, isLoading, isError, error } = useDanhGiaDauVao();

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1} size="h2">
          Làm bài đánh giá đầu vào
        </Title>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>}

        {data && <NoiDung data={data} />}
      </Stack>
    </Container>
  );
}

function NoiDung({ data }: { data: DanhGiaDauVao }) {
  if (data.du_dieu_kien) return data.kenh === 'sso' ? <KhoiSso /> : <KhoiDuDieuKien data={data} />;

  if (data.het_han) {
    const hoTro = `email ${EMAIL_HO_TRO}`;
    return (
      <StatusBanner loai="warning">
        Đã hết thời gian xác nhận để làm bài đánh giá. Thầy/Cô liên hệ {hoTro} để được hướng dẫn.
      </StatusBanner>
    );
  }

  const lyDo = data.ly_do ?? [];
  const canXacNhan = lyDo.includes(LY_DO_CHUA_XAC_NHAN);
  const conLyDoKhac = lyDo.some((l) => l !== LY_DO_CHUA_XAC_NHAN);

  return (
    <StatusBanner loai="warning" tieuDe="Chưa đủ điều kiện làm bài đánh giá">
      <Stack gap="sm">
        {lyDo.length > 0 && (
          <List size="sm">
            {lyDo.map((l) => (
              <List.Item key={l}>{l}</List.Item>
            ))}
          </List>
        )}
        <Group>
          {(canXacNhan || lyDo.length === 0) && (
            <Button component={Link} to="/toi/xac-nhan">
              Xem lại &amp; xác nhận
            </Button>
          )}
          {(conLyDoKhac || lyDo.length === 0) && (
            <Button component={Link} to="/toi/ho-so" variant={canXacNhan ? 'default' : 'filled'}>
              Bổ sung hồ sơ
            </Button>
          )}
        </Group>
      </Stack>
    </StatusBanner>
  );
}

/** Kênh SSO (2026-10-02): bấm nút -> cổng cấp mã dùng 1 lần -> chuyển sang hệ thống khảo sát CÙNG TAB
 * (không mở cửa sổ mới — trình duyệt nhúng Zalo). Mã chỉ cấp lúc bấm vì hết hạn sau vài phút. */
function KhoiSso() {
  const chuyen = useMutation({
    mutationFn: capMaSso,
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const dangChuyen = (target?: SsoTarget) => chuyen.isPending && chuyen.variables === target;

  return (
    <Stack gap="md">
      <StatusBanner loai="success" tieuDe="Hồ sơ đã đầy đủ">
        Thầy/Cô bấm vào bài cần làm. Hệ thống sẽ chuyển sang trang khảo sát và đăng nhập sẵn, không cần nhập lại mật
        khẩu.
      </StatusBanner>

      {chuyen.isError && <StatusBanner loai="error">{thongDiepLoiChung(chuyen.error)}</StatusBanner>}

      <Button size="lg" fullWidth loading={dangChuyen('khao-sat')} disabled={chuyen.isPending} onClick={() => chuyen.mutate('khao-sat')}>
        Làm phiếu khảo sát kĩ năng số
      </Button>
      <Button size="lg" fullWidth loading={dangChuyen('danh-gia')} disabled={chuyen.isPending} onClick={() => chuyen.mutate('danh-gia')}>
        Làm phiếu đánh giá năng lực số
      </Button>
      <Button variant="subtle" loading={dangChuyen(undefined)} disabled={chuyen.isPending} onClick={() => chuyen.mutate(undefined)}>
        Xem tất cả bài cần làm
      </Button>
    </Stack>
  );
}

function KhoiDuDieuKien({ data }: { data: DanhGiaDauVaoDuDieuKien }) {
  const [hien, setHien] = useState(false);
  const hrefLamBai = chuanHoaLienKet(data.duong_dan);

  return (
    <Stack gap="md">
      <StatusBanner loai="success" tieuDe="Đủ điều kiện làm bài đánh giá">
        Thầy/Cô dùng tài khoản VLE bên dưới để vào làm bài.
      </StatusBanner>

      {hrefLamBai ? (
        <Button component="a" href={hrefLamBai} size="lg" fullWidth>
          Vào làm bài
        </Button>
      ) : (
        <Text size="sm">{data.duong_dan}</Text>
      )}

      <Box>
        <Text size="sm" c="dimmed" mb={4}>
          Tên đăng nhập VLE
        </Text>
        <Group gap="xs" wrap="nowrap">
          <TextInput value={data.ten_dang_nhap_vle} readOnly flex={1} />
          <CopyButton value={data.ten_dang_nhap_vle}>
            {({ copied, copy }) => (
              <Button variant="default" onClick={copy}>
                {copied ? 'Đã chép' : 'Sao chép'}
              </Button>
            )}
          </CopyButton>
        </Group>
      </Box>

      {data.mat_khau_tam ? (
        <Box>
          <Text size="sm" c="dimmed" mb={4}>
            Mật khẩu tạm
          </Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput value={hien ? data.mat_khau_tam : '••••••••'} readOnly flex={1} />
            <Button variant="default" onClick={() => setHien((v) => !v)}>
              {hien ? 'Ẩn' : 'Hiện'}
            </Button>
            <CopyButton value={data.mat_khau_tam}>
              {({ copied, copy }) => (
                <Button variant="default" onClick={copy}>
                  {copied ? 'Đã chép' : 'Sao chép'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Box>
      ) : (
        <StatusBanner loai="info">Chưa có mật khẩu tạm cho tài khoản này. Thầy/Cô liên hệ hỗ trợ nếu cần.</StatusBanner>
      )}

      <Text size="sm" c="dimmed">
        Hệ thống VLE sẽ yêu cầu đổi mật khẩu ở lần đăng nhập đầu.
      </Text>
    </Stack>
  );
}
