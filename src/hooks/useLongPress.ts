import { useCallback, useEffect, useRef } from 'react';

// src/hooks/useLongPress.ts
// 一个按钮的「点击 / 长按」两种手势：按住超过 delay 毫秒算长按，否则松开算点击。
// 曲目列表的「播放全部」用它：点一下按当前顺序播放，长按随机播放（比照 feishin）。
// 返回的 onClick 直接传给 <button>：长按触发后，紧跟其后的原生 click 被吞掉；
// 键盘回车 / 空格只有 click，不受影响。只返回处理函数，不碰 DOM。

export type LongPressHandlers = {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onContextMenu: (event: React.MouseEvent) => void;
    onClick: () => void;
};

export const useLongPress = (
    onClick: () => void,
    onLongPress: () => void,
    delay: number = 500,
): LongPressHandlers => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggeredRef = useRef(false);

    const clear = useCallback(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    useEffect(() => clear, [clear]);

    const onPointerDown = useCallback((event: React.PointerEvent) => {
        // 只认主键；右键的长按菜单由 onContextMenu 挡掉。
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        triggeredRef.current = false;
        clear();
        timerRef.current = setTimeout(() => {
            triggeredRef.current = true;
            onLongPress();
        }, delay);
    }, [clear, delay, onLongPress]);

    const handleClick = useCallback(() => {
        if (triggeredRef.current) {
            triggeredRef.current = false;
            return;
        }
        onClick();
    }, [onClick]);

    return {
        onPointerDown,
        onPointerUp: clear,
        onPointerLeave: clear,
        onPointerCancel: clear,
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        onClick: handleClick,
    };
};