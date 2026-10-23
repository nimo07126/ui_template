import { useRouter } from 'expo-router';
import { useTheme } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import type { DesignPage } from '@/shared/content/design-pages';

export function DesignRow({ page, last = false }: { page: DesignPage; last?: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();
  const Icon = page.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开${page.title}`}
      onPress={() => router.push(page.path)}
      className="min-h-[80px] flex-row items-center gap-3 px-4 active:bg-surface-1"
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-surface-1">
        <Icon size={21} color={colors.foreground} strokeWidth={1.6} />
      </View>
      <View
        className={`min-h-[80px] flex-1 flex-row items-center gap-2 py-4 ${last ? '' : 'border-b border-divider'}`}
      >
        <View className="flex-1 gap-1">
          <Text className="text-base font-medium text-foreground">{page.title}</Text>
          <Text className="text-xs leading-5 text-muted-foreground">{page.subtitle}</Text>
        </View>
        <ChevronRight size={17} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}
