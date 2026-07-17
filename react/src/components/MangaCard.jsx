import { Link } from "react-router-dom";
import { renderInlineMarkdown } from "../utils/renderMarkdown";

export default function MangaCard({ manga }) {
  return (
    <Link to={`/manga/${manga.id}`} className="manga-card">
      <div className="manga-card-cover">
        {manga.cover_path ? (
          <img src={manga.cover_path} alt={manga.title} />
        ) : (
          <div className="manga-card-placeholder" />
        )}
      </div>
      <div className="manga-card-title" dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(manga.title) }} />
    </Link>
  );
}
