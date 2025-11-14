import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ViewStyle,
  StyleProp,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugOverlayControls, { DebugOverlayControlsProps } from '../../components/DebugOverlayControls';
import { subscribeOverlay, getBufferedLogs, exportBufferedLogs } from '../Logger';
import type { OverlayLog } from '../Logger';

const POS_KEY = 'dbg:overlay:position';
const SIZE_KEY = 'dbg:overlay:size';

const POSITION_OPTIONS = [
  'top-left','top-center','top-right',
  'center-left','center','center-right',
  'bottom-left','bottom-center','bottom-right'
] as const;
type PosType = typeof POSITION_OPTIONS[number];
type SizeType = 'small' | 'medium' | 'large';

const SIZE_MAP: Record<SizeType, { width: string; height: string }> = {
  small: { width: '30%', height: '22%' },
  medium: { width: '50%', height: '36%' },
  large: { width: '80%', height: '60%' },
};

export default function DebugOverlay(): JSX.Element | null {
  const [pos, setPos] = useState<PosType>('center');
  const [size, setSize] = useState<SizeType>('large');
  const [logs, setLogs] = useState<OverlayLog[]>(() => getBufferedLogs(200));
  const rafRef = useRef<number | null>(null);

  const shouldShowOverlay = __DEV__ || process.env.DEBUG_OVERLAY === 'true';
  if (!shouldShowOverlay) return null;

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(POS_KEY);
        const s = await AsyncStorage.getItem(SIZE_KEY);
        if (p && POSITION_OPTIONS.includes(p as PosType)) setPos(p as PosType);
        if (s === 'small' || s === 'medium' || s === 'large') setSize(s as SizeType);
      } catch (_) {}
    })();

    const unsub = subscribeOverlay((newLogs: OverlayLog[]) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setLogs(newLogs.slice(-200));
      }) as any;
    });

    return () => {
      unsub();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => { AsyncStorage.setItem(POS_KEY, pos).catch(() => {}); }, [pos]);
  useEffect(() => { AsyncStorage.setItem(SIZE_KEY, size).catch(() => {}); }, [size]);

  function handleCopy() {
    try {
      const text = exportBufferedLogs('text', 1000);
      const Clipboard = require('@react-native-clipboard/clipboard');
      Clipboard?.setString?.(text);
      Alert.alert('Copied', 'Debug logs copied to clipboard.');
    } catch (e: any) {
      Alert.alert('Copy failed', String(e));
    }
  }

  async function handleSendEmail(to = 'recipient@example.com') {
    try {
      const body = encodeURIComponent(exportBufferedLogs('text', 1000));
      const subject = encodeURIComponent(`OrionTV Debug Logs ${new Date().toISOString()}`);
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
      const { Linking } = require('react-native');
      const can = await Linking.canOpenURL(mailto);
      if (can) {
        await Linking.openURL(mailto);
      } else {
        const Clipboard = require('@react-native-clipboard/clipboard');
        Clipboard?.setString?.(decodeURIComponent(body));
        Alert.alert('Email client unavailable', 'Logs copied to clipboard; paste into your email client.');
      }
    } catch (e: any) {
      Alert.alert('Send failed', String(e));
    }
  }

  // Cast imported component so TypeScript recognizes its props
  const Controls = DebugOverlayControls as React.ComponentType<DebugOverlayControlsProps>;

  const sizeStyle: StyleProp<ViewStyle> = { width: SIZE_MAP[size].width as any, height: SIZE_MAP[size].height as any };
  const positionStyle: StyleProp<ViewStyle> = getPositionStyle(pos);
  const containerStyle: StyleProp<ViewStyle> = [styles.container, sizeStyle, positionStyle];

  return (
    <View pointerEvents="box-none" style={containerStyle}>
      <View style={styles.header}>
        <Text style={styles.title}>DBG</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleCopy} style={styles.headerBtn}>
            <Text style={styles.btnText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSendEmail()} style={styles.headerBtn}>
            <Text style={styles.btnText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.body}>
        {logs.slice().reverse().map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {`${new Date(l.ts).toISOString()} ${l.level} ${typeof l.message === 'string' ? l.message : JSON.stringify(l.message)}`}
          </Text>
        ))}
      </ScrollView>

      <Controls
        visible={true}
        defaultPosition={pos as any}
        defaultSize={size as any}
        onChangePosition={(p: PosType) => setPos(p)}
        onChangeSize={(s: SizeType) => setSize(s)}
      />
    </View>
  );
}

function getPositionStyle(p: PosType): StyleProp<ViewStyle> {
  const style: any = { position: 'absolute' };
  if (p.includes('top')) style.top = 12;
  if (p.includes('bottom')) style.bottom = 12;
  if (p.includes('left')) style.left = 12;
  if (p.includes('right')) style.right = 12;
  if (p === 'top-center' || p === 'bottom-center') {
    style.left = '50%';
    style.transform = [{ translateX: -150 }];
  }
  if (p === 'center') {
    style.left = '50%';
    style.top = '50%';
    style.transform = [{ translateX: -150 }, { translateY: -100 }];
  }
  if (p === 'center-left' || p === 'center-right') {
    style.top = '50%';
    style.transform = [{ translateY: -100 }];
  }
  return style as StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderRadius: 8,
    padding: 6,
    zIndex: 99999,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#ff3b3b', fontWeight: '700', fontSize: 14 },
  headerRight: { flexDirection: 'row' },
  headerBtn: { marginLeft: 8, backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  btnText: { color: '#fff', fontSize: 12 },
  body: { marginTop: 6, maxHeight: '60%' },
  logLine: { color: '#ddd', fontSize: 11, marginBottom: 2 },
});
