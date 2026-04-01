import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { usePrinters } from '@/modules/printers/hooks'

export default function PrintersScreen() {
  const { data: printers, isLoading } = usePrinters()

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Štampači ({printers?.length ?? 0})</Text>
      <FlatList
        data={printers}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>{item.model} · {item.ipAddress}</Text>
            </View>
            <View style={[styles.badge, item.status === 'online' ? styles.online : styles.offline]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nema štampača</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 20, fontWeight: 'bold', padding: 16 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14 },
  name: { fontWeight: '600', fontSize: 15 },
  sub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  online: { backgroundColor: '#dcfce7' },
  offline: { backgroundColor: '#f3f4f6' },
  badgeText: { fontSize: 12, fontWeight: '500' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
