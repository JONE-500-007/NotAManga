async function reorderRows(client, { table, numberColumn, parentColumn, parentId, idColumn = "id", orderedIds }) {
  const whereParent = parentColumn ? ` AND ${parentColumn} = $3` : "";
  for (let i = 0; i < orderedIds.length; i++) {
    const params = parentColumn ? [-(i + 1), orderedIds[i], parentId] : [-(i + 1), orderedIds[i]];
    await client.query(`UPDATE ${table} SET ${numberColumn} = $1 WHERE ${idColumn} = $2${whereParent}`, params);
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const params = parentColumn ? [i + 1, orderedIds[i], parentId] : [i + 1, orderedIds[i]];
    await client.query(`UPDATE ${table} SET ${numberColumn} = $1 WHERE ${idColumn} = $2${whereParent}`, params);
  }
}

module.exports = { reorderRows };
