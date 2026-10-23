import { tokens } from '@template/design-tokens';
import { Text, View } from 'react-native';
import { PageIntro, Screen, SectionTitle } from '@/shared/ui/screen';

const spaces = ['1', '2', '3', '4', '5', '6', '8', '10'] as const;
const radii = [
  ['sm', '小控件'],
  ['md', '输入与按钮'],
  ['lg', '卡片与列表'],
  ['xl', '重点容器'],
] as const;
const points = (value: string) => parseFloat(value) * 16;

export function SpacingScreen() {
  return (
    <Screen>
      <PageIntro
        eyebrow="03 / SPACING & RADIUS"
        title={'留白，\n也是一种秩序。'}
        description="以 4pt 为起点。在关联的内容之间靠近，在不同的层级之间留白。"
      />
      <View className="gap-3">
        <SectionTitle title="间距刻度" trailing="4pt 基础网格" />
        <View className="gap-5 rounded-2xl bg-surface p-5">
          {spaces.map((key) => {
            const size = points(tokens.space[key]);
            return (
              <View key={key} className="flex-row items-center gap-4">
                <Text className="w-10 text-xs text-muted-foreground">{size} pt</Text>
                <View className="h-5 flex-1 justify-center rounded bg-surface-1">
                  <View
                    className="h-5 rounded bg-accent/70"
                    style={{ width: `${(size / 40) * 100}%` }}
                  />
                </View>
                <Text className="w-12 text-right text-xs text-muted-foreground">space.{key}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View className="gap-3">
        <SectionTitle title="柔和，有分寸" trailing="圆角刻度" />
        <View className="flex-row flex-wrap gap-3">
          {radii.map(([key, name]) => (
            <View
              key={key}
              className="min-w-[140px] flex-1 items-center gap-3 rounded-2xl bg-surface px-4 py-5"
            >
              <View
                className="h-16 w-20 border border-accent/30 bg-accent-soft"
                style={{ borderRadius: points(tokens.radius[key]) }}
              />
              <Text className="text-sm font-medium text-foreground">
                {points(tokens.radius[key])} pt
              </Text>
              <Text className="text-xs text-muted-foreground">{name}</Text>
            </View>
          ))}
        </View>
      </View>
      <View className="gap-3">
        <SectionTitle title="一张卡片里的空间" />
        <View className="rounded-2xl border border-dashed border-accent/50 bg-accent-soft p-5">
          <View className="gap-3 rounded-xl bg-surface p-4">
            <Text className="text-base font-semibold text-foreground">
              恰好的距离，让关系清晰。
            </Text>
            <Text className="text-sm leading-6 text-muted-foreground">
              页面边距 20pt，容器内边距 16pt。相关文字相隔 8pt，独立区块之间相隔 24pt。
            </Text>
            <View className="h-px bg-divider" />
            <Text className="text-xs text-accent">触控区域至少 44 × 44pt</Text>
          </View>
        </View>
      </View>
    </Screen>
  );
}
