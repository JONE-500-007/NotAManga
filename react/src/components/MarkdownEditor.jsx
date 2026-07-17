import { useEffect, useMemo, useRef } from "react";
import { renderInlineMarkdown, renderMarkdown } from "../utils/renderMarkdown";

function wrapSelection(field, before, after, placeholder) {
  const { selectionStart, selectionEnd, value } = field;
  const selected = value.slice(selectionStart, selectionEnd) || placeholder;
  const newValue = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  const cursorStart = selectionStart + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { newValue, cursorStart, cursorEnd };
}

// Heading buttons replace any existing "#" prefix on the line rather than
// stacking them, so clicking H2 after H1 gives "## " instead of "# ## ".
function setHeadingPrefix(field, level) {
  const { selectionStart, value } = field;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  let lineEnd = value.indexOf("\n", selectionStart);
  if (lineEnd === -1) lineEnd = value.length;
  const stripped = value.slice(lineStart, lineEnd).replace(/^#{1,6}\s*/, "");
  const newLine = `${"#".repeat(level)} ${stripped}`;
  const newValue = value.slice(0, lineStart) + newLine + value.slice(lineEnd);
  const cursorPos = lineStart + newLine.length;
  return { newValue, cursorStart: cursorPos, cursorEnd: cursorPos };
}

function prependLine(field, prefix) {
  const { selectionStart, value } = field;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const newValue = `${value.slice(0, lineStart)}${prefix} ${value.slice(lineStart)}`;
  const cursorPos = selectionStart + prefix.length + 1;
  return { newValue, cursorStart: cursorPos, cursorEnd: cursorPos };
}

export default function MarkdownEditor({
  value,
  onChange,
  multiline = true,
  headings = true,
  lists = true,
  className,
  ...fieldProps
}) {
  const fieldRef = useRef(null);
  const colorInputRef = useRef(null);

  const apply = (transform) => {
    const field = fieldRef.current;
    if (!field) return;
    const { newValue, cursorStart, cursorEnd } = transform(field);
    onChange(newValue);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const wrap = (before, after, placeholder) => () => apply((field) => wrapSelection(field, before, after, placeholder));

  // The native color picker fires "input" continuously while dragging inside
  // it (and React's onChange prop is actually wired to that "input" event,
  // not "change"), so wiring the wrap-in-<span> through onChange applied it
  // on every drag tick, nesting the selection in a new span each time. The
  // real native "change" event only fires once, when a color is committed.
  useEffect(() => {
    const colorInput = colorInputRef.current;
    if (!colorInput) return;
    const handleColorChange = (e) => {
      const color = e.target.value;
      apply((field) => wrapSelection(field, `<span style="color:${color}">`, "</span>", "colored text"));
    };
    colorInput.addEventListener("change", handleColorChange);
    return () => colorInput.removeEventListener("change", handleColorChange);
  }, [onChange]);

  const Field = multiline ? "textarea" : "input";
  const previewHtml = useMemo(
    () => (multiline ? renderMarkdown(value) : renderInlineMarkdown(value)),
    [value, multiline]
  );

  return (
    <div className={className ? `markdown-editor ${className}` : "markdown-editor"}>
      <div className="markdown-toolbar">
        {headings && (
          <>
            <button type="button" onClick={() => apply((field) => setHeadingPrefix(field, 1))}>
              H1
            </button>
            <button type="button" onClick={() => apply((field) => setHeadingPrefix(field, 2))}>
              H2
            </button>
            <button type="button" onClick={() => apply((field) => setHeadingPrefix(field, 3))}>
              H3
            </button>
          </>
        )}
        <button type="button" onClick={wrap("**", "**", "bold text")} style={{ fontWeight: 700 }}>
          B
        </button>
        <button type="button" onClick={wrap("*", "*", "italic text")} style={{ fontStyle: "italic" }}>
          I
        </button>
        <button type="button" onClick={wrap("~~", "~~", "strikethrough")} style={{ textDecoration: "line-through" }}>
          S
        </button>
        <button type="button" onClick={wrap("<u>", "</u>", "underlined text")} style={{ textDecoration: "underline" }}>
          U
        </button>
        {headings && <button type="button" onClick={wrap("`", "`", "code")}>{"</>"}</button>}
        {lists && (
          <>
            <button type="button" onClick={() => apply((field) => prependLine(field, "-"))}>
              &bull;
            </button>
            <button type="button" onClick={() => apply((field) => prependLine(field, "1."))}>
              1.
            </button>
          </>
        )}
        <label className="markdown-color-swatch" title="Text color">
          <input ref={colorInputRef} type="color" defaultValue="#ff6740" />
        </label>
      </div>
      <Field
        ref={fieldRef}
        className="markdown-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={multiline ? 5 : undefined}
        {...fieldProps}
      />
      {value && (
        <div className="markdown-preview">
          <span className="markdown-preview-label">Preview</span>
          <div className="markdown-preview-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
    </div>
  );
}
