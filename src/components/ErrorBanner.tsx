import { Ionicons } from '@expo/vector-icons';
import styled, { useTheme } from 'styled-components/native';

import { Button } from '@/components/Button';

interface Props {
  message: string;
  onRetry?: () => void;
  onOpenSettings?: () => void;
}

export function ErrorBanner({ message, onRetry, onOpenSettings }: Props) {
  const theme = useTheme();
  return (
    <Box accessibilityRole="alert">
      <Row>
        <Ionicons name="alert-circle" size={22} color={theme.colors.danger} />
        <Message>{message}</Message>
      </Row>
      {onRetry || onOpenSettings ? (
        <Actions>
          {onRetry ? <Button label="Tentar novamente" variant="ghost" icon="refresh" onPress={onRetry} /> : null}
          {onOpenSettings ? (
            <Button label="Configurações" variant="ghost" icon="settings-outline" onPress={onOpenSettings} />
          ) : null}
        </Actions>
      ) : null}
    </Box>
  );
}

const Box = styled.View`
  background-color: ${({ theme }) => theme.colors.dangerSoft};
  border-radius: ${({ theme }) => theme.radius.md}px;
  padding: 14px 16px;
  gap: 4px;
`;

const Row = styled.View`
  flex-direction: row;
  gap: 10px;
  align-items: flex-start;
`;

const Message = styled.Text`
  flex: 1;
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.danger};
`;

const Actions = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  margin-left: -12px;
`;

