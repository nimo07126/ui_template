import { Button, Checkbox, Switch, TextField } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SectionTitle } from '@/shared/ui/screen';

export function FormDemo() {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(true);
  const [checked, setChecked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [success, setSuccess] = useState(false);
  const invalid = submitted && !name.trim();
  return (
    <View className="gap-3">
      <SectionTitle title="输入，有温度的反馈" trailing="TextField · Switch" />
      <View className="gap-5 rounded-2xl bg-surface p-5">
        <TextField isRequired isInvalid={invalid}>
          <TextField.Label>灵感名称</TextField.Label>
          <TextField.Input
            accessibilityLabel="灵感名称"
            placeholder="给灵感起一个名字"
            maxLength={40}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setSuccess(false);
            }}
          />
          <TextField.Description>简短一点，让它更好被记住。</TextField.Description>
          <TextField.ErrorMessage>请先填写灵感名称</TextField.ErrorMessage>
        </TextField>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-sm font-medium text-foreground">允许后续修改</Text>
            <Text className="text-xs text-muted-foreground">打开后，可继续完善这条灵感</Text>
          </View>
          <View className="min-h-11 min-w-11 items-center justify-center">
            <Switch
              accessibilityLabel="允许后续修改"
              isSelected={selected}
              onSelectedChange={setSelected}
            />
          </View>
        </View>
        <View className="min-h-11 flex-row items-center gap-3">
          <Checkbox
            accessibilityLabel="标记为精选灵感"
            isSelected={checked}
            onSelectedChange={setChecked}
            hitSlop={12}
          />
          <Text
            className="flex-1 text-sm text-foreground"
            onPress={() => setChecked((value) => !value)}
          >
            标记为精选灵感
          </Text>
        </View>
        <Button
          variant="secondary"
          onPress={() => {
            setSubmitted(true);
            setSuccess(Boolean(name.trim()));
          }}
        >
          预览提交
        </Button>
        {success && (
          <View accessibilityLiveRegion="polite" className="gap-1 rounded-xl bg-success/10 p-3">
            <Text className="text-sm font-medium text-success">「{name.trim()}」已通过校验</Text>
            <Text className="text-xs leading-5 text-muted-foreground">
              {checked ? '精选灵感' : '普通灵感'} · {selected ? '允许后续修改' : '仅供查看'}
              。此示例仅在当前页面演示。
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
