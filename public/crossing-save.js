const crossingSaveKey = 'famicom-wars:crossing-save';
const crossingSaveVersion = 1;

function createCrossingSave(getStorage) {
  let knownSave;
  let status = 'ready';

  return {
    get status() { return status; },
    load(restore) {
      try {
        knownSave = getStorage().getItem(crossingSaveKey);
      } catch {
        status = 'unavailable';
        return null;
      }
      if (knownSave === null) return null;
      try {
        const data = JSON.parse(knownSave);
        if (data?.version === crossingSaveVersion) {
          const game = restore(data.state);
          if (game) {
            status = 'restored';
            return game;
          }
        }
      } catch {
        // Keep the existing save intact if it cannot be understood.
      }
      status = 'unreadable';
      return null;
    },
    write(state) {
      if (status === 'unreadable' || status === 'changed-elsewhere') return false;
      try {
        const storage = getStorage();
        const current = storage.getItem(crossingSaveKey);
        if (current !== (knownSave ?? null)) {
          status = 'changed-elsewhere';
          return false;
        }
        const data = JSON.stringify({version: crossingSaveVersion, state});
        if (data !== current) {
          storage.setItem(crossingSaveKey, data);
          if (storage.getItem(crossingSaveKey) !== data) {
            status = 'unavailable';
            return false;
          }
          knownSave = data;
          status = 'saved';
        } else if (status === 'unavailable') status = 'saved';
        return true;
      } catch {
        status = 'unavailable';
        return false;
      }
    },
  };
}

if (typeof module !== 'undefined') module.exports = {createCrossingSave, crossingSaveKey};
