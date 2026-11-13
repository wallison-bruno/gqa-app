import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { FlatList, Modal, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import { DifficultySelector } from '@/components/DifficultySelector';
import { Card, IconButton, SectionTitle } from '@/components/Layout';
import { SegmentedControl } from '@/components/SegmentedControl';
import type { SegmentOption } from '@/components/SegmentedControl';
import type { GeneratorSettings } from '@/hooks/useGeneratorSettings';
import { DIFFICULTIES, EDUCATION_LEVELS, EXAM_BOARDS, FEATURED_EXAM_BOARDS, QUESTION_TYPES } from '@/theme/theme';
import type { EducationLevel } from '@/types';
import * as haptics from '@/utils/haptics';

const normalizeSearch = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const EDUCATION_OPTIONS: readonly SegmentOption<EducationLevel>[] = [
  { value: 'medio', label: 'Médio' },
  { value: 'superior', label: 'Superior' },
];

interface Props {
  settings: GeneratorSettings;
  onChange: (patch: Partial<GeneratorSettings>) => void;
  disabled?: boolean;
  /** Já existem questões neste documento (muda o título e mostra o atalho para voltar a elas). */
  hasQuestions: boolean;
  onClose?: () => void;
}

function FormField({ label, caption, children }: { label: string; caption?: string; children: ReactNode }) {
  return (
    <FieldBox>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {caption ? <Caption>{caption}</Caption> : null}
    </FieldBox>
  );
}

export function GeneratorSettingsPanel({ settings, onChange, disabled, hasQuestions, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [boardModalVisible, setBoardModalVisible] = useState(false);
  const [boardQuery, setBoardQuery] = useState('');

  const filteredBoards = useMemo(() => {
    const q = normalizeSearch(boardQuery);
    if (!q) return EXAM_BOARDS as readonly string[];
    return EXAM_BOARDS.filter((b) => normalizeSearch(b).includes(q));
  }, [boardQuery]);

  const quickBoards = useMemo(() => {
    const base: string[] = [...FEATURED_EXAM_BOARDS];
    return base.includes(settings.board) ? base : [settings.board, ...base];
  }, [settings.board]);

  const openBoards = () => {
    haptics.tap();
    setBoardQuery('');
    setBoardModalVisible(true);
  };

  const educationHint = EDUCATION_LEVELS.find((e) => e.value === settings.educationLevel)?.hint;
  const typeHint = QUESTION_TYPES.find((t) => t.value === settings.questionType)?.hint;
  const difficultyHint = DIFFICULTIES.find((d) => d.value === settings.difficulty)?.hint;

  return (
    <>
      <Card style={{ gap: 20 }}>
        {/* Cabeçalho */}
        <Header>
          <View style={{ flex: 1, gap: 4 }}>
            <PanelTitle accessibilityRole="header">
              {hasQuestions ? 'Alterar configurações' : 'Configurar questão'}
            </PanelTitle>
            <PanelSubtitle>Suas escolhas ficam salvas e valem para as próximas questões.</PanelSubtitle>
          </View>
          {hasQuestions && onClose ? (
            <CloseLink onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Voltar às questões">
              <CloseLinkText>Ver questões</CloseLinkText>
            </CloseLink>
          ) : null}
        </Header>

        <Divider />

        {/* Grupo 1: perfil da prova */}
        <Group>
          <SectionTitle>Perfil da prova</SectionTitle>

          <FormField label="Escolaridade" caption={educationHint}>
            <SegmentedControl
              options={EDUCATION_OPTIONS}
              value={settings.educationLevel}
              onChange={(educationLevel) => onChange({ educationLevel })}
              disabled={disabled}
              accessibilityLabel="Escolaridade"
            />
          </FormField>

          <FormField label="Banca examinadora">
            <SelectField
              disabled={disabled}
              onPress={openBoards}
              accessibilityRole="button"
              accessibilityLabel={`Banca examinadora: ${settings.board}. Toque para escolher outra`}
            >
              <SelectValue numberOfLines={1}>{settings.board}</SelectValue>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textMuted} />
            </SelectField>
            <ChipRow accessibilityRole="radiogroup">
              {quickBoards.map((board) => {
                const active = settings.board === board;
                return (
                  <Chip
                    key={board}
                    $active={active}
                    disabled={disabled}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: !!disabled }}
                    onPress={() => {
                      if (active) return;
                      haptics.tap();
                      onChange({ board });
                    }}
                  >
                    <ChipText $active={active} numberOfLines={1}>
                      {board}
                    </ChipText>
                  </Chip>
                );
              })}
            </ChipRow>
            <Caption>Toque no campo acima para ver as {EXAM_BOARDS.length} bancas disponíveis.</Caption>
          </FormField>
        </Group>

        <Divider />

        {/* Grupo 2: formato da questão */}
        <Group>
          <SectionTitle>Formato</SectionTitle>

          <FormField label="Tipo de questão" caption={typeHint}>
            <SegmentedControl
              options={QUESTION_TYPES}
              value={settings.questionType}
              onChange={(questionType) => onChange({ questionType })}
              disabled={disabled}
              accessibilityLabel="Tipo de questão"
            />
          </FormField>

          <FormField label="Dificuldade" caption={difficultyHint}>
            <DifficultySelector
              value={settings.difficulty}
              onChange={(difficulty) => onChange({ difficulty })}
              disabled={disabled}
            />
          </FormField>
        </Group>

        <Divider />

        {/* Grupo 3: conteúdo */}
        <Group>
          <SectionTitle>Conteúdo</SectionTitle>

          <FormField
            label="Tema (opcional)"
            caption="Deixe em branco para sortear trechos variados do documento."
          >
            <TopicInput
              value={settings.topic}
              onChangeText={(topic) => onChange({ topic })}
              placeholder="Ex.: Segurança da informação"
              placeholderTextColor={theme.colors.textMuted}
              returnKeyType="done"
              maxLength={120}
              editable={!disabled}
              accessibilityLabel="Tema da questão"
            />
          </FormField>
        </Group>
      </Card>

      {/* Lista completa de bancas, com busca */}
      <Modal
        visible={boardModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBoardModalVisible(false)}
      >
        <ModalBackdrop>
          <ModalSheet style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <ModalHeader>
              <View style={{ flex: 1 }}>
                <ModalTitle>Escolher banca</ModalTitle>
                <ModalSubtitle>{EXAM_BOARDS.length} bancas disponíveis</ModalSubtitle>
              </View>
              <IconButton
                onPress={() => setBoardModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar lista de bancas"
              >
                <Ionicons name="close" size={22} color={theme.colors.text} />
              </IconButton>
            </ModalHeader>

            <SearchBox>
              <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
              <SearchInput
                value={boardQuery}
                onChangeText={setBoardQuery}
                placeholder="Buscar banca (ex.: CEBRASPE, FGV, UFRJ…)"
                placeholderTextColor={theme.colors.textMuted}
                autoCorrect={false}
                returnKeyType="search"
              />
              {boardQuery ? (
                <ClearSearchButton onPress={() => setBoardQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                </ClearSearchButton>
              ) : null}
            </SearchBox>

            <FlatList
              data={filteredBoards}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
              ListEmptyComponent={
                <EmptyList>
                  <Ionicons name="search-outline" size={32} color={theme.colors.textMuted} />
                  <Caption>Nenhuma banca encontrada para “{boardQuery}”.</Caption>
                </EmptyList>
              }
              renderItem={({ item }) => {
                const active = item === settings.board;
                return (
                  <BoardListItem
                    $active={active}
                    onPress={() => {
                      haptics.tap();
                      onChange({ board: item });
                      setBoardModalVisible(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <BoardListItemText $active={active} numberOfLines={2}>
                      {item}
                    </BoardListItemText>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} /> : null}
                  </BoardListItem>
                );
              }}
            />
          </ModalSheet>
        </ModalBackdrop>
      </Modal>
    </>
  );
}

const Header = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
`;

const PanelTitle = styled.Text`
  font-size: 20px;
  line-height: 26px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const PanelSubtitle = styled.Text`
  font-size: 14px;
  line-height: 20px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const CloseLink = styled.Pressable`
  min-height: 44px;
  justify-content: center;
  padding: 0 4px;
`;

const CloseLinkText = styled.Text`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const Divider = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.border};
`;

const Group = styled.View`
  gap: 16px;
`;

const FieldBox = styled.View`
  gap: 8px;
`;

const FieldLabel = styled.Text`
  font-size: 15px;
  line-height: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const Caption = styled.Text`
  font-size: 13px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SelectField = styled.Pressable`
  min-height: 52px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const SelectValue = styled.Text`
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const ChipRow = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.Pressable<{ $active: boolean }>`
  min-height: 38px;
  max-width: 100%;
  justify-content: center;
  padding: 0 14px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  border-width: 1px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primarySoft : theme.colors.background)};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const ChipText = styled.Text<{ $active: boolean }>`
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? '800' : '600')};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
`;

