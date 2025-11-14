// components/DebugOverlayControls.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportBufferedLogs } from '../utils/Logger';
const Clipboard = require('@react-native-clipboard/clipboard') as any;

import { Linking } from 'react-native';

const POS_KEY = 'dbg:overlay:position';
const SIZE_KEY = 'dbg:overlay:size';

const POSITION_OPTIONS = [
  'top-left','top-center','top-right',
  'center-left','center','center-right',
  'bottom-left','bottom-center','bottom-right'
] as const;
type Pos = typeof POSITION_OPTIONS[number];
type Size = 'small' | 'medium' | 'large';

const DEFAULT_SIZE: Size = 'large'; // keep largest as default per your request

export type DebugOverlayControlsProps = {
  debug?: boolean;
  visible?: boolean;             // default changed to false
  onChangePosition?: (p: Pos) => void;
  onChangeSize?: (s: Size) => void;
  defaultPosition?: Pos;
  defaultSize?: Size;
};

export default function DebugOverlayControls({
  debug,
  visible = false,               // <-- default false
  onChangePosition,
  onChangeSize,
  defaultPosition = 'bottom-right',
  defaultSize = DEFAULT_SIZE
}: DebugOverlayControlsProps) {
  // don't render unless explicitly enabled
  if (!visible) return null;

  const [pos, setPos] = useState<Pos>(defaultPosition);
  const [size, setSize] = useState<Size>(defaultSize);

  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem(POS_KEY);
        const s = await AsyncStorage.getItem(SIZE_KEY);
        if (p && POSITION_OPTIONS.includes(p as Pos)) setPos(p as Pos);
        if (s === 'small' || s === 'medium' || s === 'large') setSize(s as Size);
      } catch (e) {
        // swallow storage errors to avoid crash
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(POS_KEY, pos).catch(()=>{});
    if (onChangePosition) onChangePosition(pos);
  }, [pos, onChangePosition]);

  useEffect(() => {
    AsyncStorage.setItem(SIZE_KEY, size).catch(()=>{});
    if (onChangeSize) onChangeSize(size);
  }, [size, onChangeSize]);

  async function handleCopy() {
    try {
      const text = exportBufferedLogs('text', 1000);
      try {
        // prefer @react-native-clipboard/clipboard
        if (Clipboard && (Clipboard as any).setString) {
          (Clipboard as any).setString(text);
        } else {
          // fallback to react-native Clipboard (older RN)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const RNClipboard = require('react-native').Clipboard;
          if (RNClipboard && RNClipboard.setString) RNClipboard.setString(text);
        }
      } catch (_) {
        // final fallback: alert first chunk
        Alert.alert('Copied (partial)', text.slice(0, 1024));
      }
      Alert.alert('Copied', 'Debug logs copied to clipboard.');
    } catch (e) {
      Alert.alert('Copy failed', String(e));
    }
  }

  async function handleSendEmail() {
    try {
      const body = encodeURIComponent(exportBufferedLogs('text', 1000));
      const subject = encodeURIComponent(`OrionTV Debug Logs ${new Date().toISOString()}`);
      const to = 'recipient@example.com'; // update by editing code or extend UI to accept recipient
      const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

      if (Platform.OS === 'web') {
        // @ts-ignore window exists on web
        window.location.href = mailto;
        return;
      }

      const supported = await Linking.canOpenURL(mailto);
      if (supported) {
        await Linking.openURL(mailto);
      } else {
        // fallback: copy logs to clipboard and notify user
        try {
          if (Clipboard && (Clipboard as any).setString) {
            (Clipboard as any).setString(decodeURIComponent(body));
          }
        } catch (_) {
          // ignore
        }
        Alert.alert('Email client not available', 'Logs copied to clipboard; paste into your email client.');
      }
    } catch (e) {
      Alert.alert('Send failed', String(e));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Size</Text>
        <View style={styles.sizeControls}>
          <TouchableOpacity style={[styles.sizeBtn, size === 'small' && styles.sizeBtnActive]} onPress={() => setSize('small')}>
            <Text style={styles.sizeText}>S</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sizeBtn, size === 'medium' && styles.sizeBtnActive]} onPress={() => setSize('medium')}>
            <Text style={styles.sizeText}>M</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sizeBtn, size === 'large' && styles.sizeBtnActive]} onPress={() => setSize('large')}>
            <Text style={styles.sizeText}>L</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionBtns}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
            <Text style={styles.actionText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSendEmail}>
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.grid}>
        {POSITION_OPTIONS.map(p => {
          const active = p === pos;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setPos(p as Pos)}
              style={[styles.cell, active && styles.cellActive]}
            >
              <Text style={styles.cellText}>
                {p.split('-').map(s => s[0]).join('').toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 6, backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#fff', marginRight: 8 },
  sizeControls: { flexDirection: 'row' },
  sizeBtn: { paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: 4, backgroundColor: '#222', borderRadius: 4 },
  sizeBtnActive: { backgroundColor: '#0a84ff' },
  sizeText: { color: '#fff', fontWeight: '700' },
  actionBtns: { flexDirection: 'row', marginLeft: 8 },
  actionBtn: { backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 4, marginLeft: 6, borderRadius: 4 },
  actionText: { color: '#fff' },
  grid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', width: 132 },
  cell: { width: 40, height: 28, margin: 2, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  cellActive: { backgroundColor: '#0a84ff' },
  cellText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
