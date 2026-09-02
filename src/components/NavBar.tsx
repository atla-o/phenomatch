import type { AppView } from '../types'

type Props = {
  current: AppView
  onNavigate: (view: AppView) => void
}

const items: { view: AppView; label: string }[] = [
  { view: 'pheno', label: 'Pheno' },
  { view: 'match', label: 'Match' },
]

export function NavBar({ current, onNavigate }: Props) {
  return (
    <nav className="nav-bar" aria-label="Main navigation">
      {items.map((item) => (
        <button
          key={item.view}
          type="button"
          className={`nav-bar__item${current === item.view ? ' nav-bar__item--active' : ''}`}
          onClick={() => onNavigate(item.view)}
          aria-current={current === item.view ? 'page' : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
