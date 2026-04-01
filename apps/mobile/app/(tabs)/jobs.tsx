import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native'
import { useJobs, useCancelJob, usePauseJob, useResumeJob } from '@/modules/jobs/hooks'
import type { PrintJob } from '@/lib/api-client'

const STATUS_COLORS: Record<string, string> = {
  queued: '#dbeafe',
  preparing: '#fef9c3',
  printing: '#dcfce7',
  paused: '#ffedd5',
  completed: '#f3f4f6',
  canceled: '#fee2e2',
  failed: '#fee2e2',
}

function JobItem({ item }: { item: PrintJob }) {
  const cancel = useCancelJob()
  const pause = usePauseJob()
  const resume = useResumeJob()

  return (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] ?? '#f3f4f6' }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.status === 'printing' && (
          <TouchableOpacity onPress={() => pause.mutate(item.id)} style={styles.actionBtn}>
            <Text>⏸</Text>
          </TouchableOpacity>
        )}
        {item.status === 'paused' && (
          <TouchableOpacity onPress={() => resume.mutate(item.id)} style={styles.actionBtn}>
            <Text>▶️</Text>
          </TouchableOpacity>
        )}
        {['queued', 'preparing', 'printing', 'paused'].includes(item.status) && (
          <TouchableOpacity onPress={() => cancel.mutate(item.id)} style={styles.actionBtn}>
            <Text>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default function JobsScreen() {
  const { data: jobs, isLoading } = useJobs()

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Poslovi ({jobs?.length ?? 0})</Text>
      <FlatList
        data={jobs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <JobItem item={item} />}
        ListEmptyComponent={<Text style={styles.empty}>Nema poslova</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 20, fontWeight: 'bold', padding: 16 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14 },
  name: { fontWeight: '600', fontSize: 15, marginBottom: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
