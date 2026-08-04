import { useState } from "react";

// Renders one "Read or Buy"/"Track" icon button. Falls back to a generic
// link glyph if the site has no icon set (admin hasn't uploaded one yet)
// or its image fails to load, so a missing icon never shows as a
// broken-image box.
export default function SiteLinkButton({ link }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="site-link-btn" title={link.site_name}>
      {link.site_icon_path && !imgFailed ? (
        <img src={link.site_icon_path} alt="" onError={() => setImgFailed(true)} />
      ) : (
        <span className="material-symbols-outlined" aria-hidden="true">
          link
        </span>
      )}
      <span>{link.site_name}</span>
    </a>
  );
}