const TopicInput = styled(TextInput)`
  min-height: 52px;
  padding: 0 16px;
  font-size: 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
`;

const ModalBackdrop = styled.View`
  flex: 1;
  justify-content: flex-end;
  background-color: rgba(15, 23, 42, 0.55);
`;

const ModalSheet = styled.View`
  max-height: 82%;
  padding: 20px 20px 0;
  gap: 14px;
  border-top-left-radius: ${({ theme }) => theme.radius.lg}px;
  border-top-right-radius: ${({ theme }) => theme.radius.lg}px;
  background-color: ${({ theme }) => theme.colors.surface};
`;

const ModalHeader = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const ModalTitle = styled.Text`
  font-size: 20px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.text};
`;

const ModalSubtitle = styled.Text`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SearchBox = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 0 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
`;

const SearchInput = styled.TextInput`
  flex: 1;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.text};
`;

const ClearSearchButton = styled.Pressable`
  padding: 4px;
`;

const EmptyList = styled.View`
  align-items: center;
  gap: 8px;
  padding: 24px 12px;
`;

const BoardListItem = styled.Pressable<{ $active: boolean }>`
  min-height: 52px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border-width: 1px;
  border-color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  background-color: ${({ theme, $active }) => ($active ? theme.colors.primarySoft : theme.colors.background)};
`;

const BoardListItemText = styled.Text<{ $active: boolean }>`
  flex: 1;
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? '800' : '600')};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
`;

