async function reorderRows(client, { table, numberColumn, parentColumn, parentId, orderedIds }) {
  for (let i = 0; i < orderedIds.length; i++) {
    await client.query(
      `UPDATE ${table} SET ${numberColumn} = $1 WHERE id = $2 AND ${parentColumn} = $3`,
      [-(i + 1), orderedIds[i], parentId]
    );
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await client.query(
      `UPDATE ${table} SET ${numberColumn} = $1 WHERE id = $2 AND ${parentColumn} = $3`,
      [i + 1, orderedIds[i], parentId]
    );
  }
}

module.exports = { reorderRows };
