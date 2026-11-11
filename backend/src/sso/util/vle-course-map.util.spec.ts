import { parseVleCourseMap } from './vle-course-map.util';

describe('parseVleCourseMap', () => {
  it('rỗng/undefined -> map rỗng, không cảnh báo', () => {
    expect(parseVleCourseMap(undefined)).toEqual({ map: {}, canhBao: [] });
    expect(parseVleCourseMap('')).toEqual({ map: {}, canhBao: [] });
    expect(parseVleCourseMap('   ')).toEqual({ map: {}, canhBao: [] });
  });

  it('hợp lệ -> map đủ 3 mức', () => {
    const { map, canhBao } = parseVleCourseMap('co_ban:12,thanh_thao:13,nang_cao:14');
    expect(map).toEqual({ co_ban: 12, thanh_thao: 13, nang_cao: 14 });
    expect(canhBao).toEqual([]);
  });

  it('khoảng trắng dư quanh dấu : và , không gây lỗi', () => {
    const { map, canhBao } = parseVleCourseMap(' co_ban : 12 , thanh_thao:13 ,');
    expect(map).toEqual({ co_ban: 12, thanh_thao: 13 });
    expect(canhBao).toEqual([]);
  });

  it('mức lạ / id không phải số nguyên dương -> bỏ qua mục đó, các mục hợp lệ khác vẫn nhận + có cảnh báo', () => {
    const { map, canhBao } = parseVleCourseMap('co_ban:12,muc_la:99,thanh_thao:abc,nang_cao:0,nang_cao:14');
    expect(map).toEqual({ co_ban: 12, nang_cao: 14 });
    expect(canhBao).toHaveLength(3);
  });

  it('toàn bộ chuỗi rác -> map rỗng, mỗi mục rác đều có cảnh báo riêng', () => {
    const { map, canhBao } = parseVleCourseMap('rac1,rac2:abc');
    expect(map).toEqual({});
    expect(canhBao).toHaveLength(2);
  });
});
