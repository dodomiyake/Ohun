import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFonts } from 'expo-font';
import type { LayoutChangeEvent } from 'react-native';
import { MaterialSymbols_400Regular } from '@expo-google-fonts/material-symbols/400Regular';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@ohun/design-tokens';
import { useConversation } from './useConversation';
import type { Message } from '@ohun/contracts';
import { AppNav } from '../shells/AppNav';

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const difference = (startOfDay(today) - startOfDay(date)) / 86_400_000;
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return <View style={[s.bubble, mine ? s.mine : s.theirs]}>
    <Text style={[s.message, mine && s.ownMessage]}>{message.body}</Text>
    <Text style={[s.time, mine && s.ownTime]}>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
  </View>;
}

function UnavailableAction({ icon, label }: { icon: string; label: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label} coming soon`} accessibilityState={{ disabled: true }} disabled style={s.headerAction}>
    <Text accessible={false} style={s.icon}>{icon}</Text>
  </Pressable>;
}

export function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(id) ? id[0]! : id;
  const chat = useConversation(conversationId);
  const [iconsReady] = useFonts({ MaterialSymbolsUI: MaterialSymbols_400Regular });
  const [draft, setDraft] = useState('');
  const [nearBottom, setNearBottom] = useState(true);
  const [focusCycle, setFocusCycle] = useState(0);
  const list = useRef<FlatList<Message>>(null);
  const nearBottomRef = useRef(true);
  const initialScrollPending = useRef(false);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);

  useFocusEffect(useCallback(() => {
    // Returning from another tab or screen should reopen this conversation at
    // its newest message, even when the screen component stayed mounted.
    initialScrollPending.current = true;
    setFocusCycle(cycle => cycle + 1);
    return () => { initialScrollPending.current = false; };
  }, []));

  useEffect(() => {
    if (!initialScrollPending.current || chat.loading) return;
    if (chat.messages.length === 0) {
      initialScrollPending.current = false;
      return;
    }

    // Try after layout, then retry after the navigation transition has settled.
    // The content-size callback can fire before FlatList has a usable viewport.
    const scrollIfPending = () => {
      if (!initialScrollPending.current) return;
      const offset = Math.max(0, contentHeight.current - viewportHeight.current);
      list.current?.scrollToOffset({ offset, animated: false });
      nearBottomRef.current = true;
      setNearBottom(true);
    };
    const frame = requestAnimationFrame(() => requestAnimationFrame(scrollIfPending));
    const fallback = setTimeout(() => {
      scrollIfPending();
      initialScrollPending.current = false;
    }, 300);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [focusCycle, chat.loading, chat.messages.length]);

  const scheduleScrollToLatest = (animated = false) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!initialScrollPending.current && !nearBottomRef.current) return;
      const offset = Math.max(0, contentHeight.current - viewportHeight.current);
      list.current?.scrollToOffset({ offset, animated });
      nearBottomRef.current = true;
      setNearBottom(true);
    }));
  };

  const handleListLayout = (event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    if (initialScrollPending.current) scheduleScrollToLatest(false);
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    contentHeight.current = height;
    if (initialScrollPending.current || nearBottomRef.current) {
      scheduleScrollToLatest(nearBottomRef.current && !initialScrollPending.current);
    }
  };

  const sending = chat.pending.some(item => item.state === 'sending');
  const canSend = Boolean(draft.trim()) && [...draft].length <= 4000 && !sending;

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={s.safe}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={s.back}>
          <Text accessible={false} style={s.backGlyph}>‹</Text>
        </Pressable>
        <View style={s.avatar}><Text style={s.initial}>{chat.conversation?.person?.displayName.slice(0, 1).toUpperCase() ?? '?'}</Text></View>
        <View style={s.identity}>
          <Text numberOfLines={1} style={s.name}>{chat.conversation?.person?.displayName ?? 'Conversation'}</Text>
          <Text numberOfLines={1} style={s.handle}>{chat.conversation?.person ? `@${chat.conversation.person.username}` : ' '}</Text>
        </View>
        <View style={s.actions}>
          {iconsReady && <>
            <UnavailableAction icon="videocam" label="Video call" />
            <UnavailableAction icon="call" label="Voice call" />
            <UnavailableAction icon="more_vert" label="More options" />
          </>}
        </View>
      </View>

      {chat.loading ? <View style={s.center}><ActivityIndicator color={colors.primary} /><Text style={s.caption}>Loading messages…</Text></View>
        : chat.error ? <View style={s.center}><Text accessibilityRole="alert" style={s.caption}>Could not load this conversation.</Text><Pressable accessibilityRole="button" style={s.retry} onPress={() => void chat.refresh()}><Text style={s.retryText}>Retry</Text></Pressable></View>
          : <>
            {!chat.conversation?.canSend && <Text accessibilityLiveRegion="polite" style={s.notice}>You can view this conversation, but sending is unavailable.</Text>}
            {chat.hasOlder && <Pressable accessibilityRole="button" onPress={() => void chat.loadOlder()} style={s.older}><Text style={s.retryText}>Load earlier messages</Text></Pressable>}
            <FlatList
              ref={list}
              style={s.list}
              onLayout={handleListLayout}
              data={chat.messages}
              keyExtractor={item => item.id}
              renderItem={({ item, index }) => {
                const previous = chat.messages[index - 1];
                const showDate = !previous || new Date(previous.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
                return <>
                  {showDate && <View style={s.dateRow}><Text style={s.dateChip}>{dayLabel(item.createdAt)}</Text></View>}
                  <Bubble message={item} mine={item.senderId !== chat.conversation?.person.id} />
                </>;
              }}
              contentContainerStyle={s.messages}
              onContentSizeChange={handleContentSizeChange}
              onScroll={event => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                const atBottom = contentSize.height - layoutMeasurement.height - contentOffset.y < 100;
                nearBottomRef.current = atBottom;
                setNearBottom(atBottom);
              }}
              scrollEventThrottle={100}
              ListEmptyComponent={<View style={s.center}><Text style={s.caption}>Start the conversation</Text></View>}
              ListFooterComponent={<View style={s.messageEndSpace} />}
            />
            {!nearBottom && <Pressable accessibilityRole="button" onPress={() => { nearBottomRef.current = true; setNearBottom(true); list.current?.scrollToOffset({ offset: Math.max(0, contentHeight.current - viewportHeight.current), animated: true }); }} style={s.newMessages}><Text style={s.retryText}>New messages ↓</Text></Pressable>}
            {chat.pending.map(item => <View key={item.clientMessageId} style={s.pending}><Text style={s.caption}>{item.body}</Text><Text style={s.caption}>{item.state === 'sending' ? 'Sending…' : 'Could not send'}</Text>{item.state === 'failed' && <Pressable accessibilityRole="button" onPress={() => void chat.retry(item.clientMessageId).catch(() => undefined)}><Text style={s.retryText}>Retry</Text></Pressable>}</View>)}
          </>}

      <View style={s.composer}>
        <View style={s.composerBar}>
          {iconsReady && <Pressable accessibilityRole="button" accessibilityLabel="Attachments coming soon" accessibilityState={{ disabled: true }} disabled style={s.composerAction}><Text accessible={false} style={s.composerIcon}>add</Text></Pressable>}
          <TextInput accessibilityLabel="Type a message" placeholder="Type a message…" multiline value={draft} onChangeText={setDraft} style={s.input} maxLength={8000} />
          {iconsReady && <Pressable accessibilityRole="button" accessibilityLabel="Emoji picker coming soon" accessibilityState={{ disabled: true }} disabled style={s.composerAction}><Text accessible={false} style={s.composerIcon}>mood</Text></Pressable>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend || !chat.conversation?.canSend }}
            disabled={!canSend || !chat.conversation?.canSend}
            style={[s.send, !canSend && s.sendDisabled]}
            onPress={() => { const submitted = draft; void chat.send(submitted).then(() => setDraft(current => current === submitted ? '' : current)).catch(() => undefined); }}
          >{iconsReady ? <Text style={s.sendIcon}>send</Text> : null}</Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
    <AppNav active="Chats" />
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.outlineVariant },
  back: { minWidth: 40, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  backGlyph: { fontSize: 32, color: colors.onSurfaceVariant, marginTop: -4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 18, color: colors.primary },
  identity: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '600', color: colors.onSurface },
  handle: { fontSize: 12, color: colors.onSurfaceVariant },
  actions: { flexDirection: 'row', alignItems: 'center' },
  headerAction: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontFamily: 'MaterialSymbolsUI', fontSize: 22, color: colors.onSurfaceVariant },
  list: { flex: 1 },
  messages: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 0, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  messageEndSpace: { height: 20 },
  dateRow: { alignItems: 'center', marginBottom: 8 },
  dateChip: { overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16, backgroundColor: colors.surfaceContainerLow, color: colors.onSurfaceVariant, fontSize: 12 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 5 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.outlineVariant, borderBottomLeftRadius: 5 },
  message: { fontSize: 14, lineHeight: 20, color: colors.onSurface },
  ownMessage: { color: colors.onPrimary },
  time: { fontSize: 11, color: colors.onSurfaceVariant, alignSelf: 'flex-end' },
  ownTime: { color: '#dbe5ff' },
  composer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.background },
  composerBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, backgroundColor: colors.surfaceContainerLow },
  composerAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  composerIcon: { fontFamily: 'MaterialSymbolsUI', fontSize: 24, color: colors.onSurfaceVariant },
  input: { flex: 1, minHeight: 40, maxHeight: 128, paddingHorizontal: 4, paddingVertical: 9, fontSize: 14, color: colors.onSurface, backgroundColor: 'transparent' },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { opacity: 0.5 },
  sendIcon: { fontFamily: 'MaterialSymbolsUI', color: colors.onPrimary, fontSize: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  caption: { fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant },
  retry: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  notice: { padding: 10, textAlign: 'center', color: colors.onSurfaceVariant, backgroundColor: colors.surfaceContainerLow },
  older: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  newMessages: { position: 'absolute', bottom: 88, alignSelf: 'center', padding: 10, borderRadius: 20, backgroundColor: colors.surface },
  pending: { alignSelf: 'flex-end', maxWidth: '82%', padding: 12, gap: 4, backgroundColor: colors.surfaceContainerLow, borderRadius: 16 },
});
