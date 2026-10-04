import { Badge, Box, Button, Card, Center, Container, Group, List, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { capMaSso, useDotXacNhan, useHoSoToi, useKhoaHocToi, useMucDoDayDu, type SsoTarget } from '@/api/hocVien';
import { useTinhTrangKhaoSat } from '@/api/ketQuaKhaoSat';
import type { HocVien, KhoaHocDangKy, MucDoDayDu, MucNangLuc } from '@/api/types';
import { useCauHinhTrienKhai, type CauHinhTrienKhai } from '@/content/trienKhai';
import { chuanHoaLienKet } from '@/lib/lienKet';
import { dinhDangNgayGio } from '@/lib/ngay';
import { nhanCuaTruong } from '@/lib/nhanTruong';
import { NHAN_MUC_NANG_LUC, TEN_BAI_KHAO_SAT, nhanTrangThaiKhaoSat } from '@/lib/trangThaiKhaoSat';
import { thongDiepLoiChung } from '@/lib/loiApi';
import { StatusBanner } from '@/components/StatusBanner';
import { CountdownTimer } from '@/components/CountdownTimer';
import { nhanMucNangLuc } from '@/lib/mucNangLuc';
import { useCapNhatMoi, type CapNhatMoi } from './capNhatMoi';

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
  const { data: khoaHoc } = useKhoaHocToi();
  const capNhat = useCapNhatMoi(khoaHoc);
  const mucDauVao = khoaHoc?.find((dk) => dk.muc_dau_vao)?.muc_dau_vao ?? null;
  const mucDauRa = khoaHoc?.find((dk) => dk.muc_dau_ra)?.muc_dau_ra ?? null;

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
            <ThongBaoCapNhat capNhat={capNhat} />

            <Stack gap="sm">
              <Text fw={700} size="sm">
                Việc cần làm
              </Text>
              {mucDo && dauVaoMo && (
                <Box id="khao-sat-dau-vao">
                  <KhoiKhaoSatDauVao mucDo={mucDo} cauHinh={cauHinh} />
                </Box>
              )}
              {mucDo && dauRaMo && (
                <Box id="khao-sat-dau-ra">
                  <KhoiKhaoSatDauRa mucDo={mucDo} />
                </Box>
              )}
              <KhoiTrangThai data={data} />
            </Stack>

            <TheHuongDan />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TheChucNang
                bieuTuong="📄"
                tieuDe="Cập nhật hồ sơ"
                moTa="Xem và chỉnh sửa thông tin cá nhân"
                tt={{ loai: 'mo', toi: '/toi/ho-so' }}
              />
              <TheChucNang
                bieuTuong="🏫"
                tieuDe="Thông tin lớp học"
                moTa="Lịch học, địa điểm, kết quả đánh giá đầu vào"
                tt={{
                  loai: 'mo',
                  toi: '/toi/lop-hoc',
                  ghiChu: khoaHoc && !coLop(khoaHoc) ? 'Chưa có danh sách chia lớp' : undefined,
                }}
                moi={capNhat.ketQua.length > 0 || capNhat.phanLop.length > 0}
              />
              <TheChucNang
                bieuTuong="📝"
                tieuDe="Khảo sát đầu vào"
                moTa="Khảo sát kĩ năng số và đánh giá năng lực số trước khóa học"
                tt={trangThaiKhaoSat({
                  muc: mucDauVao,
                  daTai: daTaiCauHinh,
                  mo: dauVaoMo,
                  mucDo,
                  toi: laQuaM6(cauHinh) ? '/toi/danh-gia-dau-vao' : '#khao-sat-dau-vao',
                  lyDoChuaMo: 'Chưa mở. Thông báo sẽ hiện tại trang này khi khảo sát được mở.',
                })}
                moi={capNhat.ketQua.length > 0}
              />
              <TheChucNang
                bieuTuong="🎓"
                tieuDe="Đánh giá đầu ra"
                moTa="Đánh giá năng lực số sau khi hoàn thành khóa bồi dưỡng"
                tt={trangThaiKhaoSat({
                  muc: mucDauRa,
                  daTai: daTaiCauHinh,
                  mo: dauRaMo,
                  mucDo,
                  toi: '#khao-sat-dau-ra',
                  lyDoChuaMo: 'Chưa mở. Đánh giá đầu ra mở khi Thầy/Cô hoàn thành khóa bồi dưỡng.',
                })}
              />
            </SimpleGrid>
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

/** Trạng thái 1 thẻ chức năng: mở (bấm được), xong (đã có kết quả), khóa (mờ + lý do). */
type TrangThaiThe =
  | { loai: 'mo'; toi: string; ghiChu?: string }
  | { loai: 'xong'; toi: string; ghiChu: string }
  | { loai: 'khoa'; ghiChu?: string };

function coLop(ds: KhoaHocDangKy[]) {
  return ds.some((dk) => dk.giai_doan.some((gd) => gd.lop));
}

/** SSO hoặc mục M6 đang bật -> làm qua M6; còn lại (kênh VLE, chỉ dùng phiếu ngoài) -> mở thẳng phiếu. */
function laQuaM6(cauHinh: CauHinhTrienKhai) {
  return cauHinh.kenhDanhGia === 'sso' || cauHinh.danhGiaDauVaoTrongCong;
}

function trangThaiKhaoSat(p: {
  muc: MucNangLuc | null;
  daTai: boolean;
  mo: boolean;
  mucDo: MucDoDayDu | undefined;
  toi: string;
  lyDoChuaMo: string;
}): TrangThaiThe {
  if (p.muc) return { loai: 'xong', toi: '/toi/lop-hoc', ghiChu: `Đã có kết quả: Mức ${nhanMucNangLuc(p.muc)}` };
  // Chưa tải xong cấu hình / mức độ đầy đủ -> khóa không ghi chú, tránh chớp sai lý do.
  if (!p.daTai) return { loai: 'khoa' };
  if (!p.mo) return { loai: 'khoa', ghiChu: p.lyDoChuaMo };
  if (!p.mucDo) return { loai: 'khoa' };
  if (!p.mucDo.day_du) {
    return {
      loai: 'khoa',
      ghiChu: `Đã mở nhưng chưa kích hoạt được: Thầy/Cô cần cập nhật đủ ${p.mucDo.thieu.length} thông tin hồ sơ (xem mục Việc cần làm).`,
    };
  }
  return { loai: 'mo', toi: p.toi, ghiChu: 'Đã mở — bấm để bắt đầu' };
}

const MAU_GHI_CHU: Record<TrangThaiThe['loai'], string> = { mo: 'primary.6', xong: 'green.8', khoa: 'dimmed' };

function TheChucNang({
  bieuTuong,
  tieuDe,
  moTa,
  tt,
  moi = false,
}: {
  bieuTuong: string;
  tieuDe: string;
  moTa: string;
  tt: TrangThaiThe;
  moi?: boolean;
}) {
  const khoa = tt.loai === 'khoa';
  const noiDung = (
    <Group gap="md" wrap="nowrap" align="flex-start">
      <Text fz={28} lh={1} aria-hidden>
        {khoa ? '🔒' : bieuTuong}
      </Text>
      <Box>
        <Group gap="xs">
          <Text fw={700} c={khoa ? 'dimmed' : undefined}>
            {tieuDe}
          </Text>
          {moi && (
            <Badge color="red" size="sm">
              Mới
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          {moTa}
        </Text>
        {tt.ghiChu && (
          <Text size="xs" mt={4} fw={600} c={MAU_GHI_CHU[tt.loai]}>
            {tt.ghiChu}
          </Text>
        )}
      </Box>
    </Group>
  );
  const chung = { padding: 'lg', radius: 'md', withBorder: true } as const;

  if (tt.loai === 'khoa') {
    return (
      <Card {...chung} aria-disabled bg="gray.0" style={{ opacity: 0.7 }}>
        {noiDung}
      </Card>
    );
  }
  // Neo trong trang (#khao-sat-...) dùng thẻ a thường; route dùng Link của router.
  if (tt.toi.startsWith('#')) {
    return (
      <Card {...chung} component="a" href={tt.toi} style={{ textDecoration: 'none' }}>
        {noiDung}
      </Card>
    );
  }
  return (
    <Card {...chung} component={Link} to={tt.toi} style={{ textDecoration: 'none' }}>
      {noiDung}
    </Card>
  );
}

/** Chỉ hiện khi kết quả đánh giá / phân lớp khác lần xem trước — không có gì mới thì không chiếm chỗ. */
function ThongBaoCapNhat({ capNhat }: { capNhat: CapNhatMoi }) {
  const { ketQua, phanLop, danhDauDaXem } = capNhat;
  if (ketQua.length === 0 && phanLop.length === 0) return null;

  return (
    <StatusBanner loai="success" tieuDe="Có cập nhật mới">
      <Stack gap="xs">
        {ketQua.length > 0 && <DanhSachCapNhat tieuDe="Kết quả đánh giá đầu vào đã được cập nhật:" dong={ketQua} />}
        {phanLop.length > 0 && <DanhSachCapNhat tieuDe="Danh sách chia lớp đã được cập nhật:" dong={phanLop} />}
        <Group gap="xs" mt="xs">
          <Button component={Link} to="/toi/lop-hoc" onClick={danhDauDaXem}>
            Xem lớp học
          </Button>
          <Button variant="subtle" color="gray" onClick={danhDauDaXem}>
            Đã xem
          </Button>
        </Group>
      </Stack>
    </StatusBanner>
  );
}

function DanhSachCapNhat({ tieuDe, dong }: { tieuDe: string; dong: string[] }) {
  return (
    <Box>
      <Text size="sm">{tieuDe}</Text>
      <List size="sm">
        {dong.map((d) => (
          <List.Item key={d}>{d}</List.Item>
        ))}
      </List>
    </Box>
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
  const quaM6 = laQuaM6(cauHinh);
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
