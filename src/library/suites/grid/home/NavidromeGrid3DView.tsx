import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Disc3, ListMusic, Loader2, Music, RefreshCw, Settings2, Sparkles, TrendingUp, User } from 'lucide-react';
import DesktopGrid3DSurface, { DesktopGrid3DAction } from './DesktopGrid3DSurface';
import { Theme } from '../../../../types';
import type { GridViewCollectionDescriptor } from '../../../../components/app/home/gridViewCollectionAdapters';
import { useDebouncedFocusSync } from '../../../../hooks/useDebouncedFocusSync';
import type { LibraryHomeActionsController, LibraryHomeCard, LibraryHomeListState, LibraryNavidromeHomeResource } from '../../../core/home/homeModel.contract';
import type { LibraryDeclaredActions } from '../../../core/suite/suite.contract';
import { buildNavidromeTrackListCard, isNavidromeHomeSection, isNavidromeSongCardRef, isNavidromeTrackListSection, resolveNavidromeCollectionType, type NavidromeHomeSection } from '../../../core/home/navidrome/navidromeHomeModel';
import { useLibraryHomeNavidrome } from '../../../core/home/navidrome/useLibraryHomeNavidrome';
import { isNavidromeSongListType } from '../../../core/collection/navidromeSongLists';
import { useLibraryHomeListRegistration } from '../../../core/home/useLibraryHomeSurfaceRegistration';
import { useNavidromeUiSettingsStore } from '../../../../stores/useNavidromeUiSettingsStore';

// src/library/suites/grid/home/NavidromeGrid3DView.tsx
// Desktop-only Navidrome Grid3D overview that opens GridView instead of legacy collection views.
// 概览请求、section 记忆、卡片（含带 isVirtual 的「随机」「收藏」）与打开时的集合类型都来自 Library Core
// （core/home/navidrome/useLibraryHomeNavidrome、core/home/navidrome/navidromeHomeModel）；这里只剩图标与各 section 的焦点。

const SECTION_ICONS: Record<NavidromeHomeSection, React.ReactNode> = {
    songs: <Music size={13} />,
    albums: <Disc3 size={13} />,
    'recently-added': <Sparkles size={13} />,
    'recently-played': <Clock3 size={13} />,
    'most-played': <TrendingUp size={13} />,
    playlists: <ListMusic size={13} />,
    artists: <User size={13} />,
};

interface NavidromeGrid3DViewProps {
    focusedAlbumIndex: number;
    setFocusedAlbumIndex: (index: number) => void;
    onOpenSettings?: () => void;
    onOpenGridView?: (collection: GridViewCollectionDescriptor) => void;
    /** 首页动作控制器（打开卡片；宿主创建）。 */
    homeActions: LibraryHomeActionsController;
    /** Navidrome 概览（首页宿主持有，见 homeResources.navidromeOverview；换 suite 不重新请求）。 */
    overview: LibraryNavidromeHomeResource;
    /** 首页模型算好的目录会话 key（core/home/homeSources 的 resolveHomeDirectoryKey）。 */
    directoryKey: string;
    /** 网格 suite 声明的首页动作（交给 GridMap 的目录 surface 取交集）。 */
    declaredHomeActions?: LibraryDeclaredActions;
    theme: Theme;
    isDaylight: boolean;
    hasFloatingPlayer?: boolean;
    isInteractive?: boolean;
}

