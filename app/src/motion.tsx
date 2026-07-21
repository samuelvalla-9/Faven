// Faven motion toolkit — smooth, purposeful animations built on the core
// Animated API (no extra deps; works on native + web). Respects the user's
// reduce-motion preference everywhere.
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

// ---------- reduce-motion hook ----------

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => mounted && setReduced(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) =>
      setReduced(!!v),
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

// ---------- FadeInUp: entrance for cards / screens (staggerable) ----------

export function FadeInUp({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.bezier(0.22, 1, 0.36, 1), // ease-out-quint feel
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ---------- ScalePressable: tactile spring press feedback ----------

export function ScalePressable({
  children,
  style,
  scaleTo = 0.97,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (!reduced) to(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduced) to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------- Pulse: gentle opacity loop for loading skeletons ----------

export function Pulse({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

// ---------- PopIn: springy scale entrance (modals, stars, badges) ----------

export function PopIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.6)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) return;
    const anim = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        delay,
        speed: 22,
        bounciness: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [scale, opacity, delay, reduced]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>
  );
}

// ---------- useSpringValue: animate a value on change (e.g. star bounce) ----------

export function useBounce(trigger: unknown) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.setValue(1.28);
    Animated.spring(scale, {
      toValue: 1,
      speed: 30,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [trigger, scale, reduced]);

  return scale;
}
