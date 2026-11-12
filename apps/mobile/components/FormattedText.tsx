import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

interface FormattedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
}

/**
 * Lightweight inline markdown renderer for **bold** and *italic* segments
 * so raw asterisks never leak into React Native <Text> bubbles.
 */
export function FormattedText({ text, style, boldStyle }: FormattedTextProps) {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = text.split(tokenRegex);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <Text key={index} style={[{ fontWeight: '700', color: '#FFFFFF' }, boldStyle]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (
          ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) &&
          part.length > 2
        ) {
          return (
            <Text key={index} style={{ fontStyle: 'italic', opacity: 0.9 }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </Text>
  );
}

