import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useAiDetections, useTakeAction } from '@/modules/ai/hooks'
import type { AiDetection } from '@/lib/api-client'

const ACTIONS = [
  { label: 'Pauziraj', action: 'pause' as const },
  { label: 'Otkaži', action: 'cancel' as const },
  { label: 'Preskoči', action: 'skip_object' as const },
  { label: 'Odbaci', action: 'dismiss' as const },
]

function DetectionItem({ item }: { item: AiDetection }) {
  const takeAction = useTakeAction()
  const handled = item.actionTaken !== 'none'

  return (
    <View style={[styles.item, handled && styles.handled]}>
      <Text style={styles.type}>{item.detectionType}</Text>
      <Text style={styles.sub}>
        Poverenje: {(item.confidence * 100).toFixed(0)}% · {handled ? `Akcija: ${item.actionTaken}` : 'Čeka akciju'}
      </Text>
      {!handled && (
        <View style={styles.actions}>
          {ACTIONS.map(({ label, action }) => (
            <TouchableOpacity
              key={action}
              style={styles.actionBtn}
              onPress={() => takeAction.mutate({ id: item.id, action })}
              disabled={takeAction.isPending}
            >
              <Text style={styles.actionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

export default function AiScreen() {
  const { data: detections, isLoading } = useAiDetections()

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Detekcije ({detections?.length ?? 0})</Text>
      <FlatList
        data={detections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <DetectionItem item={item} />}
        ListEmptyComponent={<Text style={styles.empty}>Nema detekcija</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 20, fontWeight: 'bold', padding: 16 },
  item: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14 },
  handled: { opacity: 0.6 },
  type: { fontWeight: '600', fontSize: 15, marginBottom: 4 },
  sub: { color: '#6b7280', fontSize: 12, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
