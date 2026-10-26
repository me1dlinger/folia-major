import { describe, expect, it } from 'vitest';
import type { SongResult } from '../../../src/types';
import { sortTracks, shuffleTracks } from '../../../src/utils/trackSorting';

// test/unit/utils/trackSorting.test.ts
// 曲目排序的比较器：锁住两种 Navidrome 歌曲形状下元数据字段都真的读到。
// 统一后的歌（buildUnifiedNavidromeSong）把 navidromeData 设成整个 NavidromeSong，
// 元数据在更深一层；直接来自 toNavidromeSong 的元数据就在 navidromeData 上。
// 两种都要能读到，否则「添加时间 / 最近播放 / 年份 / 播放次数 / 收藏」会全读到 undefined、
// 排出同一个顺序（这正是之前线上「排序没反应」的原因）。

const base = { artists: [{ id: 0, name: 'A' }], album: { id: 0, name: 'Alb' }, durationMs: 1000 } as const;

/** 直接来自 toNavidromeSong 的形状：navidromeData 就是元数据。 */
const rawSong = (id: number, meta: Record<string, unknown>): SongResult => ({
    ...base,
    id,
    name: `Song ${id}`,
    isNavidrome: true,
    navidromeData: { id: `n-${id}`, streamUrl: '', path: '', suffix: 'mp3', ...meta },
} as unknown as SongResult);

/** 统一后的形状：navidromeData 是整个 NavidromeSong，元数据在 navidromeData.navidromeData。 */
const unifiedSong = (id: number, meta: Record<string, unknown>): SongResult => ({
    ...base,
    id,
    name: `Song ${id}`,
    isNavidrome: true,
    navidromeData: { isNavidrome: true, navidromeData: { id: `n-${id}`, streamUrl: '', path: '', suffix: 'mp3', ...meta } },
} as unknown as SongResult);

const metaFor = (id: number) => ({
    created: `2024-01-0${id}T00:00:00Z`,
    played: `2025-02-0${(10 - id)}T00:00:00Z`,
    playCount: id * 10,
    year: 2000 + id,
    starred: id >= 3 ? '2025-01-01T00:00:00Z' : undefined,
});

describe.each([
    ['raw navidromeData', rawSong],
    ['unified navidromeData', unifiedSong],
] as const)('sortTracks on %s', (_label, make) => {
    const songs = [make(1, metaFor(1)), make(2, metaFor(2)), make(3, metaFor(3))];

    it('orders by date added', () => {
        expect(sortTracks(songs, 'addedAt', 'desc').map(s => s.id)).toEqual([3, 2, 1]);
        expect(sortTracks(songs, 'addedAt', 'asc').map(s => s.id)).toEqual([1, 2, 3]);
    });

    it('orders by play count, last played, year and favorite', () => {
        expect(sortTracks(songs, 'playCount', 'desc').map(s => s.id)).toEqual([3, 2, 1]);
        // played 随 id 增大而更早，降序即 id 小的在前。
        expect(sortTracks(songs, 'lastPlayed', 'desc').map(s => s.id)).toEqual([1, 2, 3]);
        expect(sortTracks(songs, 'year', 'asc').map(s => s.id)).toEqual([1, 2, 3]);
        expect(sortTracks(songs, 'favorite', 'desc').map(s => s.id)).toEqual([3, 1, 2]);
    });

    it('gives different orders for different metadata fields', () => {
        const byName = sortTracks(songs, 'name', 'asc').map(s => s.id);
        const byAdded = sortTracks(songs, 'addedAt', 'desc').map(s => s.id);
        expect(byName).not.toEqual(byAdded);
    });
});

describe('shuffleTracks', () => {
    it('keeps the same members', () => {
        const input = [1, 2, 3, 4, 5];
        expect([...shuffleTracks(input)].sort()).toEqual(input);
    });
});