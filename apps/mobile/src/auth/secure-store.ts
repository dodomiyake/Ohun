import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'ohun.native.refresh-token.v1';

export interface CredentialStore {
  readRefreshToken(): Promise<string | null>;
  writeRefreshToken(token: string): Promise<void>;
  deleteRefreshToken(): Promise<void>;
}

export const nativeCredentialStore: CredentialStore = {
  readRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  writeRefreshToken: (token) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }),
  deleteRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
