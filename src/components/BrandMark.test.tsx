import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BrandMark } from './BrandMark'

describe('Red house brand mark', () => {
  it('uses the red-house cutout and shows only the approved English name', () => {
    const { container } = render(<BrandMark />)

    expect(screen.getByText('Red house')).toBeInTheDocument()
    expect(screen.queryByText('红房子')).not.toBeInTheDocument()
    expect(screen.queryByText('RED HOUSE VISION')).not.toBeInTheDocument()
    expect(container.querySelector('img.brand__mark')).toHaveAttribute(
      'src',
      '/assets/red-house-cutout-v3.png',
    )
    expect(container.querySelector('svg.brand__mark')).not.toBeInTheDocument()
  })
})
