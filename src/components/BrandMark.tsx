interface BrandMarkProps {
  inverse?: boolean
}

export function BrandMark({ inverse = false }: BrandMarkProps) {
  return (
    <span className={`brand ${inverse ? 'brand--inverse' : ''}`}>
      <svg
        aria-hidden="true"
        className="brand__mark"
        viewBox="0 0 42 42"
      >
        <path d="M5 20.5 21 7l16 13.5v16H5z" fill="currentColor" />
        <path d="M11 20.5 21 12l10 8.5v10H11z" fill="#f5f2e9" />
        <path d="M17.5 24h7v12h-7z" fill="currentColor" />
      </svg>
      <span>
        <strong>红房子</strong>
        <small>RED HOUSE VISION</small>
      </span>
    </span>
  )
}
