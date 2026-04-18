import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { Send, Sparkles, User } from 'lucide-react'

const COLLAPSE_CHAR_LIMIT = 260
const COLLAPSE_LINE_LIMIT = 4

const Panel = styled.aside`
  grid-column: 4;
  grid-row: 2;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 420px;
  flex-direction: column;
  overflow: hidden;
  border-left: 1px solid #e5e7eb;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow: -8px 0 24px rgba(15, 23, 42, 0.08);
`

const Header = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 14px 16px;
`

const HeaderTitle = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
`

const HeaderCopy = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
`

const BotIcon = styled.div`
  display: flex;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background: #ffb300;
  color: #111827;
  box-shadow: 0 3px 10px rgba(255, 179, 0, 0.35);
`

const HeaderText = styled.h2`
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
`

const HeaderContext = styled.p`
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4b5563;
  font-size: 11px;
  line-height: 1.4;
`

const CloseButton = styled.button`
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: #e5e7eb;
    color: #374151;
    transform: translateY(-1px);
  }
`

const Body = styled.div`
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  background: transparent;
`

const MessageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #d1d5db;
  border-radius: 12px;
  padding: 16px;
  background: #ffffff;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
`

const BotMessageRow = styled.div`
  display: flex;
  gap: 8px;
`

const UserMessageRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 8px;
`

const MiniBotIcon = styled(BotIcon)`
  align-self: flex-start;
  width: 30px;
  height: 30px;
`

const UserAvatar = styled.div`
  display: flex;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #ffffff;
  color: #6b7280;
`

const BubbleColumn = styled.div`
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
`

const BotBubble = styled.div`
  max-width: calc(100% - 38px);
  min-width: 0;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  border-top-left-radius: 5px;
  background: #ffffff;
  padding: 11px 13px;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.05);
