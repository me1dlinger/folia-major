import { create } from 'zustand';
import { getStoredBoolean, getStoredString, setStoredBoolean, setStoredString } from './storagePrimitives';

// src/stores/useNavidromeUiSettingsStore.ts
// 媒体库界面里几个「烦人但无害」的东西的开关，都在「设置 → 主页与歌单 → 媒体库界面」里：
//   - 每次播放弹的「Navidrome 歌曲已加载」提示；
//   - 首页 Navidrome 的二级菜单（曲目 / 专辑 / 最近加入 / 最近播放 / 最多播放 / 歌单 / 艺术家）；
//   - 右下角常驻的「切换在线音乐平台」按钮。
// 只是浏览舒适度开关，不进外观导入导出。

const HIDE_LOADED_NOTICE_KEY = 'navidrome_hide_loaded_notice';
const HIDDEN_SECTIONS_KEY = 'navidrome_hidden_sections';
const HIDE_PROVIDER_SWITCHER_KEY = 'navidrome_hide_provider_switcher';
const SECTIONS_AS_TRACKS_KEY = 'navidrome_sections_as_tracks';
const SECTION_TRACK_LIMIT_KEY = 'navidrome_section_track_limit';

const readHiddenSections = (): string[] => {
    const stored = getStoredString(HIDDEN_SECTIONS_KEY, '');
    if (!stored) return [];
    try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
    } catch (e) {
        console.warn('[NavidromeUi] Failed to parse hidden sections:', e);
        return [];
    }
};

export const DEFAULT_SECTION_TRACK_LIMIT = 100;

const readSectionTrackLimit = (): number => {
    const stored = Number(getStoredString(SECTION_TRACK_LIMIT_KEY, String(DEFAULT_SECTION_TRACK_LIMIT)));
    return Number.isFinite(stored) && stored >= 1 ? Math.floor(stored) : DEFAULT_SECTION_TRACK_LIMIT;
};

export type NavidromeUiSettingsState = {
    /** 不显示「Navidrome 歌曲已加载」这类落歌提示。 */
    hideLoadedNotice: boolean;
    /** 首页 Navidrome 二级菜单里被隐藏的 section key。 */
    hiddenSections: string[];
    /** 不显示右下角常驻的「切换在线音乐平台」按钮。 */
    hideProviderSwitcher: boolean;
    /**
     * 「最近加入 / 最近播放 / 最多播放」按单曲列表显示（Subsonic 只有专辑级的这三种排序，
     * 打开时把最近的一批专辑摊平成歌曲）。关掉时这三项还是专辑墙。
     */
    sectionsAsTracks: boolean;
    /**
     * 「最近加入 / 最近播放 / 最多播放」单曲列表最多显示多少首（默认 100，最小 1）。
     * 「曲目」（全部曲目）不受这个限制。
     */
    sectionTrackLimit: number;
    handleToggleHideLoadedNotice: (enabled: boolean) => void;
    handleToggleHideProviderSwitcher: (enabled: boolean) => void;
    handleToggleSectionsAsTracks: (enabled: boolean) => void;
    handleSetSectionTrackLimit: (limit: number) => void;
    /** 切换某个二级菜单项的显示。 */
    handleToggleHiddenSection: (sectionKey: string, hidden: boolean) => void;
    /** 一次设置整份隐藏列表（Chips 多选）。 */
    handleSetHiddenSections: (keys: string[]) => void;
    resetNavidromeUi: () => void;
};

export const useNavidromeUiSettingsStore = create<NavidromeUiSettingsState>((set, get) => {
    const persistSections = (keys: string[]) => {
        setStoredString(HIDDEN_SECTIONS_KEY, JSON.stringify(keys));
        set({ hiddenSections: keys });
    };

    return {
        hideLoadedNotice: getStoredBoolean(HIDE_LOADED_NOTICE_KEY, false),
        hiddenSections: readHiddenSections(),
        hideProviderSwitcher: getStoredBoolean(HIDE_PROVIDER_SWITCHER_KEY, false),
        sectionsAsTracks: getStoredBoolean(SECTIONS_AS_TRACKS_KEY, false),
        sectionTrackLimit: readSectionTrackLimit(),
        handleToggleHideLoadedNotice: (enabled) => {
            setStoredBoolean(HIDE_LOADED_NOTICE_KEY, enabled);
            set({ hideLoadedNotice: enabled });
        },
        handleToggleSectionsAsTracks: (enabled) => {
            setStoredBoolean(SECTIONS_AS_TRACKS_KEY, enabled);
            set({ sectionsAsTracks: enabled });
        },
        handleSetSectionTrackLimit: (limit) => {
            const next = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : DEFAULT_SECTION_TRACK_LIMIT;
            setStoredString(SECTION_TRACK_LIMIT_KEY, String(next));
            set({ sectionTrackLimit: next });
        },
        handleToggleHideProviderSwitcher: (enabled) => {
            setStoredBoolean(HIDE_PROVIDER_SWITCHER_KEY, enabled);
            set({ hideProviderSwitcher: enabled });
        },
        handleToggleHiddenSection: (sectionKey, hidden) => {
            const current = get().hiddenSections;
            const next = hidden
                ? (current.includes(sectionKey) ? current : [...current, sectionKey])
                : current.filter(key => key !== sectionKey);
            persistSections(next);
        },
        handleSetHiddenSections: persistSections,
        resetNavidromeUi: () => {
            setStoredBoolean(HIDE_LOADED_NOTICE_KEY, false);
            setStoredBoolean(HIDE_PROVIDER_SWITCHER_KEY, false);
            setStoredBoolean(SECTIONS_AS_TRACKS_KEY, false);
            setStoredString(SECTION_TRACK_LIMIT_KEY, String(DEFAULT_SECTION_TRACK_LIMIT));
            setStoredString(HIDDEN_SECTIONS_KEY, JSON.stringify([]));
            set({ hideLoadedNotice: false, hideProviderSwitcher: false, sectionsAsTracks: false, sectionTrackLimit: DEFAULT_SECTION_TRACK_LIMIT, hiddenSections: [] });
        },
    };
});

/** 当前的「单曲列表最多显示」（默认 100、最小 1）；「曲目」（全部曲目）不受它限制。 */
export const readNavidromeSectionTrackLimit = (): number => {
    const limit = useNavidromeUiSettingsStore.getState().sectionTrackLimit;
    return Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : DEFAULT_SECTION_TRACK_LIMIT;
};