import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { useRouter } from 'expo-router';
import { Button, useTheme } from 'heroui-native';
import { ArrowUpRight, House, Layers2, X } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { designPages } from '@/shared/content/design-pages';
import { useApp } from '@/shared/providers/app-provider';
import { themeOptions } from '@/shared/theme/palettes';

export function DesignDrawer(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const { profile, themeId } = useApp();
  const router = useRouter();
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
      <View className="mb-9 flex-row items-center justify-between pt-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
            <Layers2 size={22} color={colors.accentSoftForeground} />
          </View>
          <View>
            <Text className="text-lg font-semibold text-foreground">澄序</Text>
            <Text className="text-xs text-muted-foreground">DESIGN COMPANION</Text>
          </View>
        </View>
        <Button
          isIconOnly
          variant="ghost"
          className="h-11 w-11"
          accessibilityLabel="关闭设计目录"
          onPress={() => props.navigation.closeDrawer()}
        >
          <X size={20} color={colors.mutedForeground} />
        </Button>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          props.navigation.closeDrawer();
          router.navigate('/');
        }}
        className="mb-8 min-h-12 flex-row items-center gap-3 rounded-xl bg-surface px-4 active:opacity-60"
      >
        <House size={20} color={colors.foreground} />
        <Text className="text-base font-medium text-foreground">返回首页</Text>
      </Pressable>
      <Text className="mb-3 px-3 text-xs tracking-widest text-muted-foreground">设计手册</Text>
      <View className="gap-2">
        {designPages.map(({ title, caption, icon: Icon, path }) => (
          <Pressable
            key={path}
            accessibilityRole="button"
            accessibilityLabel={`打开${title}`}
            onPress={() => {
              props.navigation.closeDrawer();
              router.push(path);
            }}
            className="min-h-[72px] flex-row items-center gap-3 rounded-xl px-3 active:bg-surface-1"
          >
            <Icon size={21} strokeWidth={1.7} color={colors.foreground} />
            <View className="flex-1 gap-1">
              <Text className="text-base font-medium text-foreground">{title}</Text>
              <Text className="text-[10px] tracking-widest text-muted-foreground">{caption}</Text>
            </View>
            <ArrowUpRight size={16} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
      <View className="mt-auto gap-3 border-t border-divider px-3 pb-4 pt-6">
        <Text className="text-sm font-medium text-foreground">{profile.name}的随身设计空间</Text>
        <Text className="text-xs text-muted-foreground">
          {themeOptions.find(({ id }) => id === themeId)?.name} · CX / 01
        </Text>
      </View>
    </DrawerContentScrollView>
  );
}
