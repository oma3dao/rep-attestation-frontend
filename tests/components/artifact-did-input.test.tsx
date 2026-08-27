import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ArtifactDidInput } from '@/components/artifact-did-input'

const mockArtifactDidFromJson = vi.fn()
const mockArtifactDidFromBytes = vi.fn()
const mockParseArtifactDid = vi.fn()

vi.mock('@oma3/omatrust/identity', () => ({
  artifactDidFromJson: (...args: unknown[]) => mockArtifactDidFromJson(...args),
  artifactDidFromBytes: (...args: unknown[]) => mockArtifactDidFromBytes(...args),
  parseArtifactDid: (...args: unknown[]) => mockParseArtifactDid(...args),
}))

function makeFile(contents: string | Uint8Array, name: string, type: string) {
  const bytes = typeof contents === 'string' ? new TextEncoder().encode(contents) : contents
  const file = new File([bytes], name, { type })
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  })
  return file
}

describe('ArtifactDidInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseArtifactDid.mockImplementation((did: string) => {
      if (did === 'did:artifact:bvalid') return { digestHex: 'abc' }
      throw new Error('low-level parse failure')
    })
  })

  it('shows a friendly error for short invalid did:artifact values', () => {
    const onChange = vi.fn()
    render(<ArtifactDidInput onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('DID'), {
      target: { value: 'did:artifact:invalid' },
    })

    expect(
      screen.getByText("This isn't a valid content ID. It should start with did:artifact:b...")
    ).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('accepts a valid did:artifact paste and calls onChange', () => {
    const onChange = vi.fn()
    render(<ArtifactDidInput onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('DID'), {
      target: { value: 'did:artifact:bvalid' },
    })

    expect(mockParseArtifactDid).toHaveBeenCalledWith('did:artifact:bvalid')
    expect(onChange).toHaveBeenCalledWith('did:artifact:bvalid')
    expect(screen.queryByText(/isn't a valid content ID/i)).not.toBeInTheDocument()
  })

  it('rejects non-artifact text that is long enough to validate', () => {
    const onChange = vi.fn()
    render(<ArtifactDidInput onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('DID'), {
      target: { value: 'not-an-artifact-did' },
    })

    expect(screen.getByText('Must start with did:artifact:')).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('clears the value when the DID field is emptied', () => {
    const onChange = vi.fn()
    render(<ArtifactDidInput value="did:artifact:bvalid" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('DID'), { target: { value: '' } })

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('hashes a JSON upload via artifactDidFromJson and shows canonical JSON', async () => {
    mockArtifactDidFromJson.mockResolvedValue('did:artifact:bfromjson')
    const onChange = vi.fn()
    render(<ArtifactDidInput onChange={onChange} />)

    const file = makeFile('{"hello":"world"}', 'artifact.json', 'application/json')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockArtifactDidFromJson).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith('did:artifact:bfromjson')
    })
    expect(screen.getByText(/canonical JSON/i)).toBeInTheDocument()
    expect(screen.getByText('artifact.json')).toBeInTheDocument()
  })

  it('hashes a binary upload via artifactDidFromBytes', async () => {
    mockArtifactDidFromBytes.mockResolvedValue('did:artifact:bfrombytes')
    const onChange = vi.fn()
    render(<ArtifactDidInput onChange={onChange} />)

    const file = makeFile(new Uint8Array([1, 2, 3]), 'blob.bin', 'application/octet-stream')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockArtifactDidFromBytes).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith('did:artifact:bfrombytes')
    })
    expect(screen.getByText(/raw bytes/i)).toBeInTheDocument()
  })

  it('removes an uploaded file and clears the DID', async () => {
    mockArtifactDidFromBytes.mockResolvedValue('did:artifact:bfrombytes')
    const onChange = vi.fn()
    render(<ArtifactDidInput onChange={onChange} />)

    const file = makeFile(new Uint8Array([1, 2, 3]), 'blob.bin', 'application/octet-stream')
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('blob.bin')).toBeInTheDocument()
    })

    const removeButton = screen.getByText('Replace').parentElement?.querySelector('button:last-of-type')
    expect(removeButton).toBeTruthy()
    fireEvent.click(removeButton!)

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByText('blob.bin')).not.toBeInTheDocument()
  })
})
