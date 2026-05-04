"use client"

import { Star } from "lucide-react"

interface StarRatingProps {
  value: number | string | bigint | null | undefined
  max?: number
  sizeClassName?: string
}

export function getRatingValue(value: number | string | bigint | null | undefined, max = 5) {
  const numeric = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : value
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(max, Math.round(Number(numeric))))
}

export function StarRating({ value, max = 5, sizeClassName = "h-4 w-4" }: StarRatingProps) {
  const rating = getRatingValue(value, max)

  if (rating === null) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} out of ${max} stars`}
      title={`${rating}/${max}`}
    >
      {Array.from({ length: max }, (_, index) => {
        const filled = index < rating
        return (
          <Star
            key={index}
            className={`${sizeClassName} ${filled ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40"}`}
            aria-hidden="true"
          />
        )
      })}
    </span>
  )
}
