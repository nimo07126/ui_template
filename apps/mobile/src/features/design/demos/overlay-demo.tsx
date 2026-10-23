import { Accordion, Dialog, useTheme } from 'heroui-native';
import { Layers2 } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SectionTitle } from '@/shared/ui/screen';

export function OverlayDemo() {
  const { colors } = useTheme();
  return (
    <View className="gap-3">
      <SectionTitle title="按需展开，保持专注" trailing="Accordion · Dialog" />
      <View className="gap-4 rounded-2xl bg-surface p-5">
        <Accordion selectionMode="single" variant="border">
          <Accordion.Item value="principles">
            <Accordion.Trigger>
              <Text className="flex-1 text-sm font-medium text-foreground">
                为什么选择克制的界面？
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <Text className="pb-4 text-sm leading-6 text-muted-foreground">
                让装饰退后一步，让内容向前一步。层级来自字体与空间，颜色只在需要时发声。
              </Text>
            </Accordion.Content>
          </Accordion.Item>
          <Accordion.Item value="interaction">
            <Accordion.Trigger>
              <Text className="flex-1 text-sm font-medium text-foreground">
                怎样让交互更像 iOS？
              </Text>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <Text className="pb-4 text-sm leading-6 text-muted-foreground">
                清晰的返回路径、足够大的触控区域，以及跟随手势的反馈，让每一步都有迹可循。
              </Text>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion>
        <Dialog>
          <Dialog.Trigger className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-default px-4">
            <Layers2 size={17} color={colors.foreground} />
            <Text className="text-base font-medium text-foreground">打开浮层示例</Text>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="gap-4 rounded-3xl p-6">
              <Dialog.Title>给灵感，一点空间。</Dialog.Title>
              <Dialog.Description>
                需要专注的操作，在此刻浮现。完成后，回到原来的阅读位置。
              </Dialog.Description>
              <Dialog.Close className="min-h-12 items-center justify-center rounded-xl bg-accent px-4">
                <Text className="text-base font-medium text-accent-foreground">完成体验</Text>
              </Dialog.Close>
              <Dialog.Close className="min-h-11 items-center justify-center rounded-xl px-4">
                <Text className="text-base text-foreground">返回预览</Text>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog>
      </View>
    </View>
  );
}
