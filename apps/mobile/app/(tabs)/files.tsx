import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useFiles } from '@/modules/files/hooks'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilesScreen() {
  const { data: files, isLoading } = useFiles()

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fajlovi ({files?.length ?? 0})</Text>
      <FlatList
        data={files}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>{formatBytes(item.fileSizeBytes)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nema fajlova</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  title: { fontSize: 20, fontWeight: 'bold', padding: 16 },
  item: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14 },
  name: { fontWeight: '600', fontSize: 15 },
  sub: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
})
