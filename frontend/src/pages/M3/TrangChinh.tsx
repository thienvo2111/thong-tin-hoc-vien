import { Badge, Box, Button, Card, Center, Container, Group, List, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { capMaSso, useDotXacNhan, useHoSoToi, useMucDoDayDu, type SsoTarget } from '@/api/hocVien';
import { useTinhTrangKhaoSat } from '@/api/ketQuaKhaoSat';
import type { HocVien, MucDoDayDu } from '@/api/types';
import { useCauHinhTrienKhai, type CauHinhTrienKhai } from '@/content/trienKhai';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { dinhDangNgayGio } from '@/lib/ngay';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { NHAN_MUC_NANG_LUC, TEN_BAI_KHAO_SAT, nhanTrangThaiKhaoSat } from '@/lib/trangThaiKhaoSat';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { CountdownTimer } from '@/components/CountdownTimer';

const MUC_MENU_CHINH = [
  { toi: '/toi/ho-so', bieuTuong: '📄', tieuDe: 'Cập nhật hồ sơ', moTa: 'Xem và chỉnh sửa thông tin cá nhân' },
  { toi: '/toi/lop-hoc', bieuTuong: '🏫', tieuDe: 'Thông tin lớp học', moTa: 'Lịch học, địa điểm, kết quả đánh giá đầu vào' },
];

/** Xưng hô theo giới tính; chưa có giới tính -> "Thầy/Cô". */
function xungHo(gioiTinh: HocVien['gioi_tinh'] | undefined) {
  if (gioiTinh === 'nam') return 'Thầy';
  if (gioiTinh === 'nu') return 'Cô';
  return 'Thầy/Cô';
}

/** M3 — trang chính, khối trạng thái theo bảng trong dac-ta-cong-hoc-vien.md § M3. */
export default function TrangChinh() {
  const { data, isLoading, isError, error } = useDotXacNhan();
  const { data: hoSo } = useHoSoToi();
  const { cauHinh, daTai: daTaiCauHinh } = useCauHinhTrienKhai({ loai: 'cua_toi' });
  // Đầu vào "đã mở" khi quản trị bật khối khảo sát trên trang chủ HOẶC mục Đánh giá đầu vào.
  // Chờ tải xong cấu hình thật, tránh chớp theo giá trị mặc định.
  const dauVaoMo = daTaiCauHinh && (cauHinh.hienKhaoSat || cauHinh.danhGiaDauVaoTrongCong);
  const dauRaMo = daTaiCauHinh && cauHinh.khaoSatDauRaMo;
  const { data: mucDo } = useMucDoDayDu(dauVaoMo || dauRaMo);

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Box
          p="lg"
          style={{
            borderRadius: 16,
            background: 'linear-gradient(120deg, var(--mantine-color-primary-6), var(--mantine-color-primary-4))',
          }}
        >
          <Title order={1} size="h2" c="white">
            Chào mừng {xungHo(hoSo?.gioi_tinh)}
            {hoSo?.ho_ten ? ` ${hoSo.ho_ten}` : ''} 👋
          </Title>
          <Text c="gray.3" size="sm" mt={4}>
            Theo dõi tiến độ hồ sơ và các đợt xác nhận của bạn tại đây.
          </Text>
        </Box>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && <StatusBanner loai="error">{thongDiepLoiChung(error)}</StatusBanner>}

        {data && (
          <>
            <Stack gap="sm">
              <Text fw={700} size="sm">
                Việc cần làm
              </Text>
              {mucDo && dauVaoMo && <KhoiKhaoSatDauVao mucDo={mucDo} cauHinh={cauHinh} />}
              {mucDo && dauRaMo && <KhoiKhaoSatDauRa mucDo={mucDo} />}
              <KhoiTrangThai data={data} />
            </Stack>

            <TheHuongDan />

            <MenuChinh />
          </>
        )}
      </Stack>
    </Container>
  );
}

/** Lối tắt sang Hướng dẫn sử dụng (M9, /huong-dan) — công khai, ngoài RequireAuth. */
function TheHuongDan() {
  return (
    <Card padding="md" radius="md" withBorder>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm">Lần đầu sử dụng hệ thống? Xem hướng dẫn từng bước có hình minh họa</Text>
        <Button component={Link} to="/huong-dan" variant="light" size="xs">
          Xem hướng dẫn
        </Button>
      </Group>
    </Card>
  );
}

