import { Text } from 'react-native';
import { PageIntro, Screen } from '@/shared/ui/screen';
import { ActionDemo } from './demos/action-demo';
import { FormDemo } from './demos/form-demo';
import { OverlayDemo } from './demos/overlay-demo';

export function ShowcaseScreen() {
  return (
    <Screen>
      <PageIntro
        eyebrow="04 / COMPONENTS"
        title={'细节，\n可以亲手感受。'}
        description="点击一个按钮，填写一段文字。让简单的组件，组成自然的体验。"
      />
      <ActionDemo />
      <FormDemo />
      <OverlayDemo />
      <Text className="px-1 text-xs leading-5 text-muted-foreground">
        示例状态仅用于体验，离开页面后重置。你的全局主题与个人资料会继续保留。
      </Text>
    </Screen>
  );
}
