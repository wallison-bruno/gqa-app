import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface NativeSecureStore {
  getValueWithKeyAsync?: (key: string, options: Record<string, unknown>) => Promise<string | null>;
  setValueWithKeyAsync?: (value: string, key: string, options: Record<string, unknown>) => Promise<void>;
  deleteValueWithKeyAsync?: (key: string, options: Record<string, unknown>) => Promise<void>;
}

const nativeStore: NativeSecureStore | null =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<NativeSecureStore>('ExpoSecureStore');

/**
 * Armazenamento seguro (Keychain/Keystore) quando o módulo nativo ExpoSecureStore está disponível;
 * faz fallback automático para AsyncStorage na web ou em builds onde o módulo nativo não foi incluído.
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (nativeStore?.getValueWithKeyAsync) {
      try {
        return await nativeStore.getValueWithKeyAsync(key, {});
      } catch {
        return AsyncStorage.getItem(key);
      }
    }
    return AsyncStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (nativeStore?.setValueWithKeyAsync) {
      try {
        await nativeStore.setValueWithKeyAsync(value, key, {});
        return;
      } catch {
        // fallback para AsyncStorage
      }
    }
    await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    if (nativeStore?.deleteValueWithKeyAsync) {
      try {
        await nativeStore.deleteValueWithKeyAsync(key, {});
        return;
      } catch {
        // fallback para AsyncStorage
      }
    }
    await AsyncStorage.removeItem(key);
  },
};
