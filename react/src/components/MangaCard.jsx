import { Link } from "react-router-dom";
import { renderInlineMarkdown } from "../utils/renderMarkdown";

export default function MangaCard({ manga }) {
  return (
    <Link to={`/manga/${manga.id}`} className="manga-card">
      <div className="manga-card-cover">
        {manga.cover_path ? (
          <img src={manga.cover_path} alt={manga.title} draggable={false} />
        ) : (
          <div className="manga-card-placeholder" />
        )}
        {manga.is_private && (
          <span className="manga-card-private-badge material-symbols-outlined" aria-hidden="true">
            lock
          </span>
        )}
      </div>
      <div className="manga-card-title" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(manga.title) }} />
    </Link>
  );
}
