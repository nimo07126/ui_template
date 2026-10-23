import '../../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/shared/providers/app-provider';

export const unstable_settings = { initialRouteName: '(drawer)' };

function RootNavigator() {
  const { colors, isDark } = useTheme();
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: {
          ...navigationTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.foreground,
          primary: colors.accent,
          border: colors.border,
          notification: colors.danger,
        },
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.foreground, fontSize: 17 },
          headerShadowVisible: false,
          headerBackTitle: '返回',
          contentStyle: { backgroundColor: colors.background },
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen name="design/colors" options={{ title: '颜色与主题' }} />
        <Stack.Screen name="design/typography" options={{ title: '字体与排版' }} />
        <Stack.Screen name="design/spacing" options={{ title: '间距与圆角' }} />
        <Stack.Screen name="design/showcase" options={{ title: '组件预览' }} />
        <Stack.Screen name="profile-edit" options={{ title: '编辑资料', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <RootNavigator />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