function MenuChinh() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {MUC_MENU_CHINH.map((m) => (
        <Card
          key={m.toi}
          component={Link}
          to={m.toi}
          padding="lg"
          radius="md"
          withBorder
          style={{ textDecoration: 'none' }}
        >
          <Group gap="md" wrap="nowrap" align="flex-start">
            <Text fz={28} lh={1}>
              {m.bieuTuong}
            </Text>
            <Box>
              <Text fw={700}>{m.tieuDe}</Text>
              <Text size="sm" c="dimmed">
                {m.moTa}
              </Text>
            </Box>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function KhoiTrangThai({ data }: { data: NonNullable<ReturnType<typeof useDotXacNhan>['data']> }) {
  const { dot, dot_sap_mo, da_xac_nhan, xac_nhan_luc, day_du, thieu } = data;

  if (dot && !day_du) {
    return (
      <StatusBanner loai="warning" tieuDe={`Đợt ${dot.ten}`}>
        <Stack gap="xs">
          <Text>
            Còn {thieu.length} thông tin cần bổ sung. Hạn: {dinhDangNgayGio(dot.dong_luc)}
          </Text>
          <CountdownTimer dongLuc={dot.dong_luc} />
          {thieu.length > 0 && (
            <List size="sm">
              {thieu.map((t) => (
                <List.Item key={t.field}>{nhanCuaTruong(t.field)}</List.Item>
              ))}
            </List>
          )}
          <Button component={Link} to="/toi/ho-so" mt="xs">
            Bổ sung thông tin
          </Button>
        </Stack>
      </StatusBanner>
    );
  }

  if (dot && day_du && !da_xac_nhan) {
    return (
      <StatusBanner loai="info" tieuDe={`Đợt ${dot.ten}`}>
        <Stack gap="xs">
          <Text>Hồ sơ đã đủ. Thầy/Cô cần kiểm tra lại và xác nhận trước {dinhDangNgayGio(dot.dong_luc)}</Text>
          <CountdownTimer dongLuc={dot.dong_luc} />
          <Button component={Link} to="/toi/xac-nhan" mt="xs">
            Xem lại &amp; xác nhận
          </Button>
        </Stack>
      </StatusBanner>
    );
  }

  if (dot && day_du && da_xac_nhan) {
    const laDotDanhGia = dot.loai === 'xac_nhan_truoc_danh_gia';
    return (
      <Stack gap="lg">
        <StatusBanner loai="success" tieuDe={`Đợt ${dot.ten}`}>
          <Stack gap="xs">
            <Text>
              Đã xác nhận lúc {xac_nhan_luc ? dinhDangNgayGio(xac_nhan_luc) : ''}. Có thể sửa tới {dinhDangNgayGio(dot.dong_luc)}
              , nhưng sửa xong phải xác nhận lại.
            </Text>
            <CountdownTimer dongLuc={dot.dong_luc} />
            <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
              Xem hồ sơ
            </Button>
          </Stack>
        </StatusBanner>
        {laDotDanhGia && (
          <StatusBanner loai="info" tieuDe="Đánh giá đầu vào">
            <Stack gap="xs">
              <Text>Thầy/Cô đã xác nhận và có thể làm bài đánh giá đầu vào.</Text>
              <Button component={Link} to="/toi/danh-gia-dau-vao" mt="xs">
                Làm bài đánh giá
              </Button>
            </Stack>
          </StatusBanner>
        )}
      </Stack>
    );
  }

  if (!dot && dot_sap_mo) {
    return (
      <StatusBanner loai="info" tieuDe={`Đợt ${dot_sap_mo.ten}`}>
        <Stack gap="xs">
          <Text>Đợt {dot_sap_mo.ten} mở lúc {dinhDangNgayGio(dot_sap_mo.mo_luc)}</Text>
          <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
            Xem hồ sơ
          </Button>
        </Stack>
      </StatusBanner>
    );
  }

  return (
    <StatusBanner loai="info">
      <Stack gap="xs">
        <Text>Hiện không trong thời gian chỉnh sửa hồ sơ</Text>
        <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
          Xem hồ sơ
        </Button>
      </Stack>
    </StatusBanner>
  );
}

/** Danh sách thông tin còn thiếu, phải cập nhật xong mới làm được khảo sát. */
function DieuKienKhaoSat({ mucDo }: { mucDo: MucDoDayDu }) {
  return (
    <Stack gap="xs">
      <Text>Thầy/Cô cần hoàn thành cập nhật các thông tin sau trước khi bắt đầu làm khảo sát:</Text>
      <List size="sm">
        {mucDo.thieu.map((t) => (
          <List.Item key={t.field}>{nhanCuaTruong(t.field)}</List.Item>
        ))}
      </List>
      <Button component={Link} to="/toi/ho-so" variant="default" mt="xs">
        Cập nhật thông tin hồ sơ
      </Button>
    </Stack>
  );
}

function KhoiKhaoSatDauVao({ mucDo, cauHinh }: { mucDo: MucDoDayDu; cauHinh: CauHinhTrienKhai }) {
  // SSO hoặc mục M6 đang bật -> làm qua M6; còn lại (kênh VLE, chỉ dùng phiếu ngoài) -> mở thẳng phiếu.
  const quaM6 = cauHinh.kenhDanhGia === 'sso' || cauHinh.danhGiaDauVaoTrongCong;
  return (
    <StatusBanner loai={mucDo.day_du ? 'success' : 'warning'} tieuDe="Khảo sát đầu vào đã mở">
      {mucDo.day_du ? (
        <Stack gap="xs">
          <Text>Hồ sơ đã đầy đủ. Thầy/Cô có thể bắt đầu làm khảo sát đầu vào.</Text>
          {cauHinh.kenhDanhGia === 'sso' && <TomTatKhaoSat loai={['khao-sat', 'danh-gia']} />}
          {quaM6 ? (
            <Button component={Link} to="/toi/danh-gia-dau-vao" mt="xs">
              Làm khảo sát đầu vào
            </Button>
          ) : (
            <DanhSachPhieu phieu={cauHinh.phieu} />
          )}
        </Stack>
      ) : (
        <DieuKienKhaoSat mucDo={mucDo} />
      )}
    </StatusBanner>
  );
}

/** Tình hình từng bài trên hệ thống khảo sát (2026-10-04). Lỗi/đang tải -> không hiện gì (không chặn nút làm bài). */
function TomTatKhaoSat({ loai }: { loai: SsoTarget[] }) {
  const { data } = useTinhTrangKhaoSat();
  if (!data) return null;
  return (
    <Stack gap={6} mt={4} aria-label="Tình hình làm khảo sát">
      {loai.map((l) => {
        const tt = data.find((t) => t.loai === l);
        if (!tt) return null;
        const badge = nhanTrangThaiKhaoSat(tt.trang_thai, tt.can_kiem_tra);
        return (
          <Group key={l} gap="xs" wrap="nowrap" justify="space-between">
            <Text size="sm">{TEN_BAI_KHAO_SAT[l]}</Text>
            <Badge color={badge.mau} variant="light" style={{ flexShrink: 0 }}>
              {tt.trang_thai === 'hoan_thanh' && tt.muc ? `${badge.nhan} · ${NHAN_MUC_NANG_LUC[tt.muc]}` : badge.nhan}
            </Badge>
          </Group>
        );
      })}
    </Stack>
  );
}

/** Phiếu ngoài theo thứ tự làm; mở cùng tab (trình duyệt nhúng Zalo). Chưa có đường dẫn -> nút khóa. */
function DanhSachPhieu({ phieu }: { phieu: CauHinhTrienKhai['phieu'] }) {
  return (
    <Stack gap="sm" mt="xs">
      {phieu.map((p, i) => (
        <Stack key={p.ten} gap={4}>
          <Text fw={700} size="sm">
            {i + 1}. {p.ten}
          </Text>
          {p.lienKet.map((lk) => {
            const href = chuanHoaLienKet(lk.url);
            return href ? (
              <Button key={lk.nhan} component="a" href={href}>
                {lk.nhan}
              </Button>
            ) : (
              <Button key={lk.nhan} disabled>
                Đường dẫn đang được cập nhật
              </Button>
            );
          })}
        </Stack>
      ))}
    </Stack>
  );
}

/** Đầu ra: bấm nút -> cấp mã SSO dùng 1 lần -> chuyển cùng tab (giống M6, không mở cửa sổ mới). */
function KhoiKhaoSatDauRa({ mucDo }: { mucDo: MucDoDayDu }) {
  const chuyen = useMutation({
    mutationFn: () => capMaSso('dau-ra'),
    onSuccess: ({ url }) => window.location.assign(url),
  });

  return (
    <StatusBanner loai={mucDo.day_du ? 'success' : 'warning'} tieuDe="Khảo sát đầu ra đã mở">
      {mucDo.day_du ? (
        <Stack gap="xs">
          <Text>Hồ sơ đã đầy đủ. Thầy/Cô có thể bắt đầu làm khảo sát đầu ra.</Text>
          <TomTatKhaoSat loai={['dau-ra']} />
          {chuyen.isError && <Text c="red">{thongDiepLoiChung(chuyen.error)}</Text>}
          <Button mt="xs" loading={chuyen.isPending} onClick={() => chuyen.mutate()}>
            Làm khảo sát đầu ra
          </Button>
        </Stack>
      ) : (
        <DieuKienKhaoSat mucDo={mucDo} />
      )}
    </StatusBanner>
  );
}
