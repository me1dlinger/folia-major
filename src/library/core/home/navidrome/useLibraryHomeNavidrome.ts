import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavidromeConfig, SubsonicSong } from '../../../../types/navidrome';
import type { NavidromeSongListType } from '../../collection/navidromeSongLists';
import type { LibraryHomeCard, LibraryHomeListAction, LibraryNavidromeHomeResource } from '../homeModel.contract';
import {
    buildNavidromeSectionCards,
    isNavidromeTrackListSection,
    NAVIDROME_HOME_SECTIONS,
    navidromeSectionEmptyKey,
    navidromeSectionLabelKey,
    resolveNavidromeHomeActions,
    type NavidromeHomeSection,
} from './navidromeHomeModel';
import { useNavidromeHomeSectionStore } from './useNavidromeHomeSectionStore';
import { useNavidromeUiSettingsStore } from '../../../../stores/useNavidromeUiSettingsStore';
import { navidromeApi } from '../../../../services/navidromeService';

// src/library/core/home/navidrome/useLibraryHomeNavidrome.ts
// Navidrome 页签的模型：概览资源（首页宿主持有的 core/home/navidrome/navidromeHomeLibrary.service，进页签时 ensure——离开页签
// 时宿主让它作废，与原先每次进页签都重新请求一致；换 suite 不再请求）、当前 section（store 记忆）、各 section 的
// 文案、当前 section 的卡片与刷新动作。

/** 「最近加入 / 最近播放 / 最多播放」在「按单曲列表显示」打开时的歌曲列表（关闭时三个都空）。 */
export type LibraryHomeNavidromeSongLists = Record<NavidromeSongListType, SubsonicSong[]>;

export type LibraryHomeNavidrome = {
    /** 没有配置时为 null（显示「去设置」）。 */
    config: NavidromeConfig | null;
    section: NavidromeHomeSection;
    setSection: (section: NavidromeHomeSection) => void;
    sections: { key: NavidromeHomeSection; label: string; active: boolean }[];
    title: string;
    items: LibraryHomeCard[];
    /** 五个 section 各自的卡片（与 items 同一份；首页的直达入口要看当前 section 之外的卡片，例如歌单里的随机 / 收藏）。 */
    cardsBySection: Readonly<Record<NavidromeHomeSection, LibraryHomeCard[]>>;
    /** 「按单曲列表显示」的三个分区各自的歌曲：墙上的歌曲卡点一下就是播放这里的第 index 首。 */
    songLists: LibraryHomeNavidromeSongLists;
    isLoading: boolean;
    emptyMessage: string;
    actions: LibraryHomeListAction[];
    refresh: () => Promise<void>;
};

export const useLibraryHomeNavidrome = (resource: LibraryNavidromeHomeResource): LibraryHomeNavidrome => {
    const { t } = useTranslation();
    // 概览资源属于首页宿主（homeResources.navidromeOverview）：这里只 ensure，换 suite 挂上的新 surface 不会再读；
    // 宿主在离开 Navidrome 页签或首页时让它作废，下次进页签重读。
    useEffect(() => {
        void resource.ensure();
    }, [resource]);
    const { config, isLoading, data } = useSyncExternalStore(resource.subscribe, resource.getSnapshot);
    const section = useNavidromeHomeSectionStore(state => state.section);
    const setSection = useNavidromeHomeSectionStore(state => state.setSection);
    // 设置里可以隐藏二级菜单里的若干项（见 useNavidromeUiSettingsStore）。
    const hiddenSections = useNavidromeUiSettingsStore(state => state.hiddenSections);
    // 「最近加入 / 最近播放 / 最多播放」按单曲列表显示时，这三个分区的墙上放的是歌曲卡。
    const sectionsAsTracks = useNavidromeUiSettingsStore(state => state.sectionsAsTracks);
    // 这个开关改了要重读一次概览（那三个分区的歌曲是读取时一起摊平的）。
    const tracksFlagRef = useRef(sectionsAsTracks);
    useEffect(() => {
        if (tracksFlagRef.current === sectionsAsTracks) return;
        tracksFlagRef.current = sectionsAsTracks;
        void resource.load();
    }, [resource, sectionsAsTracks]);
    const visibleSections = useMemo(() => {
        const hidden = new Set(hiddenSections);
        return NAVIDROME_HOME_SECTIONS.filter(entry => !hidden.has(entry.key));
    }, [hiddenSections]);
    // 当前停留的 section 被隐藏了，或成了曲目列表入口（没有卡片墙）：落到第一个还留着的卡片 section。
    useEffect(() => {
        if (visibleSections.length === 0) return;
        const isRestable = (key: NavidromeHomeSection) => !isNavidromeTrackListSection(key);
        if (!visibleSections.some(entry => entry.key === section && isRestable(entry.key))) {
            const fallback = visibleSections.find(entry => isRestable(entry.key));
            if (fallback) setSection(fallback.key);
        }
    }, [section, setSection, visibleSections]);

    // 五个 section 的卡片一起组装、只随数据变（与原先各自 memo 一样）：切 section 不重挑虚拟歌单的随机封面。
    const cardsBySection = useMemo(() => {
        const cards = { songs: [], albums: [], 'recently-added': [], 'recently-played': [], 'most-played': [], playlists: [], artists: [] } as Record<NavidromeHomeSection, LibraryHomeCard[]>;
        if (!config) return cards;
        const coverArtUrl = (coverArtId: string, size?: number) => navidromeApi.getCoverArtUrl(config, coverArtId, size);
        for (const entry of NAVIDROME_HOME_SECTIONS) {
            cards[entry.key] = buildNavidromeSectionCards(entry.key, data, { t, coverArtUrl }, sectionsAsTracks);
        }
        return cards;
    }, [config, data, sectionsAsTracks, t]);
    const items = cardsBySection[section];

    const sections = useMemo(() => visibleSections.map(entry => ({
        key: entry.key,
        label: t(entry.labelKey),
        active: entry.key === section,
    })), [section, t, visibleSections]);

    const refresh = useCallback(() => resource.load(), [resource]);

    return {
        config,
        section,
        setSection,
        sections,
        title: t(navidromeSectionLabelKey(section)),
        items,
        cardsBySection,
        songLists: data.songLists,
        isLoading,
        emptyMessage: t(navidromeSectionEmptyKey(section)),
        actions: resolveNavidromeHomeActions(isLoading),
        refresh,
    };
};
