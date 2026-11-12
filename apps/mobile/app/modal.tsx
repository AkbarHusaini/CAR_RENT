import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatDateIndo, formatHubLabel, formatIdr, Theme } from '@/constants/theme';
import { useAppContext } from '@/context/AppContext';

export default function DigitalKeyVoucherModal() {
  const router = useRouter();
  const { activeVoucherBooking } = useAppContext();

  if (!activeVoucherBooking) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="key-outline" size={42} color={Theme.colors.textMuted} />
        <Text style={styles.emptyTitle}>Belum Ada E-Tiket Dipilih</Text>
        <Text style={styles.emptySub}>
          Pilih salah satu pesanan dari menu Chat atau Pesanan untuk melihat E-Tiket dan Kunci Digital Anda.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Tutup</Text>
        </Pressable>
      </View>
    );
  }

  const b = activeVoucherBooking;
  const keyHash = `ERB-${b.booking_id.replace(/[^A-Z0-9]/g, '')}-${b.vehicle_id}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.innerWrap}>
        <View style={styles.voucherCard}>
          <View style={styles.badgeRow}>
            <View style={styles.blePill}>
              <Ionicons name="key-outline" size={14} color={Theme.colors.primaryBright} />
              <Text style={styles.bleText}>E-TIKET & KUNCI DIGITAL</Text>
            </View>
            <Text style={styles.refCode}>#{b.booking_id}</Text>
          </View>

          <Text style={styles.vehicleName}>{b.vehicle_name}</Text>
          <Text style={styles.customerText}>Pemesan: {b.customer_name}</Text>

          <View style={styles.tokenBox}>
            <Ionicons name="qr-code-outline" size={64} color={Theme.colors.primaryBright} />
            <Text style={styles.tokenLabel}>KODE VERIFIKASI PENGAMBILAN</Text>
            <Text style={styles.tokenValue}>{keyHash}</Text>
          </View>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Lokasi Jemput</Text>
              <Text style={styles.gridVal}>{formatHubLabel(b.pickup_hub)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Tanggal Mulai</Text>
              <Text style={styles.gridVal}>{formatDateIndo(b.start_date)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Durasi Sewa</Text>
              <Text style={styles.gridVal}>{b.days} Hari</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Total Biaya</Text>
              <Text style={[styles.gridVal, { color: Theme.colors.primaryBright }]}>{formatIdr(b.total_idr)}</Text>
            </View>
          </View>

          {b.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Catatan</Text>
              <Text style={styles.notesText}>{b.notes}</Text>
            </View>
          ) : null}
        </View>

        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Selesai</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.canvas },
  content: { padding: 16 },
  innerWrap: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    gap: 16
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: Theme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12
  },
  emptyTitle: { color: Theme.colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySub: { color: Theme.colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 360 },
  voucherCard: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.primaryBorder,
    padding: 18
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  blePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  bleText: { color: Theme.colors.primaryBright, fontSize: 11, fontWeight: '700' },
  refCode: { color: Theme.colors.textPrimary, fontSize: 12, fontWeight: '700', fontFamily: Theme.fonts.mono },
  vehicleName: { color: Theme.colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 14 },
  customerText: { color: Theme.colors.textSecondary, fontSize: 13, marginTop: 3 },
  tokenBox: {
    marginTop: 18,
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 18,
    alignItems: 'center',
    gap: 8
  },
  tokenLabel: { color: Theme.colors.textMuted, fontSize: 11, fontWeight: '600' },
  tokenValue: { color: Theme.colors.primaryBright, fontSize: 13, fontWeight: '700', fontFamily: Theme.fonts.mono },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16
  },
  gridItem: {
    width: '48%',
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 12
  },
  gridLabel: { color: Theme.colors.textMuted, fontSize: 11 },
  gridVal: { color: Theme.colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 4 },
  notesBox: {
    marginTop: 14,
    backgroundColor: Theme.colors.surfaceElevated,
    borderRadius: Theme.radius.md,
    padding: 12
  },
  notesLabel: { color: Theme.colors.textSecondary, fontSize: 11, fontWeight: '600' },
  notesText: { color: Theme.colors.textPrimary, fontSize: 12, marginTop: 4, lineHeight: 18 },
  closeBtn: {
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center'
  },
  closeBtnText: { color: '#052E1E', fontSize: 14, fontWeight: '800' }
});
