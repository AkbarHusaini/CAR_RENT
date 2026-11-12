import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import { McpToolTraceEntry } from '@/services/api';

interface McpTraceCardProps {
  trace: McpToolTraceEntry[];
  totalDurationMs?: number;
  engineUsed?: string;
}

function getServerAccent(serverId: McpToolTraceEntry['serverId']) {
  if (serverId === 'mcp-a') {
    return {
      color: Theme.colors.mcpA,
      bg: Theme.colors.mcpASoft,
      border: Theme.colors.mcpABorder,
      tag: 'MCP-A · QUERY'
    };
  }
  if (serverId === 'mcp-b') {
    return {
      color: Theme.colors.mcpB,
      bg: Theme.colors.mcpBSoft,
      border: Theme.colors.mcpBBorder,
      tag: 'MCP-B · PERSIST'
    };
  }
  return {
    color: Theme.colors.mcpC,
    bg: Theme.colors.mcpCSoft,
    border: Theme.colors.mcpCBorder,
    tag: 'MCP-C · MEMORY'
  };
}

function summarizeResult(entry: McpToolTraceEntry): string {
  const res = entry.result;
  if (!res || typeof res !== 'object') return String(res ?? 'OK');
  const obj = res as Record<string, unknown>;
  if (obj.error) return `Error: ${String(obj.error)}`;

  if (entry.serverId === 'mcp-a') {
    if (entry.toolName === 'search_fleet') {
      return `${obj.totalMatched ?? 0} vehicle(s) matched`;
    }
    if (entry.toolName === 'get_bali_weather' && obj.weather && typeof obj.weather === 'object') {
      const w = obj.weather as Record<string, unknown>;
      return `${w.temperatureC}°C · ${w.condition} (${w.precipitationProbabilityPct}% rain)`;
    }
    if (entry.toolName === 'calculate_quote') {
      return `Total IDR ${Number(obj.totalIdr ?? 0).toLocaleString('en-US')} (${obj.days}d)`;
    }
  }

  if (entry.serverId === 'mcp-b') {
    if (obj.booking && typeof obj.booking === 'object') {
      const b = obj.booking as Record<string, unknown>;
      return `${obj.operation || 'SQLITE'} · #${b.booking_id} (${b.status})`;
    }
    if (Array.isArray(obj.bookings)) {
      return `${obj.bookings.length} booking(s) loaded from SQLite`;
    }
  }

  if (entry.serverId === 'mcp-c') {
    if (Array.isArray(obj.entities)) {
      return `${obj.entities.length} graph entity node(s)`;
    }
    return 'Memory knowledge graph synced';
  }

  return JSON.stringify(res).slice(0, 110);
}

