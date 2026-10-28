import type { TFunction } from 'i18next';
import type { SubsonicAlbum, SubsonicArtist, SubsonicSong } from '../../../../types/navidrome';
import type { NavidromeGridViewCollectionType } from '../../collection/collection.contract';
import type { NavidromeSongListType } from '../../collection/navidromeSongLists';
import { isNavidromeSongListType } from '../../collection/navidromeSongLists';
import type { LibraryHomeCard, LibraryHomeListAction, LibraryNavidromeHomeData } from '../homeModel.contract';
import { createCoverPlaceholder, pickRandomSongCoverUrl } from '../../../../utils/coverPlaceholders';

// src/library/core/home/navidrome/navidromeHomeModel.ts
// Navidrome 页签的模型（原样搬自 NavidromeGrid3DView）：五个 section、各 section 的卡片（含两个虚拟歌单
// 「随机」「收藏」，现在带 isVirtual）、打开卡片时的集合类型、刷新动作。封面 URL 要带服务器鉴权参数，由调用方
// 注入（navidromeApi.getCoverArtUrl 绑好配置）；虚拟歌单的封面从歌曲里随机挑一张（与原先一样每次组装都重挑）。

export type NavidromeHomeSection = 'songs' | 'albums' | 'recently-added' | 'recently-played' | 'most-played' | 'playlists' | 'artists';

export const NAVIDROME_RANDOM_PLAYLIST_ID = '__navi_random__';
export const NAVIDROME_FAVORITES_PLAYLIST_ID = '__navi_favorites__';
/** 「曲目」菜单打开的全部曲目集合的虚拟 id。 */
export const NAVIDROME_ALL_SONGS_ID = '__navi_all_songs__';

/** section 的顺序与文案 key。 */
export const NAVIDROME_HOME_SECTIONS: readonly { key: NavidromeHomeSection; labelKey: string }[] = [
    { key: 'songs', labelKey: 'navidrome.tracks' },
    { key: 'albums', labelKey: 'navidrome.albums' },
    { key: 'recently-added', labelKey: 'navidrome.recentlyAdded' },
    { key: 'recently-played', labelKey: 'navidrome.recents' },
    { key: 'most-played', labelKey: 'navidrome.mostPlayed' },
    { key: 'playlists', labelKey: 'home.playlists' },
    { key: 'artists', labelKey: 'navidrome.artists' },
];

/**
 * 这个 section 点一下是直接进「曲目列表」而不是切换卡片墙：只有「曲目」（全部曲目）是这样——
 * 它没有自己的卡片墙。其余 section（含「按单曲列表显示」时的最近加入 / 最近播放 / 最多播放）都落在墙上，
 * 卡片条里最左那张是「全部」入口卡，点它才进全屏的曲目列表。
 */
export const isNavidromeTrackListSection = (section: NavidromeHomeSection): boolean => section === 'songs';

/** 曲目列表 section 那张虚拟卡的 id。 */
export const navidromeTrackListCardId = (section: NavidromeHomeSection): string => (
    section === 'songs' ? NAVIDROME_ALL_SONGS_ID : `${section}`
);

/** 歌曲卡的来源标记：点它是播放这首（按 index 到当前分区的歌曲列表里拿），而不是打开集合。 */
export type NavidromeSongCardRef = { kind: 'navidrome-song'; index: number };
export const isNavidromeSongCardRef = (value: unknown): value is NavidromeSongCardRef => (
    typeof value === 'object' && value !== null
    && (value as { kind?: unknown }).kind === 'navidrome-song'
    && typeof (value as { index?: unknown }).index === 'number'
);

/** 歌曲卡（「按单曲列表显示」的三个分区在墙上放的就是这些）。 */
export const buildNavidromeSongCards = (
    songs: readonly SubsonicSong[],
    coverArtUrl: NavidromeCoverArtUrl,
): LibraryHomeCard[] => songs.map((song, index) => ({
    id: song.id,
    name: song.title,
    coverUrl: song.coverArt ? coverArtUrl(song.coverArt, 300) : createCoverPlaceholder(song.title, 'playlist'),
    description: song.artist,
    raw: { kind: 'navidrome-song', index } satisfies NavidromeSongCardRef,
}));

export const DEFAULT_NAVIDROME_HOME_SECTION: NavidromeHomeSection = 'albums';

export const isNavidromeHomeSection = (value: unknown): value is NavidromeHomeSection => (
    NAVIDROME_HOME_SECTIONS.some(section => section.key === value)
);

