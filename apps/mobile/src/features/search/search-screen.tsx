import { Button, TextField, useTheme } from 'heroui-native';
import { Search, SearchX, X } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { searchEntries } from '@/shared/content/design-pages';
import { DesignRow } from '@/shared/ui/design-row';
import { PageIntro, Screen, SectionTitle } from '@/shared/ui/screen';

const filters = ['全部', '设计基础', '组件'] as const;
export function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]>('全部');
  const normalized = query.trim().toLocaleLowerCase();
  const entries = searchEntries.filter((entry) => {
    const isComponent = entry.path === '/design/showcase';
    return (
      (filter === '全部' || (filter === '组件' ? isComponent : !isComponent)) &&
      `${entry.title} ${entry.subtitle} ${entry.keywords}`.toLocaleLowerCase().includes(normalized)
    );
  });
  return (
    <Screen>
      <PageIntro
        eyebrow="FIND YOUR INSPIRATION"
        title="找到，刚刚好。"
        description="搜索颜色、排版和组件，让灵感更快落地。"
      />
      <TextField>
        <TextField.Input
          accessibilityLabel="搜索设计内容"
          value={query}
          onChangeText={setQuery}
          placeholder="试试「颜色」或「Button」"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        >
          <TextField.InputStartContent>
            <Search size={19} color={colors.mutedForeground} />
          </TextField.InputStartContent>
          {query.length > 0 && (
            <TextField.InputEndContent>
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                className="h-11 w-11"
                accessibilityLabel="清空搜索"
                onPress={() => setQuery('')}
              >
                <X size={17} color={colors.mutedForeground} />
              </Button>
            </TextField.InputEndContent>
          )}
        </TextField.Input>
      </TextField>
      <View className="flex-row flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? 'secondary' : 'ghost'}
            onPress={() => setFilter(item)}
            accessibilityState={{ selected: filter === item }}
            aria-pressed={filter === item}
            className="min-h-11 rounded-full px-5"
          >
            <Button.Label>{item}</Button.Label>
          </Button>
        ))}
      </View>
      <View className="gap-3">
        <SectionTitle
          title={normalized ? '搜索结果' : '探索手册'}
          trailing={`${entries.length} 项`}
        />
        {entries.length > 0 ? (
          <View className="overflow-hidden rounded-2xl bg-surface">
            {entries.map((page, index) => (
              <DesignRow key={page.title} page={page} last={index === entries.length - 1} />
            ))}
          </View>
        ) : (
          <View className="items-center gap-3 rounded-2xl bg-surface px-6 py-12">
            <SearchX size={30} color={colors.mutedForeground} strokeWidth={1.5} />
            <Text className="text-base font-medium text-foreground">还没有找到相关内容</Text>
            <Text className="text-center text-sm leading-6 text-muted-foreground">
              换一个关键词，或查看全部设计内容。
            </Text>
            <Button
              variant="secondary"
              onPress={() => {
                setQuery('');
                setFilter('全部');
              }}
            >
              查看全部
            </Button>
          </View>
        )}
      </View>
      {!normalized && (
        <View className="gap-3">
          <SectionTitle title="灵感关键词" />
          <View className="flex-row flex-wrap gap-2">
            {['颜色', '圆角', 'Button', '输入', '夜间'].map((word) => (
              <Button
                key={word}
                variant="tertiary"
                size="sm"
                className="min-h-11 rounded-full"
                onPress={() => setQuery(word)}
              >
                <Button.Label>{word}</Button.Label>
              </Button>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}
