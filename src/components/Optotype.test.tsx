import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Optotype } from './Optotype'

describe('Optotype', () => {
  it('renders a strict grid at the calculated physical CSS size', () => {
    render(<Optotype direction="left" level={5.0} />)

    const mark = screen.getByLabelText('E 字视标，缺口向左')
    expect(mark).toHaveAttribute('data-direction', 'left')
    expect(mark.getAttribute('style')).toContain('12.8')
    expect(mark.querySelectorAll('[data-cell="ink"]')).toHaveLength(17)
  })
})
