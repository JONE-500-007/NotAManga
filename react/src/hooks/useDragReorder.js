import { useCallback, useState } from "react";

export function useDragReorder({ items, setItems, onCommit }) {
  const [draggingId, setDraggingId] = useState(null);

  const handleDragStart = useCallback((id) => () => {
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback(
    (id) => (e) => {
      e.preventDefault();
      if (draggingId === null || draggingId === id) return;
      setItems((current) => {
        const fromIndex = current.findIndex((item) => item.id === draggingId);
        const toIndex = current.findIndex((item) => item.id === id);
        if (fromIndex === -1 || toIndex === -1) return current;
        const reordered = [...current];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        return reordered;
      });
    },
    [draggingId, setItems]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDraggingId(null);
      onCommit(items.map((item) => item.id));
    },
    [items, onCommit]
  );

  const moveByOffset = useCallback(
    (id, offset) => {
      const index = items.findIndex((item) => item.id === id);
      const newIndex = index + offset;
      if (index === -1 || newIndex < 0 || newIndex >= items.length) return;
      const reordered = [...items];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(newIndex, 0, moved);
      setItems(reordered);
      onCommit(reordered.map((item) => item.id));
    },
    [items, setItems, onCommit]
  );

  return { draggingId, handleDragStart, handleDragOver, handleDrop, moveByOffset };
}
