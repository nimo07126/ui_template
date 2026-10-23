import { Stack, useRouter } from 'expo-router';
import { Button, TextField } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '@/shared/providers/app-provider';
import { PageIntro, Screen } from '@/shared/ui/screen';

export function ProfileEditor() {
  const router = useRouter();
  const { profile, updateProfile } = useApp();
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [submitted, setSubmitted] = useState(false);
  const invalid = submitted && !name.trim();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  return (
    <Screen>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <Button variant="ghost" onPress={close}>
              取消
            </Button>
          ),
        }}
      />
      <PageIntro
        eyebrow="YOUR PERSONAL SPACE"
        title="从认识你开始。"
        description="一个名字，一句自我介绍。把这里变成自己的小小空间。"
      />
      <View className="gap-6 rounded-2xl bg-surface p-5">
        <TextField isRequired isInvalid={invalid}>
          <TextField.Label>昵称</TextField.Label>
          <TextField.Input
            accessibilityLabel="昵称"
            placeholder="怎么称呼你？"
            value={name}
            onChangeText={setName}
            maxLength={24}
            autoComplete="nickname"
            returnKeyType="next"
          />
          <TextField.ErrorMessage>请输入昵称</TextField.ErrorMessage>
        </TextField>
        <TextField>
          <TextField.Label>一句话介绍</TextField.Label>
          <TextField.Input
            accessibilityLabel="一句话介绍"
            placeholder="记录一句此刻喜欢的话"
            value={bio}
            onChangeText={setBio}
            maxLength={80}
            multiline
            numberOfLines={3}
            className="min-h-[100px]"
            textAlignVertical="top"
          />
          <TextField.Description>{bio.length} / 80</TextField.Description>
        </TextField>
      </View>
      <Button
        onPress={() => {
          setSubmitted(true);
          if (name.trim()) {
            updateProfile({ name: name.trim(), bio: bio.trim() });
            close();
          }
        }}
      >
        保存资料
      </Button>
      <Text className="text-center text-xs text-muted-foreground">
        资料仅保存在本机，随时可以修改。
      </Text>
    </Screen>
  );
}
