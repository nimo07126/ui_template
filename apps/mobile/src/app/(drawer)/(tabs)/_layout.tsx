import { useNavigation } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { DrawerActions } from 'expo-router/react-navigation';
import { Button, useTheme } from 'heroui-native';
import { House, Menu, Search, UserRound } from 'lucide-react-native';

function DrawerToggle() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  return (
    <Button
      variant="ghost"
      isIconOnly
      className="ml-2 h-11 w-11"
      accessibilityLabel="打开设计目录"
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
    >
      <Menu size={22} strokeWidth={1.7} color={colors.foreground} />
    </Button>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontSize: 17, fontWeight: '600' },
        headerLeft: () => <DrawerToggle />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '澄序',
          tabBarLabel: '首页',
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '搜索',
          tabBarLabel: '搜索',
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '个人空间',
          tabBarLabel: '我的',
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}
