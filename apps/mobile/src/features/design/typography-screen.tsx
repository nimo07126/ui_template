import { tokens } from '@template/design-tokens';
import { Text, View } from 'react-native';
import { PageIntro, Screen, SectionTitle } from '@/shared/ui/screen';

const specimens = [
  { name: '展示标题', key: 'headingLarge', weight: '600', sample: '让界面，安静下来。' },
  { name: '页面标题', key: 'headingMedium', weight: '600', sample: '清晰，从层级开始。' },
  { name: '区块标题', key: 'headingXs', weight: '600', sample: '设计里的恰到好处' },
  {
    name: '内容正文',
    key: 'bodyMedium',
    weight: '400',
    sample: '文字是内容的声音。让字号、行高与留白，共同构成舒适的阅读节奏。',
  },
  {
    name: '辅助说明',
    key: 'bodySmall',
    weight: '400',
    sample: '用来补充信息，让主要内容保持专注。',
  },
  { name: '标签与注释', key: 'labelSmall', weight: '500', sample: 'CHENGXU · 少一点，刚刚好。' },
] as const;
const points = (value: string) => parseFloat(value) * 16;

export function TypographyScreen() {
  return (
    <Screen>
      <PageIntro
        eyebrow="02 / TYPOGRAPHY"
        title={'让阅读，\n自有节奏。'}
        description="使用系统字体，把注意力交给内容。通过字号、字重与行距，建立自然的阅读顺序。"
      />
      <View className="gap-3">
        <SectionTitle title="文字层级" trailing="系统字体 / SF · 苹方" />
        <View className="rounded-2xl bg-surface px-5">
          {specimens.map(({ name, key, weight, sample }, index) => (
            <View
              key={key}
              className={`gap-4 py-6 ${index === specimens.length - 1 ? '' : 'border-b border-divider'}`}
            >
              <View className="flex-row justify-between gap-2">
                <Text className="text-xs text-muted-foreground">{name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {points(tokens.type.size[key])} / {points(tokens.type.line[key])} pt · {weight}
                </Text>
              </View>
              <Text
                className="text-foreground"
                style={{
                  fontSize: points(tokens.type.size[key]),
                  lineHeight: points(tokens.type.line[key]),
                  fontWeight: weight,
                }}
              >
                {sample}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View className="gap-3">
        <SectionTitle title="写给小屏幕的排版规则" />
        <View className="gap-5 rounded-2xl bg-surface p-5">
          {[
            [
              '01',
              '先分主次，再加颜色',
              '先用字号、字重和留白区分信息，强调色留给真正重要的内容。',
            ],
            [
              '02',
              '给正文多一点呼吸',
              '正文使用 16pt，行高约 24pt。中文、数字与英文混排也保持舒展。',
            ],
            ['03', '尊重每一种阅读习惯', '保留系统字号缩放，让大字体用户也能自然阅读。'],
          ].map(([number, title, body]) => (
            <View key={number} className="flex-row gap-4">
              <Text className="pt-0.5 text-xs text-accent">{number}</Text>
              <View className="flex-1 gap-2">
                <Text className="text-sm font-medium text-foreground">{title}</Text>
                <Text className="text-sm leading-6 text-muted-foreground">{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
