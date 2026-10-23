import { useTheme } from 'heroui-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '@/shared/providers/app-provider';
import { palettes, themeOptions } from '@/shared/theme/palettes';
import { PageIntro, Screen, SectionTitle } from '@/shared/ui/screen';

const roles = [
  ['background', '页面背景', '留白与整体画布'],
  ['surface', '基础表面', '卡片、列表与内容分组'],
  ['foreground', '主要内容', '标题、正文与图标'],
  ['mutedForeground', '辅助内容', '说明、时间与元数据'],
  ['accent', '主要强调', '主行动、选中与焦点'],
  ['border', '边界与分隔', '轻量划分内容层级'],
  ['success', '成功反馈', '完成、通过与有效'],
  ['warning', '提醒反馈', '需要注意或复核'],
  ['danger', '危险反馈', '错误与破坏性操作'],
] as const;

export function ColorsScreen() {
  const { themeId, setThemeId, isSaving, storageError } = useApp();
  const { colors } = useTheme();
  const palette = palettes[themeId];
  return (
    <Screen>
      <PageIntro
        eyebrow="01 / COLOR & THEME"
        title={'重点，\n值得被看见。'}
        description="中性色承载内容，强调色标记下一步。选择一个适合当下的主题。"
      />
      <View className="gap-3">
        <SectionTitle title="四种心境，同一种秩序" trailing="全局预览" />
        <View accessibilityRole="radiogroup" className="gap-3">
          {themeOptions.map((theme) => {
            const selected = theme.id === themeId;
            const preview = palettes[theme.id];
            return (
              <Pressable
                key={theme.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                accessibilityLabel={theme.name}
                onPress={() => setThemeId(theme.id)}
                className={`gap-4 rounded-2xl border p-4 active:opacity-75 ${selected ? 'border-accent bg-surface' : 'border-transparent bg-surface'}`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-medium text-foreground">{theme.name}</Text>
                    <Text className="text-xs text-muted-foreground">{theme.description}</Text>
                  </View>
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-accent' : 'border border-border'}`}
                  >
                    {selected && (
                      <Check size={15} color={colors.accentForeground} strokeWidth={2.2} />
                    )}
                  </View>
                </View>
                <View className="h-9 flex-row gap-1.5">
                  {[preview.background, preview.surface, preview.foreground, preview.accent].map(
                    (color, i) => (
                      <View
                        key={i}
                        className="flex-1 rounded-lg border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ),
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View className="flex-row items-center gap-2 px-1">
          <CheckCheck size={15} color={storageError ? colors.danger : colors.mutedForeground} />
          <Text accessibilityLiveRegion="polite" className="flex-1 text-xs text-muted-foreground">
            {storageError
              ? '当前主题已应用，本机保存失败。'
              : isSaving
                ? '正在保存主题…'
                : '已应用到全部页面，并保存在本机。'}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <SectionTitle title="颜色，各司其职" trailing={`${roles.length} 个核心角色`} />
        <View className="overflow-hidden rounded-2xl bg-surface">
          {roles.map(([key, name, description], index) => (
            <View key={key} className="flex-row items-center gap-3 px-4">
              <View
                className="h-10 w-10 rounded-xl border border-border"
                style={{ backgroundColor: palette[key] }}
              />
              <View
                className={`flex-1 gap-1 py-4 ${index === roles.length - 1 ? '' : 'border-b border-divider'}`}
              >
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-sm font-medium text-foreground">{name}</Text>
                  <Text selectable className="text-xs uppercase text-muted-foreground">
                    {palette[key]}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">{description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <Text className="px-1 text-xs leading-5 text-muted-foreground">
        颜色与 Web 共用同一份设计 token。深色主题通过表面亮度建立层级，让夜间阅读更舒适。
      </Text>
    </Screen>
  );
}
