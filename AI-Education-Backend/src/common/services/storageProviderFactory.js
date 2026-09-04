import LocalStorageProvider from './localStorageProvider.js';

let providerInstance;

export const createStorageProvider = () => new LocalStorageProvider();

export const getStorageProvider = () => {
  if (!providerInstance) {
    providerInstance = createStorageProvider();
  }

  return providerInstance;
};

export const resetStorageProviderForTests = () => {
  providerInstance = null;
};
