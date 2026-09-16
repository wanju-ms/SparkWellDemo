type Props = { value: string | null; label?: string; empty?: string }

export default function CreatedAt({ value, label = 'Created at', empty = 'Not created yet' }: Props) {
  const date = value === null ? null : new Date(value)
  const formatted = date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : null

  return <dl className="created-at">
    <dt>{label}</dt>
    <dd>{formatted && value
      ? <time dateTime={value}>{formatted}</time>
      : value === null ? empty : 'Unavailable'}</dd>
  </dl>
}