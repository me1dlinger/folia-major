import type { SubsonicSong } from '../../../types/navidrome';
import type { NavidromeSongListType } from './collection.contract';

// src/library/core/collection/navidromeSongLists.ts
// 「最近加入 / 最近播放 / 最多播放」这三个 Navidrome 集合的判定与固定排序：Subsonic 只有专辑级的
// newest / recent / frequent，这两个分区要按单曲展示时，把最近的一批专辑摊平成歌曲列表，顺序由固定规则决定
// （入库时间 / 最近播放时间 / 播放次数，都是倒序），不给用户手动切换。
// 纯规则放这里：首页概览的读取（core/home/navidrome/navidromeHomeLibrary.service）、集合的曲目读取
// （core/collection/resource/navidromeCollectionTracks.service）与三套 suite 的集合视图都读它
// —— suite 不直接依赖 core 的 service（见 docs/CODEMAP.md 的依赖方向）。
// 类型本身在 collection.contract（契约只许引用契约与 src/types，见 layerBoundaries 测试）。

export type { NavidromeSongListType } from './collection.contract';

export const NAVIDROME_SONG_LIST_TYPES: readonly NavidromeSongListType[] = [
    'recently-added',
    'recently-played',
    'most-played',
];

/** 这个集合类型是不是「按单曲列表显示」的三个之一（顺序固定、不给手动排序）。 */
export const isNavidromeSongListType = (value: unknown): value is NavidromeSongListType => (
    typeof value === 'string' && (NAVIDROME_SONG_LIST_TYPES as readonly string[]).includes(value)
);

const toTimestamp = (value?: string): number => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/** 这三个列表的固定排序：入库时间 / 最近播放时间 / 播放次数，都是倒序；缺失的排最后。 */
export const compareNavidromeSongListSongs = (type: NavidromeSongListType, left: SubsonicSong, right: SubsonicSong): number => {
    if (type === 'recently-added') return toTimestamp(right.created) - toTimestamp(left.created);
    if (type === 'recently-played') return toTimestamp(right.played) - toTimestamp(left.played);
    return (right.playCount ?? 0) - (left.playCount ?? 0);
};

/** 摊平成歌曲列表时最多看多少张专辑（避免签一长串 getAlbum 请求）。 */
export const NAVIDROME_SONG_LIST_MAX_ALBUMS = 60;

/**
 * 从服务器给的专辑顺序里挑出要摊平的：按顺序累计专辑的歌曲数，累计到 limit 就停
 * （最多 NAVIDROME_SONG_LIST_MAX_ALBUMS 张，歌曲数缺失时不提前停）。
 */
export const pickNavidromeSongListAlbums = <T extends { songCount?: number }>(albums: readonly T[], limit: number): T[] => {
    const chosen: T[] = [];
    let expected = 0;
    for (const album of albums) {
        if (chosen.length >= NAVIDROME_SONG_LIST_MAX_ALBUMS || expected >= limit) break;
        chosen.push(album);
        expected += Math.max(album.songCount ?? 0, 0);
    }
    return chosen;
};