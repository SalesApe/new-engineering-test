import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MessageComposer } from '../MessageComposer'

describe('MessageComposer', () => {
  it('submits trimmed text', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<MessageComposer onSend={onSend} isSending={false} />)

    const textarea = screen.getByPlaceholderText(/type a message/i)
    fireEvent.change(textarea, { target: { value: ' hello ' } })
    fireEvent.submit(textarea.closest('form') as HTMLFormElement)

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('hello'))
  })

  it('shows error when empty submission', async () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} isSending={false} />)

    fireEvent.submit(
      screen.getByRole('button', { name: /send/i }).closest('form') as HTMLFormElement
    )

    expect(await screen.findByText(/cannot be empty/i)).toBeInTheDocument()
    expect(onSend).not.toHaveBeenCalled()
  })
})
