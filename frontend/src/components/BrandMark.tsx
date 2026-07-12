// BrandMark — круглая фиолетовая иконка с надписью «Портал».
// Использует фиксированный фиолетовый цвет (#8B5CF6) и белый текст.
export function BrandMark({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="портал"
      className={className}
    >
      <circle cx="256" cy="256" r="256" fill="#8B5CF6" />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="72"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        Портал
      </text>
    </svg>
  )
}