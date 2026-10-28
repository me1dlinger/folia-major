import type { SongResult } from '../../../../types';
import type { SubsonicSong } from '../../../../types/navidrome';
import type { NavidromeGridViewCollectionDescriptor } from '../collection.contract';
import type { NavidromeSongListType } from '../navidromeSongLists';
import { compareNavidromeSongListSongs, pickNavidromeSongListAlbums } from '../navidromeSongLists';
import { getNavidromeConfig, navidromeApi } from '../../../../services/navidromeService';
import { buildNavidromeQueue } from '../../../../services/playbackAdapters';
import { readNavidromeSectionTrackLimit } from '../../../../stores/useNavidromeUiSettingsStore';

// src/library/core/collection/resource/navidromeCollectionTracks.service.ts
// Navidrome 集合的曲目：按集合类型调用对应的 Subsonic 接口，再统一转成播放用的歌曲。
// 原在 components/app/home/gridViewCollectionAdapters.ts，资源层在 services 里，不能反向依赖组件目录。

/** 当前 Navidrome 服务器的作用域：换服务器或换账号时，同 id 的集合不是同一份数据。 */
export const resolveNavidromeServerScope = (): string => {
    const config = getNavidromeConfig();
    return config ? `${config.serverUrl}|${config.username}` : '';
};

/** 「最近加入 / 最近播放 / 最多播放」摊平成曲目列表时要读哪个专辑列表。 */
export const resolveNavidromeSongListAlbumType = (type: NavidromeSongListType): 'newest' | 'recent' | 'frequent' => (
    type === 'recently-added' ? 'newest' : type === 'recently-played' ? 'recent' : 'frequent'
);

/** 这三个集合一次向服务器要多少张专辑（摊平前先按歌曲数挑几张，见 pickNavidromeSongListAlbums）。 */
export const NAVIDROME_RECENT_TRACK_ALBUMS = 120;

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
        // Subsonic 只有专辑级的 newest / recent / frequent：取最近的一批专辑，挑几张摊平成歌曲列表。
        const songListType: NavidromeSongListType = descriptor.type;
        const limit = readNavidromeSectionTrackLimit();
        const albums = await navidromeApi.getAlbumList2(config, resolveNavidromeSongListAlbumType(songListType), NAVIDROME_RECENT_TRACK_ALBUMS);
        const wanted = pickNavidromeSongListAlbums(albums, limit);
        const albumResults = await Promise.all(wanted.map(album => navidromeApi.getAlbum(config, album.id)));
        failed = wanted.length > 0 && albumResults.every(album => !album);
        // 按歌曲自己的字段固定排序（专辑级顺序只反映专辑），再按「单曲列表最多显示」截断。
        subsonicSongs = albumResults
            .flatMap(album => album?.song || [])
            .sort((left, right) => compareNavidromeSongListSongs(songListType, left, right))
            .slice(0, limit);
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
