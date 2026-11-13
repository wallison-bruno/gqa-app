import { View } from 'react-native';
import styled from 'styled-components/native';

import { DiscreteSpinner, FadeInView, SkeletonBox, SkeletonGroup } from '@/components/LoadingPrimitives';

/** Skeleton da lista de documentos exibido durante a consulta ao banco de dados. */
export function DocumentListSkeleton({ count = 3 }: { count?: number }) {
  const titleWidths: `${number}%`[] = ['78%', '64%', '84%'];

  return (
    <FadeInView>
      <SkeletonGroup style={{ gap: 10 }}>
        <SyncHintRow accessibilityRole="progressbar" accessibilityLabel="Carregando seus materiais">
          <DiscreteSpinner size="sm" />
          <SyncHintText>Carregando seus materiais salvos…</SyncHintText>
        </SyncHintRow>

        {Array.from({ length: count }).map((_, idx) => (
          <DocSkeletonRow key={idx}>
            <SkeletonBox width={48} height={48} radius={14} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBox width={titleWidths[idx % titleWidths.length]} height={15} />
              <MetaSkeletonRow>
                <SkeletonBox width={86} height={20} radius={999} />
                <SkeletonBox width={94} height={12} />
              </MetaSkeletonRow>
            </View>
            <SkeletonBox width={36} height={36} radius={18} />
          </DocSkeletonRow>
        ))}
      </SkeletonGroup>
    </FadeInView>
  );
}

const SyncHintRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background-color: ${({ theme }) => theme.colors.surfaceAlt};
`;

const SyncHintText = styled.Text`
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const DocSkeletonRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.surface};
`;

const MetaSkeletonRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
`;

