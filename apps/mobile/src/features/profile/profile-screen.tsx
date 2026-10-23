import { useRouter } from 'expo-router';
import { Avatar, Button, Dialog, Switch, useTheme } from 'heroui-native';
import { Blocks, ChevronRight, Info, Moon, Palette, Pencil } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '@/shared/providers/app-provider';
import { themeOptions } from '@/shared/theme/palettes';
import { Screen, SectionTitle } from '@/shared/ui/screen';

export function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, themeId, setThemeId, storageError, isSaving } = useApp();
  const themeName = themeOptions.find(({ id }) => id === themeId)!.name;
  return (
    <Screen>
      <View className="items-center gap-3 pb-2 pt-4">
        <Avatar size="lg" color="accent" className="h-20 w-20" alt={`${profile.name}的头像`}>
          <Avatar.Fallback>
            <Text className="text-2xl font-medium text-accent-soft-foreground">
              {Array.from(profile.name)[0]}
            </Text>
          </Avatar.Fallback>
        </Avatar>
        <Text accessibilityRole="header" className="mt-1 text-2xl font-semibold text-foreground">
          {profile.name}
        </Text>
        <Text className="text-center text-sm leading-6 text-muted-foreground">
          {profile.bio || '给自己留一点灵感的空间。'}
        </Text>
        <Button
          size="sm"
          variant="secondary"
          className="mt-1 min-h-11 rounded-full px-5"
          onPress={() => router.push('/profile-edit')}
        >
          <Pencil size={14} color={colors.foreground} />
          <Button.Label>编辑资料</Button.Label>
        </Button>
      </View>
      <View className="gap-3">
        <SectionTitle title="让界面，更像你" />
        <View className="overflow-hidden rounded-2xl bg-surface">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/design/colors')}
            className="min-h-[68px] flex-row items-center gap-3 px-4 active:bg-surface-1"
          >
            <Palette size={20} color={colors.foreground} strokeWidth={1.7} />
            <View className="min-h-[68px] flex-1 flex-row items-center gap-2 border-b border-divider">
              <Text className="flex-1 text-base text-foreground">主题偏好</Text>
              <Text className="text-sm text-muted-foreground">{themeName}</Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
          <View className="min-h-[68px] flex-row items-center gap-3 px-4">
            <Moon size={20} color={colors.foreground} strokeWidth={1.7} />
            <Text className="flex-1 text-base text-foreground">夜间模式</Text>
            <View className="min-h-11 min-w-11 items-center justify-center">
              <Switch
                accessibilityLabel="夜间模式"
                isSelected={themeId === 'night'}
                onSelectedChange={(selected) => setThemeId(selected ? 'night' : 'studio')}
              />
            </View>
          </View>
        </View>
        <Text className="px-3 text-xs leading-5 text-muted-foreground">
          {storageError
            ? '设置暂未保存'
            : isSaving
              ? '正在保存到本机…'
              : '主题与个人资料自动保存在这台设备。'}
        </Text>
      </View>
      <View className="gap-3">
        <SectionTitle title="继续探索" />
        <View className="overflow-hidden rounded-2xl bg-surface">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/design/showcase')}
            className="min-h-[64px] flex-row items-center gap-3 px-4 active:bg-surface-1"
          >
            <Blocks size={20} color={colors.foreground} strokeWidth={1.7} />
            <View className="min-h-[64px] flex-1 flex-row items-center border-b border-divider">
              <Text className="flex-1 text-base text-foreground">组件体验</Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
          <Dialog>
            <Dialog.Trigger className="min-h-[64px] flex-row items-center gap-3 px-4 active:bg-surface-1">
              <Info size={20} color={colors.foreground} strokeWidth={1.7} />
              <Text className="flex-1 text-base text-foreground">关于澄序</Text>
              <ChevronRight size={16} color={colors.mutedForeground} />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay />
              <Dialog.Content className="gap-4 rounded-3xl p-6">
                <Dialog.Title>为重要的事，留一点空间。</Dialog.Title>
                <Dialog.Description>
                  澄序是一份随身设计手册。从颜色、排版到组件，探索安静、清晰的界面语言。
                </Dialog.Description>
                <Dialog.Close className="min-h-12 items-center justify-center rounded-xl bg-accent px-4">
                  <Text className="text-base font-medium text-accent-foreground">继续探索</Text>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog>
        </View>
      </View>
      <View className="items-center gap-2 py-5">
        <Text className="text-sm font-medium tracking-widest text-muted-foreground">
          澄序 · CHENGXU
        </Text>
        <Text className="text-xs text-muted-foreground">清晰有序，自在留白。 / 1.0.0</Text>
      </View>
    </Screen>
  );
}
