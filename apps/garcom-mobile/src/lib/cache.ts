import AsyncStorage from '@react-native-async-storage/async-storage';

export async function readCache<T>(key: string): Promise<T | null> {
  const value = await AsyncStorage.getItem(key);
  if (!value) {
    return null;
  }
  return JSON.parse(value) as T;
}

export async function writeCache<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
