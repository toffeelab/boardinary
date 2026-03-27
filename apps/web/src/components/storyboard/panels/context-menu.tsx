"use client";

import { useEffect, useCallback, useRef } from "react";
import {
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  Group,
  Ungroup,
} from "lucide-react";

export type AlignDirection = "left" | "right" | "top" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

interface ContextMenuProps {
  x: number;
  y: number;
  onAlign: (direction: AlignDirection) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    },
    [onClose],
  );

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [handleClickOutside, handleEscape]);

  const items: Array<{
    label: string;
    icon: React.ReactNode;
    action: () => void;
  }> = [
    {
      label: "좌 정렬",
      icon: <AlignStartVertical className="h-4 w-4" />,
      action: () => {
        onAlign("left");
        onClose();
      },
    },
    {
      label: "우 정렬",
      icon: <AlignEndVertical className="h-4 w-4" />,
      action: () => {
        onAlign("right");
        onClose();
      },
    },
    {
      label: "상 정렬",
      icon: <AlignStartHorizontal className="h-4 w-4" />,
      action: () => {
        onAlign("top");
        onClose();
      },
    },
    {
      label: "하 정렬",
      icon: <AlignEndHorizontal className="h-4 w-4" />,
      action: () => {
        onAlign("bottom");
        onClose();
      },
    },
    {
      label: "가로 분배",
      icon: <AlignHorizontalSpaceBetween className="h-4 w-4" />,
      action: () => {
        onDistribute("horizontal");
        onClose();
      },
    },
    {
      label: "세로 분배",
      icon: <AlignVerticalSpaceBetween className="h-4 w-4" />,
      action: () => {
        onDistribute("vertical");
        onClose();
      },
    },
  ];

  const groupItems: Array<{
    label: string;
    icon: React.ReactNode;
    shortcut: string;
    action: () => void;
  }> = [
    {
      label: "그룹",
      icon: <Group className="h-4 w-4" />,
      shortcut: "Ctrl+G",
      action: () => {
        onGroup();
        onClose();
      },
    },
    {
      label: "그룹 해제",
      icon: <Ungroup className="h-4 w-4" />,
      shortcut: "Ctrl+Shift+G",
      action: () => {
        onUngroup();
        onClose();
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={item.action}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      <div className="my-1 h-px bg-border" />
      {groupItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={item.action}
        >
          <span className="flex items-center gap-2">
            {item.icon}
            {item.label}
          </span>
          <span className="text-xs text-muted-foreground">{item.shortcut}</span>
        </button>
      ))}
    </div>
  );
}