export const navidromeSectionLabelKey = (section: NavidromeHomeSection): string => (
    NAVIDROME_HOME_SECTIONS.find(entry => entry.key === section)?.labelKey ?? 'navidrome.albums'
);

/** 列表为空时的文案 key。 */
export const navidromeSectionEmptyKey = (section: NavidromeHomeSection): string => (
    section === 'playlists'
        ? 'navidrome.noPlaylistsFound'
        : section === 'artists'
            ? 'navidrome.noArtistsFound'
            : section === 'songs'
                ? 'navidrome.noSongsFound'
                : 'navidrome.noAlbumsFound'
);

/** Navidrome 封面 id → URL（navidromeApi.getCoverArtUrl 绑好当前配置）。 */
export type NavidromeCoverArtUrl = (coverArtId: string, size?: number) => string;

/** 专辑卡（全部专辑、最近添加、最近播放共用）。专辑卡没有 type（不可隐藏）。 */
export const buildNavidromeAlbumCards = (albums: readonly SubsonicAlbum[], coverArtUrl: NavidromeCoverArtUrl): LibraryHomeCard[] => (
    albums.map(album => ({
        id: album.id,
        name: album.name,
        coverUrl: album.coverArt ? coverArtUrl(album.coverArt, 600) : createCoverPlaceholder(album.name, 'playlist'),
        description: album.artist,
        trackCount: album.songCount,
        albumArtist: album.artist,
        albumYear: album.year,
        albumGenre: album.genre,
        albumDuration: album.duration,
    }))
);

/** 歌单卡：用户自己的歌单在前（可编辑），然后是虚拟的「收藏」，最后是「随机音乐」。 */
export const buildNavidromePlaylistCards = (
    data: Pick<LibraryNavidromeHomeData, 'randomSongs' | 'favoriteSongs' | 'playlists'>,
    { t, coverArtUrl }: { t: TFunction; coverArtUrl: NavidromeCoverArtUrl },
): LibraryHomeCard[] => {
    const randomCover = pickRandomSongCoverUrl(data.randomSongs, coverArtUrl);
    const favoritesCover = pickRandomSongCoverUrl(data.favoriteSongs, coverArtUrl);
    return [
        // 用户自己的歌单最先。
        ...data.playlists.map(playlist => ({
            id: playlist.id,
            name: playlist.name,
            coverUrl: playlist.coverArt ? coverArtUrl(playlist.coverArt, 600) : createCoverPlaceholder(playlist.name, 'playlist'),
            description: playlist.owner || t('home.playlists'),
            trackCount: playlist.songCount,
            editable: true,
            type: 'playlist',
        })),
        // 然后是「收藏」。
        {
            id: NAVIDROME_FAVORITES_PLAYLIST_ID,
            name: t('navidrome.favorites') || 'Favorites',
            coverUrl: favoritesCover || createCoverPlaceholder(t('navidrome.favorites') || 'Favorites', 'playlist'),
            description: t('navidrome.favorites'),
            trackCount: data.favoriteSongs.length,
            type: 'playlist',
            isVirtual: true,
        },
        // 最后是「随机音乐」。
        {
            id: NAVIDROME_RANDOM_PLAYLIST_ID,
            name: t('navidrome.random') || 'Random',
            coverUrl: randomCover || createCoverPlaceholder(t('navidrome.random') || 'Random', 'playlist'),
            description: t('navidrome.randomDesc'),
            trackCount: data.randomSongs.length,
            type: 'playlist',
            isVirtual: true,
        },
    ];
};

/** 歌手卡（没有 type，不可隐藏）。 */
export const buildNavidromeArtistCards = (
    artists: readonly SubsonicArtist[],
    { t, coverArtUrl }: { t: TFunction; coverArtUrl: NavidromeCoverArtUrl },
): LibraryHomeCard[] => artists.map(artist => ({
    id: artist.id,
    name: artist.name,
    coverUrl: artist.coverArt
        ? coverArtUrl(artist.coverArt, 600)
        : artist.artistImageUrl || createCoverPlaceholder(artist.name, 'artist'),
    description: t('navidrome.artists'),
    trackCount: artist.albumCount,
}));

