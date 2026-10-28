import type { SongResult } from '../../../../types';
import type { SubsonicSong } from '../../../../types/navidrome';
import type { NavidromeGridViewCollectionDescriptor } from '../collection.contract';
import type { NavidromeSongListType } from '../navidromeSongLists';
import { getNavidromeConfig, navidromeApi } from '../../../../services/navidromeService';
import { buildNavidromeQueue } from '../../../../services/playbackAdapters';
import { DEFAULT_SECTION_TRACK_LIMIT, useNavidromeUiSettingsStore } from '../../../../stores/useNavidromeUiSettingsStore';

// src/library/core/collection/resource/navidromeCollectionTracks.service.ts
// Navidrome 集合的曲目：按集合类型调用对应的 Subsonic 接口，再统一转成播放用的歌曲。
// 原在 components/app/home/gridViewCollectionAdapters.ts，资源层在 services 里，不能反向依赖组件目录。

/** 当前 Navidrome 服务器的作用域：换服务器或换账号时，同 id 的集合不是同一份数据。 */
export const resolveNavidromeServerScope = (): string => {
    const config = getNavidromeConfig();
    return config ? `${config.serverUrl}|${config.username}` : '';
};

/** 「最近加入 / 最近播放 / 最多播放」摊平成曲目列表时最多取多少张专辑，避免签一长串 getAlbum 请求。 */
export const NAVIDROME_RECENT_TRACK_ALBUMS = 120;

const toTimestamp = (value?: string): number => {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/** 这三个集合的固定排序：入库时间 / 最近播放时间 / 播放次数，都是倒序；缺失的排最后。 */
export const compareNavidromeSectionSongs = (type: NavidromeSongListType, left: SubsonicSong, right: SubsonicSong): number => {
    if (type === 'recently-added') return toTimestamp(right.created) - toTimestamp(left.created);
    if (type === 'recently-played') return toTimestamp(right.played) - toTimestamp(left.played);
    return (right.playCount ?? 0) - (left.playCount ?? 0);
};

/** 「单曲列表最多显示」（设置里可改，默认 100、最小 1）；「曲目」（全部曲目）不受它限制。 */
export const resolveNavidromeSectionTrackLimit = (): number => {
    const limit = useNavidromeUiSettingsStore.getState().sectionTrackLimit;
    return Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : DEFAULT_SECTION_TRACK_LIMIT;
};

// Loads Navidrome tracks for GridView without moving Navidrome service logic into GridView itself.
// `failed` says that a read brought nothing back (the service answers nothing for such a read,
// it does not throw), or that no server is set up to read from: the tracks are then not the
// whole collection. An artist's tracks may still be those of the albums that were read.
export const resolveNavidromeGridViewTracks = async (
    descriptor: NavidromeGridViewCollectionDescriptor
): Promise<{ tracks: SongResult[]; failed: boolean }> => {
    const config = getNavidromeConfig();
    if (!config) {
        return { tracks: [], failed: true };
    }

    let subsonicSongs: SubsonicSong[] = [];
    let failed = false;

    if (descriptor.type === 'songs') {
        const songs = await navidromeApi.getAllSongs(config);
        failed = songs.length === 0;
        subsonicSongs = songs;
    } else if (descriptor.type === 'recently-added' || descriptor.type === 'recently-played' || descriptor.type === 'most-played') {
        // Subsonic 只有专辑级的 newest / recent / frequent：取最近的一批专辑，再摊平成歌曲列表。
        const songListType: NavidromeSongListType = descriptor.type;
        const albumType = songListType === 'recently-added'
            ? 'newest'
            : songListType === 'recently-played' ? 'recent' : 'frequent';
        const albums = await navidromeApi.getAlbumList2(config, albumType, NAVIDROME_RECENT_TRACK_ALBUMS);
        const albumResults = await Promise.all(albums.map(album => navidromeApi.getAlbum(config, album.id)));
        failed = albums.length > 0 && albumResults.every(album => !album);
        // 这三个分区按歌曲自己的字段固定排序（专辑级顺序只反映专辑）：最近加入＝入库时间、最近播放＝最近播放时间、
        // 最多播放＝播放次数，都是倒序；再按设置里的「单曲列表最多显示」截断。
        subsonicSongs = albumResults
            .flatMap(album => album?.song || [])
            .sort((left, right) => compareNavidromeSectionSongs(songListType, left, right))
            .slice(0, resolveNavidromeSectionTrackLimit());
    } else if (descriptor.type === 'album') {
        const albumDetail = await navidromeApi.getAlbum(config, descriptor.id);
        failed = !albumDetail;
        subsonicSongs = albumDetail?.song || [];
    } else if (descriptor.type === 'playlist') {
        const playlistDetail = await navidromeApi.getPlaylist(config, descriptor.id);
        failed = !playlistDetail;
        subsonicSongs = playlistDetail?.entry || [];
    } else if (descriptor.type === 'artist') {
        const artistDetail = await navidromeApi.getArtist(config, descriptor.id);
        const albums = artistDetail?.album || [];
        const albumResults = await Promise.all(albums.map(album => navidromeApi.getAlbum(config, album.id)));
        failed = !artistDetail || albumResults.some(album => !album);
        subsonicSongs = albumResults.flatMap(album => album?.song || []);
    } else if (descriptor.type === 'random') {
        const songs = await navidromeApi.getRandomSongs(config, 100);
        failed = !songs;
        subsonicSongs = songs ?? [];
    } else if (descriptor.type === 'favorites') {
        const songs = await navidromeApi.getStarred2(config);
        failed = !songs;
        subsonicSongs = songs ?? [];
    }

    const navidromeSongs = subsonicSongs.map(song => navidromeApi.toNavidromeSong(config, song));
    return { tracks: buildNavidromeQueue(navidromeSongs), failed };
};
