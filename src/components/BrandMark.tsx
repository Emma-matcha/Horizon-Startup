interface BrandMarkProps {
  inverse?: boolean
  iconOnly?: boolean
}

export function BrandMark({ inverse = false, iconOnly = false }: BrandMarkProps) {
  return (
    <span
      aria-label={iconOnly ? 'Red house' : undefined}
      className={`brand ${inverse ? 'brand--inverse' : ''}`}
      role={iconOnly ? 'img' : undefined}
    >
      <img
        aria-hidden="true"
        className="brand__mark"
        src="/assets/red-house-cutout-v3.png"
      />
      {!iconOnly && (
        <span>
          <strong>Red house</strong>
        </span>
      )}
    </span>
  )
}