export function McpTraceCard({ trace, totalDurationMs, engineUsed }: McpTraceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  if (!trace || trace.length === 0) return null;

  const hasA = trace.some((t) => t.serverId === 'mcp-a');
  const hasB = trace.some((t) => t.serverId === 'mcp-b');
  const hasC = trace.some((t) => t.serverId === 'mcp-c');

  return (
    <View style={[styles.container, !expanded && styles.containerCompact]}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.terminalIconBox}>
            <Ionicons name="terminal-outline" size={12} color={Theme.colors.primaryBright} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {hasA && hasB ? 'Detail Proses (2-Arah MCP)' : 'Detail Proses MCP'}
              <Text style={styles.subtitleInline}>
                {' · '}
                {trace.length} langkah
                {totalDurationMs ? ` · ${totalDurationMs}ms` : ''}
                {expanded && engineUsed ? ` · ${engineUsed}` : ''}
              </Text>
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {hasA && <View style={[styles.dot, { backgroundColor: Theme.colors.mcpA }]} />}
          {hasB && <View style={[styles.dot, { backgroundColor: Theme.colors.mcpB }]} />}
          {hasC && <View style={[styles.dot, { backgroundColor: Theme.colors.mcpC }]} />}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={Theme.colors.textSecondary}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.summaryPillsRow}>
          {hasA && (
            <View style={[styles.serverMiniPill, { backgroundColor: Theme.colors.mcpASoft, borderColor: Theme.colors.mcpABorder }]}>
              <View style={[styles.dot, { backgroundColor: Theme.colors.mcpA }]} />
              <Text style={[styles.serverMiniText, { color: Theme.colors.mcpA }]}>MCP-A Query</Text>
            </View>
          )}
          {hasB && (
            <View style={[styles.serverMiniPill, { backgroundColor: Theme.colors.mcpBSoft, borderColor: Theme.colors.mcpBBorder }]}>
              <View style={[styles.dot, { backgroundColor: Theme.colors.mcpB }]} />
              <Text style={[styles.serverMiniText, { color: Theme.colors.mcpB }]}>MCP-B Persist</Text>
            </View>
          )}
          {hasC && (
            <View style={[styles.serverMiniPill, { backgroundColor: Theme.colors.mcpCSoft, borderColor: Theme.colors.mcpCBorder }]}>
              <View style={[styles.dot, { backgroundColor: Theme.colors.mcpC }]} />
              <Text style={[styles.serverMiniText, { color: Theme.colors.mcpC }]}>MCP-C Memory</Text>
            </View>
          )}
        </View>
      )}

      {expanded && (
        <View style={styles.stepsList}>
          {trace.map((step) => {
            const accent = getServerAccent(step.serverId);
            const isStepOpen = expandedStepId === step.id;
            const argsPreview = JSON.stringify(step.arguments);

            return (
              <Pressable
                key={step.id}
                onPress={() => setExpandedStepId(isStepOpen ? null : step.id)}
                style={[styles.stepCard, { borderLeftColor: accent.color }]}
              >
                <View style={styles.stepTop}>
                  <View style={styles.stepTitleRow}>
                    <View style={[styles.dot, { backgroundColor: accent.color }]} />
                    <Text style={[styles.stepTag, { color: accent.color }]}>{accent.tag}</Text>
                    <Text style={styles.stepToolName}>{step.toolName}</Text>
                  </View>
                  <Text style={styles.latencyText}>{step.durationMs}ms</Text>
                </View>

                <Text style={styles.argsText} numberOfLines={isStepOpen ? undefined : 1}>
                  args: {argsPreview}
                </Text>

                <Text style={[styles.resultPreview, step.isError && { color: Theme.colors.danger }]}>
                  ↳ {summarizeResult(step)}
                </Text>

                {isStepOpen && (
                  <View style={styles.jsonBox}>
                    <Text style={styles.jsonText}>{JSON.stringify(step.result, null, 2)}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 10,
    marginTop: 8
  },
  containerCompact: {
    backgroundColor: Theme.colors.canvas,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  terminalIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: Theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: Theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: Theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600'
  },
  subtitleInline: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
    fontFamily: Theme.fonts.mono
  },
  subtitle: {
    color: Theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: Theme.fonts.mono,
    marginTop: 1
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  completedPill: {
    backgroundColor: Theme.colors.primarySoft,
    borderColor: Theme.colors.primaryBorder,
    borderWidth: 1,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  completedText: {
    color: Theme.colors.primaryBright,
    fontSize: 10,
    fontWeight: '700'
  },
  summaryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  serverMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Theme.radius.pill,
    borderWidth: 1
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  serverMiniText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Theme.fonts.mono
  },
  stepsList: {
    marginTop: 10,
    gap: 8
  },
  stepCard: {
    backgroundColor: Theme.colors.canvas,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    borderLeftWidth: 3,
    padding: 9
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap'
  },
  stepTag: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Theme.fonts.mono
  },
  stepToolName: {
    color: Theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Theme.fonts.mono
  },
  latencyText: {
    color: Theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: Theme.fonts.mono
  },
  argsText: {
    color: Theme.colors.textMuted,
    fontSize: 11,
    fontFamily: Theme.fonts.mono,
    marginTop: 4
  },
  resultPreview: {
    color: Theme.colors.primaryBright,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500'
  },
  jsonBox: {
    marginTop: 8,
    backgroundColor: '#070B0F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    padding: 8
  },
  jsonText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontFamily: Theme.fonts.mono,
    lineHeight: 15
  }
});

