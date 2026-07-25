import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnalysisPage } from './App'

describe('analysis progress scene', () => {
  it('centres the red house inside an animated circular progress ring', () => {
    render(<AnalysisPage />)

    expect(screen.getByRole('heading', { name: '正在分析' })).toBeInTheDocument()
    expect(screen.getByText('双眼数据')).toBeInTheDocument()
    expect(screen.getByAltText('红房子')).toHaveAttribute(
      'src',
      '/assets/red-house-cutout-v3.png',
    )
    expect(document.querySelector('.analysis-progress__ring')).toBeInTheDocument()
    expect(document.querySelector('.analysis-loader')).not.toBeInTheDocument()
    expect(document.querySelector('.analysis-photo')).not.toBeInTheDocument()
  })
})
