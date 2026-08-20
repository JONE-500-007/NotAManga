import { useEffect, useRef, useState } from "react";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";

// One admin notice on the browse page. The body is clamped to a few lines so
// a long announcement can't push the whole catalog off-screen; the full text
// is revealed on hover (pointer devices) or tap (everywhere, which is the
// only option on a phone).
//
// `expandable` is measured rather than assumed from text length: whether the
// clamp actually cuts anything depends on the rendered width, so a short
// notice on a wide screen must not advertise a "tap for more" affordance
// that reveals nothing.
export default function AnnouncementBanner({ announcement }) {
  const bodyRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [expandable, setExpandable] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const measure = () => {
      // scrollHeight > clientHeight means -webkit-line-clamp is hiding
      // something. Compared with a 1px tolerance because sub-pixel line
      // heights can leave a fractional difference on an unclamped element.
      // Skipped while expanded — the clamp is lifted then, so it would
      // always measure as "fits" and turn the control off mid-read.
      if (!expanded) setExpandable(el.scrollHeight - el.clientHeight > 1);
    };

    // Measuring straight from the effect body can read a pre-layout size (a
    // flex row that hasn't settled makes the text wrap more than it finally
    // will), which would advertise a "tap for more" on a notice that fits.
    // rAF waits for that layout, and fonts.ready re-checks once the webfont
    // swaps in and every line box changes width.
    const raf = requestAnimationFrame(measure);
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && measure());

    // Re-measure on resize: the same text clamps at one width and not
    // another, so a rotated phone or a dragged window changes the answer.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [announcement.body, expanded]);

  const hasBody = Boolean(announcement.body);

  return (
    <article
      className={`announcement${expanded ? " announcement-expanded" : ""}${
        hasBody && (expandable || expanded) ? " announcement-toggleable" : ""
      }`}
      onClick={() => hasBody && (expandable || expanded) && setExpanded((v) => !v)}
    >
      <span className="announcement-icon material-symbols-outlined" aria-hidden="true">
        campaign
      </span>
      <div className="announcement-content">
        <h3
          className="announcement-title"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(announcement.title) }}
        />
        {hasBody && (
          <div
            ref={bodyRef}
            className="announcement-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(announcement.body) }}
          />
        )}
      </div>
    </article>
  );
}