/** 曲目列表入口那张虚拟卡：点它进对应的曲目列表（「曲目」是全部歌曲；三个歌曲分区最左那张「全部」是各自的列表）。 */
export const buildNavidromeTrackListCard = (
    section: NavidromeHomeSection,
    { t }: { t: TFunction },
): LibraryHomeCard => ({
    id: navidromeTrackListCardId(section),
    // 「曲目」是全部歌曲；三个歌曲分区里这张卡是「全部」入口（看这个分区的完整列表），标题用「全部」、副标题是分区名。
    name: section === 'songs'
        ? (t('navidrome.allSongs') || 'All Songs')
        : (t('navidrome.viewAll') || 'All'),
    type: 'playlist',
    description: t(navidromeSectionLabelKey(section)),
    isVirtual: true,
});

/**
 * 某个 section 的卡片。`asTracks` 时「最近加入 / 最近播放 / 最多播放」放的是歌曲卡（点一张即播这首）；
 * 要「到全部」（这个分区的全屏列表 / 地图）用页签行最左那张「全部」，「曲目」没有卡片墙。
 */
export const buildNavidromeSectionCards = (
    section: NavidromeHomeSection,
    data: LibraryNavidromeHomeData,
    deps: { t: TFunction; coverArtUrl: NavidromeCoverArtUrl },
    asTracks = false,
): LibraryHomeCard[] => {
    // 「曲目」是纯入口（点它直接进全部曲目），没有卡片墙。
    if (section === 'songs') return [];
    // 「按单曲列表显示」：这三个分区墙上放的是歌，不再另放「全部」卡（页签行最左那张「全部」就是入口）。
    if (asTracks && isNavidromeSongListType(section)) {
        return buildNavidromeSongCards(data.songLists[section], deps.coverArtUrl);
    }
    switch (section) {
        case 'albums': return buildNavidromeAlbumCards(data.albums, deps.coverArtUrl);
        case 'recently-added': return buildNavidromeAlbumCards(data.recentlyAddedAlbums, deps.coverArtUrl);
        case 'recently-played': return buildNavidromeAlbumCards(data.recentlyPlayedAlbums, deps.coverArtUrl);
        case 'most-played': return buildNavidromeAlbumCards(data.mostPlayedAlbums, deps.coverArtUrl);
        case 'playlists': return buildNavidromePlaylistCards(data, deps);
        case 'artists': return buildNavidromeArtistCards(data.artists, deps);
    }
    return [];
};

/**
 * 打开卡片时的集合类型：「曲目」是曲目集合；`asTracks` 时「最近加入 / 最近播放 / 最多播放」各自的曲目集合，
 * 否则是 album；歌手是 artist；歌单里两个虚拟歌单各有类型。
 */
export const resolveNavidromeCollectionType = (
    section: NavidromeHomeSection,
    cardId: string | number,
    asTracks = false,
): NavidromeGridViewCollectionType => {
    if (section === 'songs') return 'songs';
    if (asTracks && (section === 'recently-added' || section === 'recently-played' || section === 'most-played')) return section;
    if (section === 'albums' || section === 'recently-added' || section === 'recently-played' || section === 'most-played') return 'album';
    if (section === 'artists') return 'artist';
    if (cardId === NAVIDROME_RANDOM_PLAYLIST_ID) return 'random';
    if (cardId === NAVIDROME_FAVORITES_PLAYLIST_ID) return 'favorites';
    return 'playlist';
};

/** Navidrome 页签右上角的刷新（读取中禁用）。 */
export const resolveNavidromeHomeActions = (isLoading: boolean): LibraryHomeListAction[] => [{
    id: 'refresh',
    labelKey: 'options.audioOutputRefresh',
    fallbackLabel: 'Refresh',
    pending: isLoading,
    disabled: isLoading,
}];

/** 「按单曲列表显示」的三个分区各自的歌曲（关闭时为空）。 */
export const EMPTY_NAVIDROME_SONG_LISTS: Record<NavidromeSongListType, SubsonicSong[]> = Object.freeze({
    'recently-added': [],
    'recently-played': [],
    'most-played': [],
}) as Record<NavidromeSongListType, SubsonicSong[]>;

export const EMPTY_NAVIDROME_HOME_DATA: LibraryNavidromeHomeData = Object.freeze({
    albums: [],
    recentlyAddedAlbums: [],
    recentlyPlayedAlbums: [],
    mostPlayedAlbums: [],
    playlists: [],
    artists: [],
    randomSongs: [],
    favoriteSongs: [],
    songLists: EMPTY_NAVIDROME_SONG_LISTS,
}) as LibraryNavidromeHomeData;
