import { Drawer } from 'expo-router/drawer';
import { useTheme } from 'heroui-native';
import { DesignDrawer } from '@/shared/navigation/design-drawer';

export default function DrawerLayout() {
  const { colors } = useTheme();
  return (
    <Drawer
      drawerContent={(props) => <DesignDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { backgroundColor: colors.background, width: 308 },
        swipeEdgeWidth: 32,
      }}
    >
      <Drawer.Screen name="(tabs)" options={{ title: '澄序', drawerLabel: '概览' }} />
    </Drawer>
  );
}