export const NavidromeGrid3DView: React.FC<NavidromeGrid3DViewProps> = ({
    focusedAlbumIndex,
    setFocusedAlbumIndex,
    onOpenSettings,
    onOpenGridView,
    homeActions,
    overview,
    directoryKey,
    declaredHomeActions,
    theme,
    isDaylight,
    hasFloatingPlayer = false,
    isInteractive = true,
}) => {
    const { t } = useTranslation();
    const [localAlbumIndex, setLocalAlbumIndex] = useDebouncedFocusSync(focusedAlbumIndex, setFocusedAlbumIndex);
    const [focusedPlaylistIndex, setFocusedPlaylistIndex] = useState(0);
    const [focusedArtistIndex, setFocusedArtistIndex] = useState(0);
    const [focusedRecentlyAddedIndex, setFocusedRecentlyAddedIndex] = useState(0);
    const [focusedRecentlyPlayedIndex, setFocusedRecentlyPlayedIndex] = useState(0);
    const [focusedSongsIndex, setFocusedSongsIndex] = useState(0);
    const [focusedMostPlayedIndex, setFocusedMostPlayedIndex] = useState(0);
    const navidrome = useLibraryHomeNavidrome(overview);
    const { config, section, setSection, isLoading } = navidrome;

    const focus: Record<NavidromeHomeSection, [number, (index: number) => void]> = {
        songs: [focusedSongsIndex, setFocusedSongsIndex],
        albums: [localAlbumIndex, setLocalAlbumIndex],
        'recently-added': [focusedRecentlyAddedIndex, setFocusedRecentlyAddedIndex],
        'recently-played': [focusedRecentlyPlayedIndex, setFocusedRecentlyPlayedIndex],
        'most-played': [focusedMostPlayedIndex, setFocusedMostPlayedIndex],
        playlists: [focusedPlaylistIndex, setFocusedPlaylistIndex],
        artists: [focusedArtistIndex, setFocusedArtistIndex],
    };
    const [focusedIndex, setFocusedIndex] = focus[section];
    // 「最近加入 / 最近播放 / 最多播放」在设置里可以改成单曲列表入口（见 useNavidromeUiSettingsStore）。
    const sectionsAsTracks = useNavidromeUiSettingsStore(state => state.sectionsAsTracks);

    // 曲目列表入口点一下直接进曲目列表；其余 section 只切换卡片墙。
    const openTrackListSection = (key: NavidromeHomeSection) => {
        const card = buildNavidromeTrackListCard(key, { t });
        homeActions.openNavidromeCard(
            card,
            resolveNavidromeCollectionType(key, card.id, sectionsAsTracks),
            collection => onOpenGridView?.(collection),
        );
    };
    // 「按单曲列表显示」的三个分区：墙上放的是歌，最左那张「全部」进的是这个分区自己的曲目列表
    // （与「曲目」进全部歌曲同一个集合页：右下角能点开列表，列表里有播放 / 播放全部（长按随机））。
    const openSongSectionList = () => {
        if (!sectionsAsTracks || !isNavidromeSongListType(section)) return false;
        openTrackListSection(section);
        return true;
    };

    const tabs: DesktopGrid3DAction[] = navidrome.sections.map(entry => ({
        id: entry.key,
        label: entry.label,
        icon: SECTION_ICONS[entry.key],
        active: entry.active,
        onClick: () => {
            // 「曲目」（全部曲目）没有卡片墙，只作为入口：点一下直接进曲目列表。
            if (isNavidromeTrackListSection(entry.key)) {
                openTrackListSection(entry.key);
                return;
            }
            setSection(entry.key);
        },
    }));

    const actions: DesktopGrid3DAction[] = navidrome.actions.map(action => ({
        id: action.id,
        label: t(action.labelKey) || action.fallbackLabel,
        icon: action.pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />,
        disabled: action.disabled,
        onClick: () => void navidrome.refresh(),
        title: t(action.titleKey ?? action.labelKey) || action.fallbackLabel,
    }));

    // 首页模型交给 core 的首页 surface 句柄（探针与以后的命令面板读它，不读组件树）。
    useLibraryHomeListRegistration({
        enabled: Boolean(config),
        getState: (): LibraryHomeListState => ({
            tab: 'navidrome',
            directoryKey,
            hiddenScope: 'navidrome',
            sections: navidrome.sections.map(entry => ({ id: entry.key, label: entry.label, active: entry.active })),
            items: navidrome.items,
            isLoading,
            actions: navidrome.actions.map(action => ({ id: action.id, label: t(action.labelKey) || action.fallbackLabel || '', disabled: action.disabled })),
            batchSelectionType: null,
        }),
        setSection: id => {
            if (!isNavidromeHomeSection(id)) return false;
            setSection(id);
            return true;
        },
        runAction: id => {
            const action = navidrome.actions.find(candidate => candidate.id === id);
            if (!action || action.disabled) return false;
            void navidrome.refresh();
            return true;
        },
    });

    if (!config) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-5 opacity-70">
                <Settings2 size={56} />
                <p className="text-sm">{t('navidrome.notConfigured') || 'Navidrome is not configured.'}</p>
                <button
                    onClick={onOpenSettings}
                    className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm font-semibold"
                >
                    {t('navidrome.settings') || 'Navidrome Settings'}
                </button>
            </div>
        );
    }

    return (
        <DesktopGrid3DSurface
            focusMemoryScope={JSON.stringify(['navidrome', config?.serverUrl, config?.username, section])}
            title={navidrome.title}
            mapButtonLabel={t('home.allAlbums')}
            onOpenMapButton={openSongSectionList}
            items={navidrome.items}
            focusedIndex={focusedIndex}
            onFocusedIndexChange={setFocusedIndex}
            onSelect={(item) => {
                const card = item as LibraryHomeCard;
                // 「按单曲列表显示」时墙上放的是歌曲卡：点它播放这首（同一分区按顺序进队列），不打开集合。
                if (isNavidromeSongCardRef(card.raw) && isNavidromeSongListType(section)) {
                    homeActions.playNavidromeSongs(navidrome.songLists[section], card.raw.index);
                    return;
                }
                homeActions.openNavidromeCard(
                    card,
                    resolveNavidromeCollectionType(section, card.id, sectionsAsTracks),
                    collection => onOpenGridView?.(collection),
                );
            }}
            tabs={tabs}
            actions={actions}
            isLoading={isLoading}
            emptyMessage={navidrome.emptyMessage}
            theme={theme}
            isDaylight={isDaylight}
            isInteractive={isInteractive}
            hasFloatingPlayer={hasFloatingPlayer}
            playlistVisibilityScope="navidrome"
            directoryKey={directoryKey}
            declaredHomeActions={declaredHomeActions}
        />
    );
};

export default NavidromeGrid3DView;
