export function ownerFilter(usuarioId, id) {
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new Error('Invalid user');
  if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) throw new Error('Invalid task');
  return id === undefined ? { usuarioId } : { id, usuarioId };
}
