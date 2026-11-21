import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { EMPTY_WIDGET, plistSafe, type PartnerWidgetProps } from '../lib/widgetProps';

// Runs in the widget's isolated runtime: no hooks, no imports at call time,
// so every constant lives inside the function. Colours mirror theme.ts.
// The layout is stored by the app at runtime, so it can change by OTA update.
const PartnerWidget = (props: PartnerWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const accent = '#D9485F';
  const ink = '#2B2725';
  const muted = '#8C847C';
  const card = '#FBF7F2';
  const lockScreen = env.widgetFamily === 'accessoryRectangular';

  const hasDistance = !!props.distance;
  const hasUpdate = !!props.updatedAt && props.updatedAt > 0;
  const headline = !hasDistance ? '' : props.nearby ? 'ממש לידך' : props.distance;
  const status = props.paused ? 'השיתוף מושהה' : !hasDistance ? 'עוד לא התקבל מיקום' : props.place || '';

  if (lockScreen) {
    return (
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{`❤️ ${props.name || ''}`}</Text>
        <Text modifiers={[font({ size: 17, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>
          {headline || status || ''}
        </Text>
        {hasUpdate && !props.paused && (
          <Text modifiers={[font({ textStyle: 'caption2' }), lineLimit(1)]}>
            <Text>{'לפני '}</Text>
            <Text date={new Date(props.updatedAt)} dateStyle="relative" />
          </Text>
        )}
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[padding({ all: 2 }), containerBackground(card, 'widget')]}
    >
      <HStack spacing={4}>
        <Text modifiers={[font({ size: 15 })]}>❤️</Text>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>
          {props.name || ''}
        </Text>
      </HStack>
      <Spacer />
      {headline !== '' && (
        <Text
          modifiers={[
            font({ size: props.nearby ? 22 : 28, weight: 'heavy', design: 'rounded' }),
            foregroundStyle(ink),
            lineLimit(1),
            minimumScaleFactor(0.5),
          ]}
        >
          {headline}
        </Text>
      )}
      {status ? (
        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(ink), lineLimit(1)]}>{status}</Text>
      ) : null}
      {hasUpdate && !props.paused && (
        <Text modifiers={[font({ textStyle: 'caption2' }), foregroundStyle(muted), lineLimit(1)]}>
          <Text>{'עודכן לפני '}</Text>
          <Text date={new Date(props.updatedAt)} dateStyle="relative" />
        </Text>
      )}
    </VStack>
  );
};

export default createWidget('PartnerWidget', PartnerWidget, plistSafe(EMPTY_WIDGET));
