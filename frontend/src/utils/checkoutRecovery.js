export function checkoutStorageKey(userId, businessId, branchId) {
  return userId && businessId && branchId ? `zera-checkout:${encodeURIComponent(userId)}:${encodeURIComponent(businessId)}:${encodeURIComponent(branchId)}` : null;
}

export function saveCheckoutAttempt(storage, storageKey, attempt) {
  if (!storageKey) throw new Error('Select a workspace before checking out.');
  try { storage.setItem(storageKey, JSON.stringify({...attempt,version:1})); }
  catch { throw new Error('Unable to save checkout recovery information. No sale was submitted. Check browser storage and try again.'); }
}

export function readCheckoutAttempt(storage, storageKey) {
  if (!storageKey) return null;
  const raw = storage.getItem(storageKey);
  if (!raw) return null;
  try {
    if (raw.length > 500000) throw new Error();
    const attempt = JSON.parse(raw);
    if (attempt.version !== 1 || typeof attempt.key !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(attempt.key) || !Array.isArray(attempt.cart) || !attempt.cart.length || attempt.fingerprint !== JSON.stringify(attempt.payload)) throw new Error();
    if (attempt.cart.some(item => !item.product?.id || typeof item.product.name !== 'string' || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(Number(item.product.price)) || Number(item.product.price) < 0)) throw new Error();
    return attempt;
  } catch { throw new Error('Saved checkout could not be recovered. Check Sales for the last receipt before making another sale.'); }
}

export function clearCheckoutAttempt(storage, storageKey, requestKey) {
  // Never remove a newer attempt saved by another component.
  const saved = readCheckoutAttempt(storage,storageKey);
  if (saved?.key === requestKey) storage.removeItem(storageKey);
}
