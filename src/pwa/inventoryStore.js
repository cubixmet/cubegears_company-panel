let database;

function openInventoryStore() {
  if (!database) {
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('cubixgear-offline-inventory', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('scopes');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  }
  return database;
}

export async function inventoryStore(key, update) {
  const db = await openInventoryStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('scopes', update ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('scopes');
    const request = store.get(key);
    let result;
    request.onsuccess = () => {
      result = request.result || { records: [] };
      if (update) {
        result = update(result);
        store.put(result, key);
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function prepareInventorySnapshot({ items, categories, suppliers, racks, create, expiresAt }) {
  const option = ({ id, name, is_active }) => ({ id, name, is_active });
  return {
    expiresAt,
    create,
    categories: categories.map(row => ({ ...option(row), parent: row.parent, parentName: row.parentName })),
    suppliers: suppliers.map(option),
    brands: [...new Set(items.map(item => item.brand).filter(Boolean))],
    racks,
  };
}

export function syncErrorKind(error) {
  if (error.status === 401) return 'signin';
  if (error.status === 403) return 'permission';
  if (error.status === 409 || error.fieldErrors?.requestKey || error.fieldErrors?.sku) return 'conflict';
  if (!error.status || [408, 425, 429].includes(error.status) || error.status >= 500) return 'retry';
  return 'validation';
}
