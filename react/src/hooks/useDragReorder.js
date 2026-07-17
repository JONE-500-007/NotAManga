import { useCallback, useState } from "react";

export function useDragReorder({ items, setItems, onCommit }) {
  const [draggingId, setDraggingId] = useState(null);
  // A native draggable="true" element always wins a click-drag gesture over
  // ordinary text selection, wherever the mouse goes down on it. Rather than
  // making the whole card/tile draggable, it's only marked draggable while
  // the mouse is held down on its dedicated handle — everywhere else on the
  // card (title, caption, buttons) behaves normally.
  const [dragArmed, setDragArmed] = useState(false);

  const armDrag = useCallback(() => setDragArmed(true), []);
  const disarmDrag = useCallback(() => setDragArmed(false), []);

  // Reorderable lists sometimes nest inside another reorderable list (e.g. a
  // manga tile draggable within a draggable category card). Drag events
  // bubble like any other DOM event, so without stopPropagation an inner
  // drag also reaches the outer list's handlers and both reorder at once.
  const handleDragStart = useCallback((id) => (e) => {
    e.stopPropagation();
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback(
    (id) => (e) => {
      e.preventDefault();
      e.stopPropagation();
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
      e.stopPropagation();
      setDraggingId(null);
      setDragArmed(false);
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

  return { draggingId, dragArmed, armDrag, disarmDrag, handleDragStart, handleDragOver, handleDrop, moveByOffset };
}
