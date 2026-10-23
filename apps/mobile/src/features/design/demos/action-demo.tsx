import { Button, Chip, useTheme } from 'heroui-native';
import { Check, Heart, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SectionTitle } from '@/shared/ui/screen';

export function ActionDemo() {
  const [saved, setSaved] = useState(false);
  const { colors } = useTheme();
  return (
    <View className="gap-3">
      <SectionTitle title="操作，分清主次" trailing="Button · Chip" />
      <View className="gap-4 rounded-2xl bg-surface p-5">
        <Button onPress={() => setSaved((value) => !value)}>
          {saved ? (
            <Check size={18} color={colors.accentForeground} />
          ) : (
            <Plus size={18} color={colors.accentForeground} />
          )}
          <Button.Label>{saved ? '已加入灵感清单' : '加入灵感清单'}</Button.Label>
        </Button>
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() => setSaved(false)}
            isDisabled={!saved}
          >
            移出清单
          </Button>
          <Button
            variant="tertiary"
            isIconOnly
            accessibilityLabel={saved ? '取消收藏' : '收藏灵感'}
            accessibilityState={{ selected: saved }}
              aria-pressed={saved}
            onPress={() => setSaved((value) => !value)}
          >
            <Heart
              size={19}
              color={saved ? colors.accent : colors.foreground}
              fill={saved ? colors.accent : 'transparent'}
            />
          </Button>
          <Button isDisabled variant="secondary">
            暂不可用
          </Button>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Chip size="sm" variant="secondary" color="accent">
            设计灵感
          </Chip>
          <Chip size="sm" variant="secondary" color="success">
            可交互
          </Chip>
          <Chip size="sm" variant="secondary">
            轻量留白
          </Chip>
        </View>
        <Text accessibilityLiveRegion="polite" className="text-xs leading-5 text-muted-foreground">
          {saved ? '已收藏当前灵感，再次点击可取消。' : '每个区域，只保留一个清晰的主要行动。'}
        </Text>
      </View>
    </View>
  );
}
