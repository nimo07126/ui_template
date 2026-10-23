import { useRouter } from 'expo-router';
import { Button, Card, useTheme } from 'heroui-native';
import { ArrowRight, Layers2, Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { designPages } from '@/shared/content/design-pages';
import { useApp } from '@/shared/providers/app-provider';
import { themeOptions } from '@/shared/theme/palettes';
import { DesignRow } from '@/shared/ui/design-row';
import { PageIntro, Screen, SectionTitle } from '@/shared/ui/screen';

export function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, themeId } = useApp();
  const currentTheme = themeOptions.find(({ id }) => id === themeId)!;
  return (
    <Screen>
      <PageIntro
        eyebrow={`你好，${profile.name}`}
        title={'为内容留白，\n为重点着色。'}
        description="一套安静、清晰的界面语言。把恰到好处的设计，装进口袋。"
      />
      <Card className="gap-5 rounded-3xl bg-surface p-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-accent" />
            <Text className="text-xs font-medium tracking-widest text-muted-foreground">
              当前主题
            </Text>
          </View>
          <Layers2 size={19} color={colors.mutedForeground} strokeWidth={1.5} />
        </View>
        <View className="gap-1">
          <Card.Title className="text-[24px] font-semibold text-foreground">
            {currentTheme.name}
          </Card.Title>
          <Card.Description className="text-sm text-muted-foreground">
            {currentTheme.description}
          </Card.Description>
        </View>
        <View className="h-12 flex-row gap-1.5" accessibilityLabel="当前主题色板">
          {[colors.background, colors.foreground, colors.accent, colors.accentSoft].map(
            (color, index) => (
              <View
                key={index}
                className="rounded-xl border border-border"
                style={{ backgroundColor: color, flex: index === 0 ? 2 : 1 }}
              />
            ),
          )}
        </View>
        <Button onPress={() => router.push('/design/colors')} className="rounded-xl">
          <Button.Label>探索设计主题</Button.Label>
          <ArrowRight size={17} color={colors.accentForeground} />
        </Button>
      </Card>
      <View className="gap-3">
        <SectionTitle title="设计基础" trailing="04 个章节" />
        <View className="overflow-hidden rounded-2xl bg-surface">
          {designPages.map((page, index) => (
            <DesignRow key={page.path} page={page} last={index === designPages.length - 1} />
          ))}
        </View>
      </View>
      <View className="flex-row items-start gap-3 px-1 pb-2">
        <Sparkles size={18} color={colors.accent} strokeWidth={1.6} />
        <View className="flex-1 gap-1">
          <Text className="text-sm font-medium text-foreground">清晰，胜过装饰。</Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            {'少一点视觉噪声，多一点内容的空间。\n从一个颜色、一处间距开始。'}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
