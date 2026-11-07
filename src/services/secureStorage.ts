import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Armazenamento seguro (Keychain/Keystore) no celular; AsyncStorage na web. */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

