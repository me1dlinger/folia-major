import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubsonicSong } from '@/types/navidrome';
import type { NavidromeGridViewCollectionDescriptor, NavidromeGridViewCollectionType } from '@/library/core/collection/collection.contract';

// test/unit/library/core/navidromeSongLists.test.ts
// 「最近加入 / 最近播放 / 最多播放」：Subsonic 只有专辑级排序，打开时把专辑摊平成歌曲，按固定规则排（入库时间 /
// 最近播放时间 / 播放次数，倒序），并按设置里的「单曲列表最多显示」截断。

const albums: Record<string, SubsonicSong[]> = {};

vi.mock('@/services/navidromeService', () => ({
    getNavidromeConfig: () => ({ serverUrl: 'http://server', username: 'u', passwordHash: 'h' }),
    navidromeApi: {
        getAlbumList2: vi.fn(async () => [{ id: 'al-1' }, { id: 'al-2' }]),
        getAlbum: vi.fn(async (_config: unknown, id: string) => ({ id, song: albums[id] ?? [] })),
        toNavidromeSong: (_config: unknown, song: SubsonicSong) => song,
    },
}));
vi.mock('@/services/playbackAdapters', () => ({
    buildNavidromeQueue: (songs: SubsonicSong[]) => songs,
}));

import { navidromeApi } from '@/services/navidromeService';
import {
    resolveNavidromeGridViewTracks,
} from '@/library/core/collection/resource/navidromeCollectionTracks.service';
import {
    compareNavidromeSongListSongs,
    isNavidromeSongListType,
    NAVIDROME_SONG_LIST_MAX_ALBUMS,
    pickNavidromeSongListAlbums,
} from '@/library/core/collection/navidromeSongLists';
import { DEFAULT_SECTION_TRACK_LIMIT, readNavidromeSectionTrackLimit, useNavidromeUiSettingsStore } from '@/stores/useNavidromeUiSettingsStore';

const song = (id: string, overrides: Partial<SubsonicSong> = {}): SubsonicSong => ({
    id,
    isDir: false,
    title: id,
    album: 'A',
    artist: 'B',
    size: 1,
    contentType: 'audio/mpeg',
    suffix: 'mp3',
    duration: 1,
    path: id,
    created: '2020-01-01T00:00:00.000Z',
    albumId: 'al-1',
    artistId: 'ar-1',
    type: 'music',
    isVideo: false,
    ...overrides,
});

const descriptor = (type: NavidromeGridViewCollectionType): NavidromeGridViewCollectionDescriptor => ({
    source: 'navidrome',
    id: 'x',
    name: 'X',
    type,
});

describe('navidrome song lists', () => {
    beforeEach(() => {
        Object.keys(albums).forEach(key => delete albums[key]);
        useNavidromeUiSettingsStore.getState().handleSetSectionTrackLimit(DEFAULT_SECTION_TRACK_LIMIT);
        vi.mocked(navidromeApi.getAlbumList2).mockClear();
    });

    it('recognises only the three song-list types', () => {
        expect(isNavidromeSongListType('recently-added')).toBe(true);
        expect(isNavidromeSongListType('recently-played')).toBe(true);
        expect(isNavidromeSongListType('most-played')).toBe(true);
        expect(isNavidromeSongListType('album')).toBe(false);
        expect(isNavidromeSongListType(undefined)).toBe(false);
    });

    it('orders by the fixed rule of each list, missing values last', () => {
        const older = song('older', { created: '2020-01-01T00:00:00.000Z' });
        const newer = song('newer', { created: '2024-01-01T00:00:00.000Z' });
        expect([older, newer].sort((a, b) => compareNavidromeSongListSongs('recently-added', a, b)).map(s => s.id)).toEqual(['newer', 'older']);

        const neverPlayed = song('never');
        const playedLate = song('late', { played: '2025-01-01T00:00:00.000Z' });
        expect([neverPlayed, playedLate].sort((a, b) => compareNavidromeSongListSongs('recently-played', a, b)).map(s => s.id)).toEqual(['late', 'never']);

        const few = song('few', { playCount: 1 });
        const many = song('many', { playCount: 9 });
        expect([few, many].sort((a, b) => compareNavidromeSongListSongs('most-played', a, b)).map(s => s.id)).toEqual(['many', 'few']);
    });

    it('picks only as many albums as the limit needs, up to a maximum', () => {
        const albums = Array.from({ length: 10 }, (_, index) => ({ id: `al-${index}`, songCount: 8 }));
        expect(pickNavidromeSongListAlbums(albums, 20).map(album => album.id)).toEqual(['al-0', 'al-1', 'al-2']);
        expect(pickNavidromeSongListAlbums(albums, 1)).toHaveLength(1);
        // 歌曲数缺失时不提前停，但到上限就停。
        const unknown = Array.from({ length: NAVIDROME_SONG_LIST_MAX_ALBUMS + 10 }, (_, index) => ({ id: `x-${index}`, songCount: undefined }));
        expect(pickNavidromeSongListAlbums(unknown, 10)).toHaveLength(NAVIDROME_SONG_LIST_MAX_ALBUMS);
        expect(readNavidromeSectionTrackLimit()).toBe(DEFAULT_SECTION_TRACK_LIMIT);
    });

    it('flattens the albums of most-played, sorts by play count and cuts at the limit', async () => {
        albums['al-1'] = [song('a', { playCount: 3 }), song('b', { playCount: 8 })];
        albums['al-2'] = [song('c', { playCount: 5 }), song('d', { playCount: 1 })];
        useNavidromeUiSettingsStore.getState().handleSetSectionTrackLimit(2);

        const { tracks, failed } = await resolveNavidromeGridViewTracks(descriptor('most-played'));

        expect(failed).toBe(false);
        expect(tracks.map(track => track.id)).toEqual(['b', 'c']);
        // 专辑级顺序用 frequent（专辑的总播放次数）。
        expect(navidromeApi.getAlbumList2).toHaveBeenCalledWith(expect.anything(), 'frequent', expect.any(Number));
    });

    it('gives the newest-added list the server newest albums, newest song first', async () => {
        albums['al-1'] = [song('old', { created: '2020-01-01T00:00:00.000Z' })];
        albums['al-2'] = [song('new', { created: '2024-01-01T00:00:00.000Z' })];

        const { tracks } = await resolveNavidromeGridViewTracks(descriptor('recently-added'));

        expect(tracks.map(track => track.id)).toEqual(['new', 'old']);
        expect(navidromeApi.getAlbumList2).toHaveBeenCalledWith(expect.anything(), 'newest', expect.any(Number));
    });
});