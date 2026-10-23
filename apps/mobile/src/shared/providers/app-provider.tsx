import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeroUINativeProvider } from 'heroui-native';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { heroTheme, palettes, themeOptions, type ThemeId } from '@/shared/theme/palettes';

const STORAGE_KEY = 'chengxu.mobile.v1';
type Profile = { name: string; bio: string };
type Preferences = { themeId: ThemeId; profile: Profile };
const defaults: Preferences = {
  themeId: 'studio',
  profile: { name: '设计者', bio: '在细节里，找到恰到好处。' },
};
type AppContextValue = Preferences & {
  setThemeId: (id: ThemeId) => void;
  updateProfile: (profile: Profile) => void;
  storageError: string | null;
  isSaving: boolean;
};
const AppContext = createContext<AppContextValue | null>(null);

function parsePreferences(raw: string): Preferences {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid preferences');
  const candidate = value as Partial<Preferences>;
  if (
    !themeOptions.some(({ id }) => id === candidate.themeId) ||
    typeof candidate.profile?.name !== 'string' ||
    !candidate.profile.name.trim() ||
    typeof candidate.profile?.bio !== 'string'
  )
    throw new Error('Invalid preferences');
  return {
    themeId: candidate.themeId!,
    profile: {
      name: candidate.profile.name.slice(0, 24),
      bio: candidate.profile.bio.slice(0, 80),
    },
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const skipInitialSave = useRef(true);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (active && raw) setPreferences(parsePreferences(raw));
      })
      .catch(() => {
        if (active) setStorageError('无法恢复本机设置，已使用默认主题。');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }
    let active = true;
    setIsSaving(true);
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)))
      .then(() => {
        if (active) setStorageError(null);
      })
      .catch(() => {
        if (active) setStorageError('本机保存失败，当前修改仍保留在本次会话中。');
      })
      .finally(() => {
        if (active) setIsSaving(false);
      });
    return () => {
      active = false;
    };
  }, [preferences, ready]);

  if (!ready)
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: palettes.studio.background }}
      >
        <ActivityIndicator accessibilityLabel="正在恢复设置" color={palettes.studio.accent} />
      </View>
    );
  const themeId = preferences.themeId;
  return (
    <AppContext.Provider
      value={{
        ...preferences,
        storageError,
        isSaving,
        setThemeId: (id) => setPreferences((previous) => ({ ...previous, themeId: id })),
        updateProfile: (profile) => setPreferences((previous) => ({ ...previous, profile })),
      }}
    >
      <HeroUINativeProvider
        config={{ theme: heroTheme(themeId), colorScheme: themeId === 'night' ? 'dark' : 'light' }}
      >
        {children}
      </HeroUINativeProvider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be inside AppProvider');
  return context;
}
