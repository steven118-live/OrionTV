import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugOverlayControls from '../../components/DebugOverlayControls';
import { subscribeOverlay, getBufferedLogs, exportBufferedLogs } from '../Logger';
import type { OverlayLog } from '../Logger';

// Storage keys
const POS_KEY = 'dbg:overlay:position';
const SIZE_KEY = 'dbg:overlay:size';

const POSITION_OPTIONS = [
  'top-left','top-center','top-right',
  'center-left','center','center-right',
  'bottom-left','bottom-center','bottom-right'
] as const;
type Pos = typeof POSITION_OPTIONS[number];
type Size = 'small'|'medium'|'large';

const SIZE_MAP: Record<Size, { width: string; height: string }> = {
  small: { width: '30%', height: '22%' },
  medium: { width: '50%', height: '36%' },
  large: { width: '80%', height: '60%' },
};

export default function DebugOverlay(): JSX.Element | null {
  const [pos, setPos] = useState<Pos>('bottom-right');
  const [size, setSize] = useState<Size>('large');
  const [logs, setLogs] = useState<OverlayLog[]>(() => getBufferedLogs(200));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(POS_KEY);
        const s = await AsyncStorage.getItem(SIZE_KEY);
        if (p && POSITION_OPTIONS.includes(p as Pos)) setPos(p as Pos);
        if (s === 'small' || s === 'medium' || s === 'large') setSize(s as Size);
      } catch (_) { /* swallow storage errors */ }
    })();

    const unsub = subscribeOverlay((logs: OverlayLog[]) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setLogs(logs.slice(-200));
      }) as any;
    });

    return () => {
      unsub();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => { AsyncStorage.setItem(POS_KEY, pos).catch(()=>{}); }, [pos]);
  useEffect(() => { AsyncStorage.setItem(SIZE_KEY, size).catch(()=>{}); }, [size]);

  function getPositionStyle(p: Pos, sizeKey: Size) {
    const style: any = { position: 'absolute' };
    if (p.includes('top')) style.top = 12;
    if (p.includes('bottom')) style.bottom = 12;
    if (p.includes('left')) style.left = 12;
    if (p.includes('right')) style.right = 12;

    if (p === 'top-center') {
      style.left = '50%';
      style.transform = [{ translateX: '-50%' }];
    }
    if (p === 'bottom-center') {
      style.left = '50%';
      style.transform = [{ translateX: '-50%' }];
    }
    if (p === 'center') {
      style.left = '50%';
      style.top = '50%';
      style.transform = [{ translateX: '-50%' }, { translateY: '-50%' }];
    }
    if (p === 'center-left') {
      style.top = '50%';
      style.transform = [{ translateY: '-50%' }];
    }
    if (p === 'center-right') {
      style.top = '50%';
      style.transform = [{ translateY: '-50%' }];
    }

    return style;
  }

  async function handleCopy() {
    try {
      const text = exportBufferedLogs('text', 1000);
      try {
        const Clipboard = require('@react-native-clipboard/clipboard');
        if (Clipboard && Clipboard.setString) {
          Clipboard.setString(text);
        } else {
          const RNClipboard = require('react-native').Clipboard;
          if (RNClipboard && RNClipboard.setString) RNClipboard.setString(text);
        }
      } catch (_) {
        Alert.alert('Copy not available', text.slice(0, 1024));
      }
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
        try {
          const Clipboard = require('@react-native-clipboard/clipboard');
          if (Clipboard && Clipboard.setString) Clipboard.setString(decodeURIComponent(body));
        } catch (_) {}
        Alert.alert('Email client unavailable', 'Logs copied to clipboard; paste into your email client.');
      }
    } catch (e: any) {
      Alert.alert('Send failed', String(e));
    }
  }

  const sizeStyle = { width: SIZE_MAP[size].width, height: SIZE_MAP[size].height };
  const positionStyle = getPositionStyle(pos, size);
  const containerStyle = [styles.container, sizeStyle, positionStyle] as any;

  if (!__DEV__ && process.env.DEBUG_OVERLAY !== 'true') return null;

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
        {logs.slice().reverse().map((l: OverlayLog, i: number) => (
          <Text key={i} style={styles.logLine}>
            {`${new Date(l.ts).toISOString()} ${l.level} ${
              typeof l.message === 'string' ? l.message : JSON.stringify(l.message)
            }`}
          </Text>
        ))}
      </ScrollView>

      <DebugOverlayControls
        defaultPosition={pos}
        defaultSize={size}
        onChangePosition={(p) => setPos(p)}
        onChangeSize={(s) => setSize(s)}
      />
    </View>
  );
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
  title: { color: '#fff', fontWeight: '700' },
  headerRight: { flexDirection: 'row' },
  headerBtn: { marginLeft: 8, backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  btnText: { color: '#fff', fontSize: 12 },
  body: { marginTop: 6, maxHeight: '60%' },
  logLine: { color: '#ddd', fontSize: 11, marginBottom: 2 },
});
