import type { SongResult } from '../types';
import { isNavidromeSong } from '../types/navidrome';
import { getSongArtistLabel } from '../services/onlineMusic/songMetadata';

// src/utils/trackSorting.ts
// 曲目列表的排序字段与比较器（Navidrome / 在线集合的曲目列表用）。
// feishin 的曲目排序精神：字段 + 方向，名称/艺术家/专辑等按文本比较，时间与计数按数值比较。
// 本地文件夹列表仍走 utils/localSongSorting 那套（它认 filePath 等本地字段），这里不掺进去。

export type TrackSortField =
    | 'name'
    | 'artist'
    | 'album'
    | 'duration'
    | 'addedAt'
    | 'lastPlayed'
    | 'year'
    | 'playCount'
    | 'favorite';

export type TrackSortDirection = 'asc' | 'desc';

/** 排序菜单里字段的展示顺序。 */
export const TRACK_SORT_FIELDS: readonly TrackSortField[] = [
    'name',
    'artist',
    'album',
    'duration',
    'addedAt',
    'lastPlayed',
    'year',
    'playCount',
    'favorite',
];

/** 每个字段的默认方向：名称类升序，时间/计数类降序（新的、多的在前）。 */
export const TRACK_SORT_FIELD_DEFAULT_DIRECTION: Readonly<Record<TrackSortField, TrackSortDirection>> = {
    name: 'asc',
    artist: 'asc',
    album: 'asc',
    duration: 'asc',
    addedAt: 'desc',
    lastPlayed: 'desc',
    year: 'desc',
    playCount: 'desc',
    favorite: 'desc',
};

export const isTrackSortField = (value: unknown): value is TrackSortField => (
    typeof value === 'string' && (TRACK_SORT_FIELDS as readonly string[]).includes(value)
);

export const isTrackSortDirection = (value: unknown): value is TrackSortDirection => (
    value === 'asc' || value === 'desc'
);

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const compareText = (left: string, right: string): number => collator.compare(left, right);

const toTimestamp = (value?: string): number => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Navidrome 歌曲的元数据对象。
 *
 * 列表里的歌有两种形状：直接来自 toNavidromeSong 的（`navidromeData` 就是那份
 * {id, streamUrl, created, ...}），以及经 buildUnifiedNavidromeSong 统一后的（它把
 * `navidromeData` 设成了**整个 NavidromeSong**，真正的元数据在更深一层）。两种都要能读到，
 * 否则排序字段全部读到 undefined，几个字段就排出同一个顺序。
 */
type NavidromeSortMeta = {
    created?: string;
    played?: string;
    playCount?: number;
    year?: number;
    starred?: string;
};

const navidromeSortMeta = (song: SongResult): NavidromeSortMeta | null => {
    if (!isNavidromeSong(song)) return null;
    const outer = song.navidromeData as unknown as { navidromeData?: NavidromeSortMeta };
    return (outer?.navidromeData ?? (outer as unknown as NavidromeSortMeta)) ?? null;
};

const readAddedAt = (song: SongResult): number => toTimestamp(navidromeSortMeta(song)?.created);

const readLastPlayed = (song: SongResult): number => toTimestamp(navidromeSortMeta(song)?.played);

const readYear = (song: SongResult): number => navidromeSortMeta(song)?.year ?? 0;

const readPlayCount = (song: SongResult): number => navidromeSortMeta(song)?.playCount ?? 0;

const readFavorite = (song: SongResult): number => (navidromeSortMeta(song)?.starred ? 1 : 0);

const readArtist = (song: SongResult): string => getSongArtistLabel(song) || '';
const readAlbum = (song: SongResult): string => song.album?.name || '';

const compareByField = (left: SongResult, right: SongResult, field: TrackSortField): number => {
    switch (field) {
        case 'name': return compareText(left.name || '', right.name || '');
        case 'artist': return compareText(readArtist(left), readArtist(right)) || compareText(left.name || '', right.name || '');
        case 'album': return compareText(readAlbum(left), readAlbum(right)) || compareText(left.name || '', right.name || '');
        case 'duration': return (left.durationMs || 0) - (right.durationMs || 0);
        case 'addedAt': return readAddedAt(left) - readAddedAt(right);
        case 'lastPlayed': return readLastPlayed(left) - readLastPlayed(right);
        case 'year': return readYear(left) - readYear(right);
        case 'playCount': return readPlayCount(left) - readPlayCount(right);
        case 'favorite': return readFavorite(left) - readFavorite(right);
        default: return 0;
    }
};

/** 按字段与方向排序一份曲目列表；方向为降序时整体取反。稳定排序保持同一字段下的原有相对顺序。 */
export const sortTracks = <T extends SongResult>(
    songs: readonly T[],
    field: TrackSortField,
    direction: TrackSortDirection,
): T[] => {
    const sorted = [...songs].sort((left, right) => {
        const result = compareByField(left, right, field);
        return direction === 'desc' ? -result : result;
    });
    return sorted;
};

/** 当前列表顺序打乱（Fisher-Yates，原地副本），长按「播放全部」时用。 */
export const shuffleTracks = <T>(songs: readonly T[]): T[] => {
    const shuffled = [...songs];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};