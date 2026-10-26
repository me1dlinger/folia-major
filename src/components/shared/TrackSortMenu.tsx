import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowDownAZ,
    ArrowUpAZ,
    CalendarClock,
    CalendarDays,
    Check,
    Disc3,
    Flame,
    Heart,
    History,
    Timer,
    Type,
    User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TRACK_SORT_FIELDS, type TrackSortDirection, type TrackSortField } from '../../utils/trackSorting';

// src/components/shared/TrackSortMenu.tsx
// Navidrome / 在线集合曲目列表的排序控件（字段 + 方向），比照 feishin 的曲目排序。
// 一颗按钮开一个菜单：顶上切升/降序，下面选字段。选择由 useTrackListSortStore 缓存。

const FIELD_ICONS: Record<TrackSortField, React.ComponentType<{ size?: number }>> = {
    name: Type,
    artist: User,
    album: Disc3,
    duration: Timer,
    addedAt: CalendarClock,
    lastPlayed: History,
    year: CalendarDays,
    playCount: Flame,
    favorite: Heart,
};

const FIELD_LABEL_KEYS: Record<TrackSortField, string> = {
    name: 'trackSort.fieldName',
    artist: 'trackSort.fieldArtist',
    album: 'trackSort.fieldAlbum',
    duration: 'trackSort.fieldDuration',
    addedAt: 'trackSort.fieldAddedAt',
    lastPlayed: 'trackSort.fieldLastPlayed',
    year: 'trackSort.fieldYear',
    playCount: 'trackSort.fieldPlayCount',
    favorite: 'trackSort.fieldFavorite',
};

type TrackSortMenuProps = {
    field: TrackSortField;
    direction: TrackSortDirection;
    onFieldChange: (field: TrackSortField) => void;
    onDirectionChange: (direction: TrackSortDirection) => void;
};

export const TrackSortMenu: React.FC<TrackSortMenuProps> = ({ field, direction, onFieldChange, onDirectionChange }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const FieldIcon = FIELD_ICONS[field] ?? Type;
    const DirectionIcon = direction === 'asc' ? ArrowDownAZ : ArrowUpAZ;

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative shrink-0"
            onKeyDown={(event) => {
                if (event.key !== 'Escape' || !isOpen) return;
                event.stopPropagation();
                setIsOpen(false);
                buttonRef.current?.focus();
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(current => !current)}
                aria-label={t('trackSort.title')}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                title={t('trackSort.title')}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    isOpen ? 'bg-black/10 dark:bg-white/15' : 'hover:bg-black/10 dark:hover:bg-white/10'
                }`}
            >
                <FieldIcon size={16} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        role="menu"
                        className="absolute right-0 top-10 z-10 w-48 rounded-2xl border p-1.5 shadow-xl backdrop-blur-2xl theme-glass-panel"
                    >
                        <button
                            type="button"
                            onClick={() => onDirectionChange(direction === 'asc' ? 'desc' : 'asc')}
                            className="mb-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <span className="opacity-65"><DirectionIcon size={15} /></span>
                            <span className="min-w-0 flex-1 truncate">
                                {t(direction === 'asc' ? 'trackSort.ascending' : 'trackSort.descending')}
                            </span>
                        </button>
                        <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
                        {TRACK_SORT_FIELDS.map(candidate => {
                            const Icon = FIELD_ICONS[candidate];
                            const active = candidate === field;
                            return (
                                <button
                                    key={candidate}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={active}
                                    aria-label={t(FIELD_LABEL_KEYS[candidate])}
                                    onClick={() => onFieldChange(candidate)}
                                    className={`relative flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                                        active ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span className="opacity-65"><Icon size={15} /></span>
                                    <span className="min-w-0 flex-1 truncate">{t(FIELD_LABEL_KEYS[candidate])}</span>
                                    {active && <Check size={14} className="opacity-80" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};