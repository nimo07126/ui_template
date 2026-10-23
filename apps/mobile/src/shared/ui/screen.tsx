import { Text, ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useApp } from '@/shared/providers/app-provider';

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { storageError } = useApp();
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 16 }}
      >
        <View className="mx-auto w-full max-w-xl gap-7 px-5 pt-5">
          {storageError && (
            <Text
              accessibilityRole="alert"
              className="rounded-xl bg-danger/10 p-4 text-sm text-danger"
            >
              {storageError}
            </Text>
          )}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <View className="gap-3">
      <Text className="text-xs font-medium tracking-widest text-muted-foreground">{eyebrow}</Text>
      <Text
        accessibilityRole="header"
        className="text-[32px] font-semibold leading-[40px] tracking-tight text-foreground"
      >
        {title}
      </Text>
      <Text className="text-[15px] leading-6 text-muted-foreground">{description}</Text>
    </View>
  );
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text accessibilityRole="header" className="text-lg font-semibold text-foreground">
        {title}
      </Text>
      {trailing && <Text className="text-xs text-muted-foreground">{trailing}</Text>}
    </View>
  );
}
