import { create } from 'zustand';
import {
    isTrackSortDirection,
    isTrackSortField,
    type TrackSortDirection,
    type TrackSortField,
} from '../../../utils/trackSorting';

// src/library/core/trackSort/useTrackListSortStore.ts
// Navidrome / 在线集合曲目列表的排序选择（字段 + 方向），比照 feishin 的曲目排序。
// 选择缓存到 localStorage，进任何曲目列表都用同一份；与本地文件夹列表的 useLocalTrackSortStore 分开，
// 因为那套认本地字段（filePath / 修改时间），两边的键不共享。

const TRACK_SORT_FIELD_STORAGE_KEY = 'folia_track_sort_field';
const TRACK_SORT_DIRECTION_STORAGE_KEY = 'folia_track_sort_direction';

const readField = (): TrackSortField => {
    if (typeof window === 'undefined') return 'name';
    const stored = localStorage.getItem(TRACK_SORT_FIELD_STORAGE_KEY);
    return isTrackSortField(stored) ? stored : 'name';
};

const readDirection = (): TrackSortDirection => {
    if (typeof window === 'undefined') return 'asc';
    const stored = localStorage.getItem(TRACK_SORT_DIRECTION_STORAGE_KEY);
    return isTrackSortDirection(stored) ? stored : 'asc';
};

type TrackListSortState = {
    field: TrackSortField;
    direction: TrackSortDirection;
    setField: (field: TrackSortField) => void;
    setDirection: (direction: TrackSortDirection) => void;
    toggleDirection: () => void;
    /** 从存储重新读一遍（探针模拟重启时用）。 */
    hydrate: () => void;
};

export const useTrackListSortStore = create<TrackListSortState>((set, get) => ({
    field: readField(),
    direction: readDirection(),
    setField: (field) => {
        try {
            localStorage.setItem(TRACK_SORT_FIELD_STORAGE_KEY, field);
        } catch (e) {
            console.warn('[TrackListSort] Failed to save sort field:', e);
        }
        set({ field });
    },
    setDirection: (direction) => {
        try {
            localStorage.setItem(TRACK_SORT_DIRECTION_STORAGE_KEY, direction);
        } catch (e) {
            console.warn('[TrackListSort] Failed to save sort direction:', e);
        }
        set({ direction });
    },
    toggleDirection: () => get().setDirection(get().direction === 'asc' ? 'desc' : 'asc'),
    hydrate: () => set({ field: readField(), direction: readDirection() }),
}));