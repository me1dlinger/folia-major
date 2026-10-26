import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';

// src/components/shared/LongPressButton.tsx
// 一个按钮，点击与长按绑不同动作（曲目列表的「播放全部」：点一下按当前顺序，长按随机）。
// 长按随机只在鼠标悬浮提示（title）里说明，按钮本身不写。

export type LongPressButtonProps = {
    onClick?: () => void;
    onLongPress?: () => void;
    className?: string;
    title?: string;
    'aria-label'?: string;
    'data-bravais-seam-action'?: string;
    disabled?: boolean;
    children: React.ReactNode;
};

export const LongPressButton: React.FC<LongPressButtonProps> = ({
    onClick,
    onLongPress,
    className,
    title,
    'aria-label': ariaLabel,
    'data-bravais-seam-action': dataBravaisSeamAction,
    disabled,
    children,
}) => {
    const fallback = () => onClick?.();
    const handlers = useLongPress(fallback, onLongPress ?? fallback);

    return (
        <button
            type="button"
            className={className}
            title={title}
            aria-label={ariaLabel}
            data-bravais-seam-action={dataBravaisSeamAction}
            disabled={disabled}
            onPointerDown={handlers.onPointerDown}
            onPointerUp={handlers.onPointerUp}
            onPointerLeave={handlers.onPointerLeave}
            onPointerCancel={handlers.onPointerCancel}
            onContextMenu={handlers.onContextMenu}
            onClick={handlers.onClick}
        >
            {children}
        </button>
    );
};