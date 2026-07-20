const express = require("express");
const pool = require("../db/pool");
const { requireAuth, optionalAuth, requireRole } = require("../middleware/auth");
const { reorderRows } = require("../utils/reorder");

const router = express.Router();
const CARD_SIZES = ["xs", "small", "medium", "large", "xl"];

router.get("/categories", optionalAuth, async (req, res) => {
  const categoriesResult = await pool.query(
    "SELECT id, title, description, position, card_size FROM categories ORDER BY position ASC"
  );
  const categories = categoriesResult.rows;

  for (const category of categories) {
    const mangaResult = await pool.query(
      `SELECT m.id, m.title, m.cover_path FROM category_manga cm
       JOIN manga m ON m.id = cm.manga_id
       WHERE cm.category_id = $1 ORDER BY cm.position ASC`,
      [category.id]
    );
    category.manga = mangaResult.rows;
  }

  res.json(categories);
});

router.post("/categories", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });

  const maxResult = await pool.query("SELECT COALESCE(MAX(position), 0) AS max FROM categories");
  const position = Number(maxResult.rows[0].max) + 1;

  const result = await pool.query(
    "INSERT INTO categories (title, description, position) VALUES ($1, $2, $3) RETURNING *",
    [title, description || null, position]
  );
  res.status(201).json({ ...result.rows[0], manga: [] });
});

router.patch("/categories/reorder", requireAuth, requireRole("admin"), async (req, res) => {
  const { orderedCategoryIds } = req.body;
  if (!Array.isArray(orderedCategoryIds) || orderedCategoryIds.length === 0) {
    return res.status(400).json({ error: "orderedCategoryIds is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await reorderRows(client, {
      table: "categories",
      numberColumn: "position",
      orderedIds: orderedCategoryIds,
    });
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

router.patch("/categories/:categoryId", requireAuth, requireRole("admin"), async (req, res) => {
  const { categoryId } = req.params;
  const { title, description, card_size } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  if (card_size !== undefined && !CARD_SIZES.includes(card_size)) {
    return res.status(400).json({ error: "Invalid card_size" });
  }

  const result = await pool.query(
    "UPDATE categories SET title = $1, description = $2, card_size = COALESCE($3, card_size) WHERE id = $4 RETURNING *",
    [title, description || null, card_size || null, categoryId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Category not found" });
  res.json(result.rows[0]);
});

router.delete("/categories/:categoryId", requireAuth, requireRole("admin"), async (req, res) => {
  const { categoryId } = req.params;
  const result = await pool.query("DELETE FROM categories WHERE id = $1 RETURNING id", [categoryId]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Category not found" });
  res.json({ ok: true });
});

router.post("/categories/:categoryId/manga", requireAuth, requireRole("admin"), async (req, res) => {
  const { categoryId } = req.params;
  const { mangaId } = req.body;
  if (!mangaId) return res.status(400).json({ error: "mangaId is required" });

  const categoryCheck = await pool.query("SELECT id FROM categories WHERE id = $1", [categoryId]);
  if (categoryCheck.rows.length === 0) return res.status(404).json({ error: "Category not found" });

  const mangaCheck = await pool.query("SELECT id, title, cover_path FROM manga WHERE id = $1", [mangaId]);
  if (mangaCheck.rows.length === 0) return res.status(404).json({ error: "Manga not found" });

  const maxResult = await pool.query(
    "SELECT COALESCE(MAX(position), 0) AS max FROM category_manga WHERE category_id = $1",
    [categoryId]
  );
  const position = Number(maxResult.rows[0].max) + 1;

  try {
    await pool.query(
      "INSERT INTO category_manga (category_id, manga_id, position) VALUES ($1, $2, $3)",
      [categoryId, mangaId, position]
    );
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Manga is already in this category" });
    throw err;
  }

  res.status(201).json(mangaCheck.rows[0]);
});

router.patch(
  "/categories/:categoryId/manga/reorder",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const { categoryId } = req.params;
    const { orderedMangaIds } = req.body;
    if (!Array.isArray(orderedMangaIds) || orderedMangaIds.length === 0) {
      return res.status(400).json({ error: "orderedMangaIds is required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await reorderRows(client, {
        table: "category_manga",
        numberColumn: "position",
        parentColumn: "category_id",
        parentId: categoryId,
        idColumn: "manga_id",
        orderedIds: orderedMangaIds,
      });
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

router.delete(
  "/categories/:categoryId/manga/:mangaId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const { categoryId, mangaId } = req.params;

    const result = await pool.query(
      "DELETE FROM category_manga WHERE category_id = $1 AND manga_id = $2 RETURNING position",
      [categoryId, mangaId]
    );
    const deleted = result.rows[0];
    if (!deleted) return res.status(404).json({ error: "Manga is not in this category" });

    await pool.query(
      "UPDATE category_manga SET position = position - 1 WHERE category_id = $1 AND position > $2",
      [categoryId, deleted.position]
    );

    res.json({ ok: true });
  }
);

module.exports = router;