`

const UserBubble = styled.div`
  max-width: min(82%, 300px);
  border: 1px solid #0f172a;
  border-radius: 12px;
  border-top-right-radius: 5px;
  background: linear-gradient(135deg, #1f2937 0%, #0f172a 100%);
  padding: 11px 13px;
  color: #ffffff;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.14);
`

const SummaryToggle = styled.button`
  margin-top: 6px;
  border: 0;
  background: transparent;
  padding: 0;
  color: #0f766e;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;

  &:hover {
    color: #115e59;
    text-decoration: underline;
  }
`

const Footer = styled.div`
  flex-shrink: 0;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 12px 14px 14px;
`

const InputForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`

const MessageInput = styled.input`
  width: 100%;
  min-width: 0;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #ffffff;
  padding: 0 12px;
  color: #111827;
  font-size: 13px;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &::placeholder {
    color: #9ca3af;
  }

  &:focus {
    outline: none;
    border-color: #ffb300;
    box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.25);
  }
`

const SendButton = styled.button`
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: ${({ $disabled }) => ($disabled ? '#fde7a2' : '#ffb300')};
  color: #111827;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
  transition: background-color 0.2s ease, transform 0.2s ease;

  &:hover {
    background: ${({ $disabled }) => ($disabled ? '#fde7a2' : '#e6a200')};
    transform: ${({ $disabled }) => ($disabled ? 'none' : 'translateY(-1px)')};
  }
`

const ErrorText = styled.p`
  margin: 0;
  color: #dc2626;
  font-size: 12px;
  line-height: 1.4;
`

const LoadingText = styled.span`
  color: #6b7280;
  font-size: 13px;
`

const BottomAnchor = styled.div`
  height: 1px;
`

function countLines(content) {
  return String(content || '').split(/\r?\n/).length
}

function shouldCollapseMessage(content) {
  const text = String(content || '').trim()
  if (!text) {
    return false
  }
  return text.length > COLLAPSE_CHAR_LIMIT || countLines(text) > COLLAPSE_LINE_LIMIT
}

function buildMessagePreview(content) {
  const text = String(content || '').trim()
  if (!text) {
    return ''
  }

  const limitedLines = text.split(/\r?\n/).slice(0, COLLAPSE_LINE_LIMIT)
  let preview = limitedLines.join('\n')

  if (preview.length > COLLAPSE_CHAR_LIMIT) {
    preview = preview.slice(0, COLLAPSE_CHAR_LIMIT).trimEnd()
  }

  if (preview.length < text.length) {
    preview = `${preview}...`
  }

  return preview
}

export default function AssistantPanel({
  isOpen,
  onClose,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  isLoading,
  error,
  contextLabel,
  contextDescription,
}) {
  const bottomRef = useRef(null)
  const [expandedMessageIds, setExpandedMessageIds] = useState({})

  const canSend = useMemo(() => inputValue.trim().length > 0 && !isLoading, [inputValue, isLoading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    setExpandedMessageIds({})
  }, [contextLabel, contextDescription])

  const handleToggleMessageExpand = (messageId) => {
    setExpandedMessageIds((current) => ({
      ...current,
      [messageId]: !current[messageId],
    }))
  }

  if (!isOpen) {
    return null
  }

  return (
    <Panel>
      <Header>
        <HeaderTitle>
          <BotIcon>
            <Sparkles size={16} strokeWidth={2} />
          </BotIcon>
          <HeaderCopy>
            <HeaderText>Assistente IA</HeaderText>
            <HeaderContext>{contextDescription}: {contextLabel}</HeaderContext>
          </HeaderCopy>
        </HeaderTitle>

        <CloseButton type="button" onClick={onClose} aria-label="Fechar chat">
          x
        </CloseButton>
      </Header>

      <Body>
        <MessageStack>
          {messages.length === 0 ? (
            <EmptyState>
              Comece com uma pergunta curta sobre o processo para receber uma analise objetiva.
            </EmptyState>
          ) : null}

          {messages.map((message, index) => {
            const messageId = message?.id || `${message?.role || 'msg'}-${index}`

            if (message.role === 'assistant') {
              const isCollapsible = shouldCollapseMessage(message.content)
              const isExpanded = Boolean(expandedMessageIds[messageId])
              const visibleContent =
                isCollapsible && !isExpanded ? buildMessagePreview(message.content) : message.content

              return (
                <BotMessageRow key={messageId}>
                  <MiniBotIcon>
                    <Sparkles size={16} strokeWidth={2} />
                  </MiniBotIcon>
                  <BubbleColumn>
                    <BotBubble>{visibleContent}</BotBubble>
                    {isCollapsible ? (
                      <SummaryToggle type="button" onClick={() => handleToggleMessageExpand(messageId)}>
                        {isExpanded ? 'Ver menos' : 'Ver mais'}
                      </SummaryToggle>
                    ) : null}
                  </BubbleColumn>
                </BotMessageRow>
              )
            }

            return (
              <UserMessageRow key={messageId}>
                <UserBubble>{message.content}</UserBubble>
                <UserAvatar>
                  <User size={16} strokeWidth={2} />
                </UserAvatar>
              </UserMessageRow>
            )
          })}

          {isLoading && (
            <BotMessageRow>
              <MiniBotIcon>
                <Sparkles size={16} strokeWidth={2} />
              </MiniBotIcon>
              <BotBubble>
                <LoadingText>Pensando...</LoadingText>
              </BotBubble>
            </BotMessageRow>
          )}

          <BottomAnchor ref={bottomRef} />
        </MessageStack>
      </Body>

      <Footer>
        <InputForm
          onSubmit={(event) => {
            event.preventDefault()
            onSendMessage()
          }}
        >
          <InputRow>
            <MessageInput
              type="text"
              placeholder="Pergunte sobre este contexto..."
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
            />
            <SendButton type="submit" $disabled={!canSend} disabled={!canSend} aria-label="Enviar mensagem">
              <Send size={18} strokeWidth={2} />
            </SendButton>
          </InputRow>

          {error ? <ErrorText>{error}</ErrorText> : null}
        </InputForm>
      </Footer>
    </Panel>
  )
}

