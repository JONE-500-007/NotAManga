import { useCallback, useEffect, useRef, useState } from "react";

// Lets a horizontally-scrolling shelf (e.g. .shelf-scroll) be driven by the
// ordinary vertical mouse wheel while hovered, by click-and-drag anywhere
// (including on top of a card), and by a pair of edge arrow buttons. Outside
// the element the page keeps scrolling vertically as normal.
export function useHorizontalScroll() {
  const ref = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateEdges();

    // React attaches wheel listeners passively by default, so preventDefault
    // inside a synthetic onWheel handler is silently ignored. A native
    // listener with passive: false is the only way to actually stop the
    // page from scrolling vertically while redirecting the delta here.
    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      el.scrollBy({ left: e.deltaY, behavior: "smooth" });
      e.preventDefault();
    };

    // Cards are <a>/<img>, which browsers make natively draggable. Left
    // alone, starting a drag on top of a card kicks off a native
    // drag-and-drop ghost instead of the scroll-drag handled below.
    const onDragStart = (e) => e.preventDefault();

    let dragging = false;
    let dragged = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onMouseDown = (e) => {
      dragging = true;
      dragged = false;
      startX = e.clientX;
      startScrollLeft = el.scrollLeft;
      el.classList.add("shelf-scroll--dragging");
    };

    const onMouseMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) dragged = true;
      el.scrollLeft = startScrollLeft - dx;
    };

    const stopDragging = () => {
      dragging = false;
      el.classList.remove("shelf-scroll--dragging");
    };

    // A card underneath is a <Link>; without this, releasing a drag on top
    // of one would navigate away instead of just finishing the scroll.
    const onClickCapture = (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onScroll = () => updateEdges();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDragging);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("scroll", onScroll, { passive: true });

    // Catches window resizes and the shelf itself gaining/losing width;
    // content-only width changes don't apply here because the manga list is
    // already final by the time this component mounts.
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [updateEdges]);

  const scrollByPage = useCallback((direction) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }, []);

  return { ref, canScrollLeft, canScrollRight, scrollByPage };
}
