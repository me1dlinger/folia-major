// src/library/core/collection/navidromeSongLists.ts
// 「最近加入 / 最近播放 / 最多播放」这三个 Navidrome 集合的判定：Subsonic 只有专辑级的 newest / recent / frequent，
// 打开时把最近的一批专辑摊平成歌曲列表，顺序由固定规则决定（入库时间 / 最近播放时间 / 播放次数，都是倒序），
// 不给用户手动切换。纯规则放这里，资源层（navidromeCollectionTracks.service）与三套 suite 的集合视图都读它
// —— suite 不直接依赖 core 的 service（见 docs/CODEMAP.md 的依赖方向）。

export type NavidromeSongListType = 'recently-added' | 'recently-played' | 'most-played';

export const NAVIDROME_SONG_LIST_TYPES: readonly NavidromeSongListType[] = [
    'recently-added',
    'recently-played',
    'most-played',
];

/** 这个集合类型是不是「按单曲列表显示」的三个之一（顺序固定、不给手动排序）。 */
export const isNavidromeSongListType = (value: unknown): value is NavidromeSongListType => (
    typeof value === 'string' && (NAVIDROME_SONG_LIST_TYPES as readonly string[]).includes(value)
);