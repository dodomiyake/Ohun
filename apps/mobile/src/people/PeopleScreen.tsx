import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '@ohun/design-tokens';
import { usernameSearchSchema, type PublicPerson } from '@ohun/contracts';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../auth/api';
import { AppNav } from '../shells/AppNav';
import { peopleApi } from './api';
function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
function Person({ person }: { person: PublicPerson }) {
  return <View style={s.person}><View style={s.avatar}><Text style={s.initial}>{person.displayName.slice(0, 1).toUpperCase()}</Text></View><View style={s.identity}><Text style={s.name}>{person.displayName}</Text><Text style={s.caption}>@{person.username}</Text></View></View>;
}
export default function PeopleScreen({ requests = false }: { requests?: boolean }) {
  const auth = useAuth(); const token = auth.accessToken!; const client = useQueryClient();
  const key = ['people', auth.user?.id];
  const [username, setUsername] = useState(''); const [results, setResults] = useState<PublicPerson[] | null>(null);
  const searchUsername = username.trim().replace(/^@/, '');
  const validUsername = usernameSearchSchema.safeParse({ username: searchUsername }).success;
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<{ id: string; text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const preferences = useQuery({ queryKey: [...key, 'preferences'], queryFn: () => peopleApi.preferences(token), enabled: Boolean(token), retry: false, gcTime: 0 });
  const contacts = useInfiniteQuery({ queryKey: [...key, 'contacts'], queryFn: ({ pageParam }) => peopleApi.contacts(token, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.nextCursor ?? undefined, enabled: Boolean(token), retry: false, gcTime: 0 });
  const invitations = useInfiniteQuery({ queryKey: [...key, 'invitations'], queryFn: ({ pageParam }) => peopleApi.invitations(token, pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: page => page.nextCursor ?? undefined, enabled: Boolean(token), retry: false, gcTime: 0 });
  const error = preferences.error ?? contacts.error ?? invitations.error;
  useEffect(() => { if (error instanceof ApiError && error.status === 401) void auth.signOutLocal(); }, [error, auth]);
  useFocusEffect(useCallback(() => { void client.invalidateQueries({ queryKey: ['people', auth.user?.id] }); }, [client, auth.user?.id]));
  async function perform(operation: () => Promise<unknown>, success = '') {
    if (busy) return; setBusy(true); setMessage('');
    try { await operation(); setMessage(success); await client.invalidateQueries({ queryKey: key }); }
    catch (e) { if (e instanceof ApiError && e.status === 401) await auth.signOutLocal(); else setMessage(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  async function sendRequest(id: string) {
    if (busy) return;
    setBusy(true); setSendingId(id); setInviteFeedback(null);
    try {
      await peopleApi.invite(token, id);
      setInviteFeedback({ id, text: 'Request submitted. Open Contact requests to check its status.', error: false });
      await client.invalidateQueries({ queryKey: key });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await auth.signOutLocal();
      else setInviteFeedback({ id, text: e instanceof Error ? e.message : 'Could not send the request. Please try again.', error: true });
    } finally { setSendingId(null); setBusy(false); }
  }
  const allContacts = contacts.data?.pages.flatMap(page => page.people) ?? [];
  const allInvitations = invitations.data?.pages.flatMap(page => page.invitations) ?? [];
  const loading = preferences.isPending || contacts.isPending || invitations.isPending;
  return <SafeAreaView style={s.safe}>
    <View style={s.header}><Text style={s.brand}>Ohun</Text><Text style={s.caption}>{requests ? 'Requests' : 'People'}</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text accessibilityRole="header" style={s.title}>{requests ? 'Contact requests' : 'Find People'}</Text>
      <Text style={s.caption}>{requests ? 'Accept a request to add each other as contacts. Ignoring a request does not notify the sender.' : 'Search for friends and family by their exact username.'}</Text>
      {loading && <Text accessibilityLiveRegion="polite">Loading…</Text>}
      {error && <View><Text accessibilityRole="alert" style={s.error}>{error.message}</Text><Button title="Retry" onPress={() => void client.invalidateQueries({ queryKey: key })} /></View>}
      {message ? <Text accessibilityLiveRegion="polite" style={s.caption}>{message}</Text> : null}
      {!requests && <>
        <Button title="Contact requests" onPress={() => router.replace('/(app)/requests')} />
        <View style={s.card}><View style={s.person}><View style={s.identity}><Text style={s.name}>Let people find me by username</Text><Text style={s.caption}>Share @{auth.user?.username} with someone you know.</Text></View><Switch accessibilityLabel="Let people find me by username" value={preferences.data?.byUsername ?? false} disabled={busy || !preferences.data} onValueChange={value => void perform(() => peopleApi.setPreferences(token, value))} /></View></View>
        <TextInput accessibilityLabel="Exact username" placeholder="Username or @username" autoCapitalize="none" autoCorrect={false} value={username} editable={!busy} onChangeText={value => { setUsername(value); setResults(null); }} style={s.input} maxLength={33} />
        {username.length > 0 && !validUsername ? <Text accessibilityLiveRegion="polite" style={s.caption}>Use 3–32 letters, numbers, dots, underscores or hyphens. A leading @ is optional.</Text> : null}
        <Button title={busy && !sendingId ? 'Please wait…' : 'Search'} disabled={busy || !validUsername} onPress={() => void perform(async () => { const response = await peopleApi.search(token, searchUsername); setResults(response.people); })} />
        {results?.length === 0 && <Text style={s.caption}>No match. Check the exact username and ask them to enable username discovery.</Text>}
        {results?.map(person => <View key={person.id} style={s.card}><Person person={person} />{allContacts.some(p => p.id === person.id) ? <Text style={s.caption}>Already in your contacts</Text> : allInvitations.some(i => i.person.id === person.id) ? <Text style={s.caption}>Request pending — open Requests to review it.</Text> : <Button title={sendingId === person.id ? 'Sending request…' : 'Send request'} disabled={busy || Boolean(error) || loading} onPress={() => void sendRequest(person.id)} />}{inviteFeedback?.id === person.id && <Text accessibilityRole={inviteFeedback.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={inviteFeedback.error ? s.error : s.caption}>{inviteFeedback.text}</Text>}</View>)}
        <Text accessibilityRole="header" style={s.section}>Your contacts</Text>
        {!loading && !error && !allContacts.length && <Text style={s.caption}>No contacts yet. Find someone and send a request.</Text>}
        {allContacts.map(person => <View key={person.id} style={s.card}><Person person={person} /></View>)}
        {contacts.hasNextPage && <Button title="Load more contacts" disabled={contacts.isFetchingNextPage} onPress={() => void contacts.fetchNextPage()} />}
      </>}
      {requests && <>
        {(['incoming', 'outgoing'] as const).map(direction => <View key={direction} style={s.group}><Text accessibilityRole="header" style={s.section}>{direction === 'incoming' ? 'Incoming' : 'Sent'}</Text>
          {!loading && !error && !allInvitations.some(i => i.direction === direction) && <Text style={s.caption}>No {direction === 'incoming' ? 'incoming' : 'sent'} requests on this page.</Text>}
          {allInvitations.filter(i => i.direction === direction).map(invitation => <View key={invitation.id} style={s.card}><Person person={invitation.person} /><Text style={s.caption}>Sent {new Date(invitation.createdAt).toLocaleDateString()}</Text><View style={s.actions}>{(direction === 'incoming' ? ['ignore', 'accept'] as const : ['cancel'] as const).map(action => <Button key={action} title={action.charAt(0).toUpperCase() + action.slice(1)} disabled={busy} onPress={() => void perform(() => peopleApi.action(token, invitation.id, action), action === 'accept' ? 'Contact added.' : 'Request updated.')} />)}</View></View>)}
        </View>)}
        {invitations.hasNextPage && <Button title="Load more requests" disabled={invitations.isFetchingNextPage} onPress={() => void invitations.fetchNextPage()} />}
      </>}
    </ScrollView><AppNav active={requests ? 'Requests' : 'People'} />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { fontFamily: typography.fontFamilyBrandNative, color: colors.primary, fontSize: 24 }, content: { padding: 16, gap: 16, width: '100%', maxWidth: 528, alignSelf: 'center', paddingBottom: 32 }, title: { fontSize: 28, fontWeight: '700', color: colors.onSurface }, section: { fontSize: 20, fontWeight: '600', color: colors.onSurface }, caption: { fontSize: 14, lineHeight: 21, color: colors.onSurfaceVariant }, card: { borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 12, padding: 16, gap: 16 }, person: { flexDirection: 'row', alignItems: 'center', gap: 16 }, identity: { flex: 1, gap: 4 }, name: { fontSize: 16, color: colors.onSurface }, avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }, initial: { fontSize: 24, color: colors.primary }, input: { minHeight: 56, backgroundColor: '#f2f3f7', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: colors.onSurface }, button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }, buttonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.5 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, group: { gap: 16 }, error: { color: colors.error },
});
